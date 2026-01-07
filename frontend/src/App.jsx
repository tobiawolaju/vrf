import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletClient, usePublicClient } from 'wagmi';
import { decodeEventLog } from 'viem';
import { requestHardenedRoll, settleHardenedRoll, DICEROLLER_ABI, CONTRACT_ADDRESS } from './lib/vrf';
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
    const { login, logout: privyLogout, authenticated, user } = usePrivy();
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

    const fullLogout = async () => {
        await privyLogout();   // kill auth
        clearSession();        // kill game
    };


    // --- SESSION PERSISTENCE ---
    useEffect(() => {
        const storedSession = localStorage.getItem('monkeyHand_session');
        if (storedSession && view === 'home' && !gameCode) {
            try {
                const { gameCode: savedCode, playerId: savedId } = JSON.parse(storedSession);
                if (savedCode && savedId) {
                    console.log(`💾 Restoring session for Game: ${savedCode}, Player: ${savedId}`);
                    setGameCode(savedCode);
                    setPlayerId(savedId);

                    // Verify validity by fetching state immediately
                    fetch(`${API_BASE}/state?gameCode=${savedCode}&playerId=${savedId}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.gameCode) {
                                setGameState(data);
                                setView('game');
                            } else {
                                // Invalid session, clear it
                                localStorage.removeItem('monkeyHand_session');
                            }
                        })
                        .catch(() => localStorage.removeItem('monkeyHand_session'));
                }
            } catch (e) {
                console.error("Failed to parse session", e);
                localStorage.removeItem('monkeyHand_session');
            }
        }
    }, [view, gameCode]);

    const saveSession = (code, id) => {
        localStorage.setItem('monkeyHand_session', JSON.stringify({ gameCode: code, playerId: id }));
    };

    const clearSession = () => {
        localStorage.removeItem('monkeyHand_session');
        setGameCode('');
        setPlayerId('');
        setGameState(null);
        setView('home');
    };

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

            // 👑 Leader Election: The Host (creator) triggers the VRF
            const isLeader = gameState.hostId === playerId;
            const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);

            if (!isLeader) {
                console.log(`👤 [VRF] Following Host ${hostPlayer?.name || 'Leader'} for Round ${roundId}`);
                vrfInProgress.current = roundId;
                return;
            }

            console.log(`👑 [VRF] I am the Host (${playerId}). Leading Orchestration for Round ${roundId}`);
            vrfInProgress.current = roundId;

            try {
                // 1. Check if already requested (in case of overlap)
                const status = await publicClient.readContract({
                    address: CONTRACT_ADDRESS,
                    abi: DICEROLLER_ABI,
                    functionName: 'getDiceStatus',
                    args: [BigInt(roundId)]
                });

                if (status.requested) {
                    console.log("   ✅ Already requested on-chain. Checking for results...");
                    if (status.fulfilled) {
                        const result = status.result;
                        console.log(`   🎯 Found existing result: ${result}. Re-notifying backend...`);
                        await fetch(`${API_BASE}/resolve`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                gameCode: gameId,
                                roundId: roundId,
                                result: Number(result)
                            })
                        });
                    }
                } else {
                    // 2. Request Roll (Switchboard)
                    const res = await requestHardenedRoll(roundId, gameId, walletClient, publicClient);
                    if (res.success && res.receipt) {
                        console.log("   ✅ Transaction Confirmed. Parsing logs...");

                        // 3. Client-Side Resolution (Fast path & Fallback)
                        const logs = res.receipt.logs;
                        let foundResult = false;
                        let requestId = null;

                        for (const log of logs) {
                            try {
                                const event = decodeEventLog({ abi: DICEROLLER_ABI, data: log.data, topics: log.topics });
                                if (event.eventName === 'DiceRolled') {
                                    const { result } = event.args;
                                    console.log(`   🎯 Dice Result: ${result}. Notifying Backend...`);
                                    await fetch(`${API_BASE}/resolve`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            gameCode: gameId,
                                            roundId: roundId,
                                            result: Number(result),
                                            txHash: res.hash
                                        })
                                    });
                                    console.log("   ✨ Backend notified of resolution.");
                                    foundResult = true;
                                    break;
                                }
                                if (event.eventName === 'DiceRequested') {
                                    requestId = event.args.requestId;
                                }
                            } catch (e) { /* ignore other events */ }
                        }

                        // Fallback: If no result but requested, Host becomes the Crank
                        if (!foundResult && requestId) {
                            console.log("   🤔 No immediate result. Attempting Host-Side Settlement...");
                            const settleRes = await settleHardenedRoll(requestId, walletClient, publicClient);

                            if (settleRes.success && settleRes.receipt) {
                                for (const log of settleRes.receipt.logs) {
                                    try {
                                        const event = decodeEventLog({ abi: DICEROLLER_ABI, data: log.data, topics: log.topics });
                                        if (event.eventName === 'DiceRolled') {
                                            const { result } = event.args;
                                            console.log(`   🎯 Dice Result (Settled): ${result}. Notifying Backend...`);
                                            await fetch(`${API_BASE}/resolve`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    gameCode: gameId,
                                                    roundId: roundId,
                                                    result: Number(result),
                                                    txHash: settleRes.hash
                                                })
                                            });
                                            console.log("   ✨ Backend notified of resolution.");
                                        }
                                    } catch (e) { /* ignore */ }
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("   ❌ VRF Orchestration Failed:", err);
                vrfInProgress.current = null; // Allow retry or leader handover
            }
        };

        handleVRF();
    }, [gameState?.phase, gameState?.currentRoundId, gameState?.hostId, playerId, walletClient, publicClient, authenticated]);

    // Poll game state
    useEffect(() => {
        if (view !== 'game' || !gameCode || !playerId) return;
        const fetchState = async () => {
            try {
                const res = await fetch(`${API_BASE}/state?gameCode=${gameCode}&playerId=${playerId}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();

                if (data.serverTime) {
                    const newSkew = data.serverTime - Date.now();
                    // Stabilize skew: only update if it shifts by more than 2 seconds or if unset
                    setServerSkew(prev => {
                        if (prev === null) return newSkew;
                        if (Math.abs(newSkew - prev) > 2000) return newSkew;
                        return prev;
                    });
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
            // Host doesn't have playerId yet until they join? 
            // Wait, createGame just sets view to 'create'. 
            // The Host actually "joins" when they enter the "Waiting Room" usually?
            // Checking logic: `createGame` -> `setView('create')`. 
            // Then `CreateGame` component likely has a "Start" or "Join" button?
            // Viewing `CreateGame.jsx` (implied): usually it just shows the code.
            // Actually, `App.jsx` `createGame` just sets `gameCode`.
            // The flow is: Create -> Get Code -> Join (Host auto-joins? No, usually they join explicitly or `CreateGame` handles it).
            // Let's check `CreateGame.jsx` logic later if needed.
            // But usually the host has to JOIN their own game to get a `playerId`.
            // So we only save session in `joinGame` or if `createGame` returns a player ID (it doesn't seems so).
            // `data.gameCode` is returning.
            // If `CreateGame` page forces them to "Join", then `joinGame` will handle the saving.
            // So I will LEAVE this alone for now, and strictly persist in `joinGame`.
            // BUT, if I refresh on 'create' screen, I lose the code.
            // Maybe persisting `gameCode` is enough?
            // The user asked for "access to the match".
            // Let's stick to `joinGame` for full session (Player ID + Game Code).
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
                saveSession(joinCode, data.playerId); // Persist session
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
                    logout={clearSession} // Clear session on logout
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
                onLeave={clearSession} // Pass leave handler
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
