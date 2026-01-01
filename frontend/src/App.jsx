import { useState, useEffect } from 'react';
import './App.css';
import { usePrivy } from '@privy-io/react-auth';
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

    // Animation states
    const [visualRoll, setVisualRoll] = useState(1);
    const [isRolling, setIsRolling] = useState(false);

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
        if (gameState?.phase === 'rolling' || (gameState?.phase === 'resolve' && gameState.lastRoll)) {
            setIsRolling(true);

            // For 'rolling' phase, we just keep shuffling indefinitely or until phase changes
            // For 'resolve' phase, we finish the shuffle and show the result
            if (gameState.phase === 'resolve' && gameState.lastRoll) {
                let shuffleCount = 0;
                const maxShuffles = 45; // 4.5 seconds at 100ms interval

                const shuffleInterval = setInterval(() => {
                    setVisualRoll(Math.floor(Math.random() * 3) + 1);
                    shuffleCount++;

                    if (shuffleCount >= maxShuffles) {
                        clearInterval(shuffleInterval);
                        setVisualRoll(gameState.lastRoll);
                        setIsRolling(false);
                    }
                }, 100);

                return () => clearInterval(shuffleInterval);
            } else {
                // Persistent shuffle for 'rolling' phase
                const shuffleInterval = setInterval(() => {
                    setVisualRoll(Math.floor(Math.random() * 3) + 1);
                }, 100);
                return () => clearInterval(shuffleInterval);
            }
        } else if (gameState?.phase !== 'resolve' && gameState?.phase !== 'rolling') {
            setIsRolling(false);
        }
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
