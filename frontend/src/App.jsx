import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletClient, usePublicClient } from 'wagmi';
import { generateVRFCommitment, requestRoll, finalizeRoll } from './lib/vrf';
// Pages
import Home from './pages/Home';
import CreateGame from './pages/CreateGame';
import JoinGame from './pages/JoinGame';
import WaitingRoom from './pages/WaitingRoom';
import Gameplay from './pages/Gameplay';
import Leaderboard from './pages/Leaderboard';
import Deck from './pages/Deck';
import BalatroBackground from './components/BalatroBackground';

const API_BASE = '/api';

function App() {
    const { login, logout, authenticated, user } = usePrivy();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();

    const [view, setView] = useState('home');
    const [gameCode, setGameCode] = useState('');
    const [playerId, setPlayerId] = useState('');
    const [gameState, setGameState] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [resolveTimeLeft, setResolveTimeLeft] = useState(0);
    const [waitTimeLeft, setWaitTimeLeft] = useState(0);
    const [serverSkew, setServerSkew] = useState(0);
    const [startDelay, setStartDelay] = useState(1); // Default 1 min
    const [joinCode, setJoinCode] = useState('');
    const [selectedCard, setSelectedCard] = useState(null);

    // VRF Flow State
    const vrfInProgress = useRef(null); // stores the currentRoundId being processed
    const userRandomRef = useRef(null); // stores local secret

    // Animation states
    const [visualRoll, setVisualRoll] = useState(1);
    const [isRolling, setIsRolling] = useState(false);

    // --- ORACLE NATIVE VRF FLOW (Hardened) ---
    useEffect(() => {
        if (!gameState || gameState.phase !== 'rolling' || !walletClient || !publicClient || !authenticated) return;
        if (vrfInProgress.current === gameState.currentRoundId) return;

        const handleVRF = async () => {
            const roundId = gameState.currentRoundId;
            const gameId = gameState.gameCode;
            const playerAddress = user?.wallet?.address;

            if (!playerAddress) return;

            // Deterministic Leader Election: Connected player with lowest index requests
            const activePlayers = gameState.players.filter(p => p.connected).sort((a, b) => a.playerNumber - b.playerNumber);
            const isLeader = activePlayers[0]?.id === playerId;

            if (!isLeader) {
                console.log(`👤 [VRF] Following Leader ${activePlayers[0]?.name} for Round ${roundId}`);
                vrfInProgress.current = roundId;
                return;
            }

            console.log(`👑 [VRF] Leading Orchestration for Round ${roundId}`);
            vrfInProgress.current = roundId;

            try {
                // 1. Check if already requested (in case of overlap)
                const status = await publicClient.readContract({
                    address: "0x131e56853F087F74Dbd59f7c6581cd57201a5f34",
                    abi: DICEROLLER_ABI,
                    functionName: 'getDiceStatus',
                    args: [BigInt(roundId)]
                });

                if (status.requested) {
                    console.log("   ✅ Already requested by someone else.");
                } else {
                    // 2. Generate Hardened Commitment
                    const { userReveal, userCommitment } = await generateHardenedCommitment(roundId, gameId, playerAddress);
                    userRandomRef.current = userReveal; // userReveal is H(secret, context)

                    // 3. Request Roll
                    const res = await requestHardenedRoll(roundId, gameId, userCommitment, walletClient, publicClient);
                    if (res.success) {
                        // 4. Share Secret with Backend Crank (Completion Guarantee)
                        await shareRevealSecret(roundId, userReveal);
                        console.log("   ✅ Secret shared with Backend Crank.");
                    }
                }
            } catch (err) {
                console.error("   ❌ VRF Orchestration Failed:", err);
                vrfInProgress.current = null; // Allow retry or leader handover
            }
        };

        handleVRF();
    }, [gameState?.phase, gameState?.currentRoundId, walletClient, publicClient, authenticated]);

    // Poll game state
    useEffect(() => {
        if (view !== 'game' || !gameCode || !playerId) return;
        const fetchState = async () => {
            try {
                const res = await fetch(`${API_BASE}/state?gameCode=${gameCode}&playerId=${playerId}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();

                if (data.serverTime) {
                    setServerSkew(data.serverTime - Date.now());
                }

                // Sync local selection with server commitment if available
                setGameState(prev => {
                    if (data.currentPlayer?.commitment) {
                        setSelectedCard(data.currentPlayer.commitment.card);
                    } else if (prev && (data.round !== prev.round || data.phase === 'waiting')) {
                        setSelectedCard(null);
                    }
                    return data;
                });
            } catch (err) {
                console.error('Failed to fetch game state:', err);
            }
        };
        fetchState();
        const interval = setInterval(fetchState, 1000);
        return () => clearInterval(interval);
    }, [view, gameCode, playerId]);

    // Auto-join from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlGameCode = params.get('gameCode');
        if (urlGameCode && view === 'home') {
            setJoinCode(urlGameCode);
            setView('join');
        }
    }, [view]);

    // Countdown timer for game phases
    useEffect(() => {
        if (!gameState) return;
        const interval = setInterval(() => {
            const currentSkew = serverSkew || 0;
            const now = Date.now() + currentSkew;

            if (gameState.phase === 'waiting' && typeof gameState.startDeadline === 'number') {
                const remaining = Math.max(0, Math.ceil((gameState.startDeadline - now) / 1000));
                setWaitTimeLeft(remaining);
            } else if ((gameState.phase === 'commit' || gameState.phase === 'rolling') && typeof gameState.commitDeadline === 'number') {
                const remaining = Math.max(0, Math.ceil((gameState.commitDeadline - now) / 1000));
                setTimeLeft(remaining);
            } else if (gameState.phase === 'resolve' && typeof gameState.resolveDeadline === 'number') {
                const remaining = Math.max(0, Math.ceil((gameState.resolveDeadline - now) / 1000));
                setResolveTimeLeft(remaining);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [gameState, serverSkew]);

    // Auto-confirm logic
    useEffect(() => {
        if (selectedCard === null) return;
        commitChoice(selectedCard);
    }, [selectedCard]);

    // Dice Animation Logic
    useEffect(() => {
        let timeoutId;

        if (gameState?.phase === 'rolling') {
            // Infinite spin while waiting for VRF
            setIsRolling(true);
            // We can also update visual roll occasionally just in case CSS fails? 
            // But CSS handles the loop. Let's just keep isRolling=true.

        } else if (gameState?.phase === 'resolve' && gameState.lastRoll) {
            // VRF Result Received - Spin Down Effect
            setIsRolling(false); // Disable infinite CSS spin, enable CSS transitions

            let delay = 50; // Start fast
            let count = 0;
            const minSteps = 15; // Minimum number of flips

            const spinDown = () => {
                // Generate random face 1-6 (visual variety, even if game is 1-3)
                // Ensure we don't pick the same face twice in a row
                setVisualRoll(prev => {
                    let next;
                    do { next = Math.floor(Math.random() * 6) + 1; } while (next === prev);
                    return next;
                });

                count++;

                // Slow down curve
                delay = Math.floor(delay * 1.15);

                // Condition to stop:
                // If we have done enough steps AND the delay is long enough for a 'final landing' feel
                // AND/OR we are approaching the final moment?
                // Simpler: Run until delay > 600ms (transition time) or max time.
                // Let's settle on the final result once we are slow enough.

                if (delay > 400 && count > minSteps) {
                    setVisualRoll(gameState.lastRoll); // Snap to final winner
                    return;
                }

                timeoutId = setTimeout(spinDown, delay);
            };

            spinDown();

        } else {
            // Idle / Other phases
            setIsRolling(false);
            if (gameState?.lastRoll) {
                setVisualRoll(gameState.lastRoll);
            }
        }

        return () => clearTimeout(timeoutId);
    }, [gameState?.phase, gameState?.lastRoll]);

    const createGame = async () => {
        if (!authenticated) {
            login();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDelayMinutes: startDelay })
            });
            const data = await res.json();
            setGameCode(data.gameCode);
            setView('create');
        } catch (err) {
            console.error('Failed to create game:', err);
        }
    };

    const joinGame = async () => {
        if (!authenticated) {
            login();
            return;
        }

        // Derive player details from Privy user
        const playerName = user.twitter?.username || user.wallet?.address?.slice(0, 8) || user.email?.address?.split('@')[0] || 'Player';

        // Find the first available profile picture from linked accounts
        const privyAvatar = user.twitter?.profilePictureUrl ||
            user.google?.profilePictureUrl ||
            user.github?.profilePictureUrl ||
            user.linkedAccounts?.find(acc => acc.profilePictureUrl)?.profilePictureUrl ||
            '😊';
        const avatar = privyAvatar;

        try {
            const res = await fetch(`${API_BASE}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameCode: joinCode,
                    playerName: playerName,
                    avatar: avatar,
                    privyId: user.id,
                    privyUser: user,
                    twitterHandle: user.twitter?.username
                })
            });
            const data = await res.json();
            if (data.success) {
                setGameCode(joinCode);
                setPlayerId(data.playerId);
                setGameState(data.gameState);
                setView('game');
            } else {
                alert(data.error || 'Failed to join game');
            }
        } catch (err) {
            console.error('Failed to join game:', err);
            alert('Failed to join game. Check your game code.');
        }
    };

    const commitChoice = async (card = null, skip = false) => {
        try {
            await fetch(`${API_BASE}/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameCode, playerId, card, skip })
            });
        } catch (err) {
            console.error('Failed to commit choice:', err);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => e.preventDefault();
    const handleCardClick = (card) => setSelectedCard(card);
    const handleSkip = () => {
        commitChoice(null, true);
        setSelectedCard(null);
    };

    // RENDER ROUTING
    const renderContent = () => {
        if (view === 'leaderboard') {
            return <Leaderboard setView={setView} />;
        }

        if (view === 'deck') {
            return <Deck setView={setView} />;
        }

        if (view === 'home') {
            return (
                <Home
                    startDelay={startDelay}
                    setStartDelay={setStartDelay}
                    createGame={createGame}
                    setView={setView}
                    login={login}
                    logout={logout}
                    authenticated={authenticated}
                    user={user}
                />
            );
        }

        if (view === 'create') {
            return <CreateGame gameCode={gameCode} startDelay={startDelay} setView={setView} setJoinCode={setJoinCode} copyToClipboard={copyToClipboard} />;
        }

        if (view === 'join') {
            return (
                <JoinGame
                    joinCode={joinCode}
                    setJoinCode={setJoinCode}
                    joinGame={joinGame}
                    setView={setView}
                    login={login}
                    authenticated={authenticated}
                />
            );
        }

        if (!gameState) return <div className="loading">Connecting...</div>;

        if (gameState.phase === 'waiting') {
            return <WaitingRoom gameState={gameState} waitTimeLeft={waitTimeLeft} gameCode={gameCode} />;
        }

        return (
            <Gameplay
                gameState={gameState}
                currentPlayer={gameState.currentPlayer}
                timeLeft={timeLeft}
                resolveTimeLeft={resolveTimeLeft}
                isRolling={isRolling}
                visualRoll={visualRoll}
                selectedCard={selectedCard}
                handleCardClick={handleCardClick}
                handleSkip={handleSkip}
                handleDragOver={handleDragOver}
                handleDrop={handleDrop}
            />
        );
    };

    return (
        <div className="app">
            <BalatroBackground />
            <div className="crt-container" />
            <div className="vignette" />
            {renderContent()}
        </div>
    );
}

export default App;
