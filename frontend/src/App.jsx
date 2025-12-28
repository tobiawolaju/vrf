import { useState, useEffect } from 'react';
import './App.css';
import { usePrivy } from '@privy-io/react-auth';

// Pages
import Home from './pages/Home';
import CreateGame from './pages/CreateGame';
import JoinGame from './pages/JoinGame';
import WaitingRoom from './pages/WaitingRoom';
import Gameplay from './pages/Gameplay';

const API_BASE = '/api';

function App() {
    const { login, authenticated, user } = usePrivy();
    const [view, setView] = useState('home');
    const [gameCode, setGameCode] = useState('');
    const [playerId, setPlayerId] = useState('');
    const [playerName, setPlayerName] = useState('');
    const [gameState, setGameState] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [resolveTimeLeft, setResolveTimeLeft] = useState(0);
    const [waitTimeLeft, setWaitTimeLeft] = useState(0);
    const [serverSkew, setServerSkew] = useState(0);
    const [startDelay, setStartDelay] = useState(1); // Default 1 min
    const [joinCode, setJoinCode] = useState('');
    const [joinPlayerName, setJoinPlayerName] = useState('');
    const [selectedCard, setSelectedCard] = useState(null);
    const [playerAvatar, setPlayerAvatar] = useState('😊');

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
            } else if (gameState.phase === 'commit' && typeof gameState.commitDeadline === 'number') {
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
        if (gameState?.phase === 'resolve' && gameState.lastRoll) {
            setIsRolling(true);
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
        } else if (gameState?.phase !== 'resolve') {
            setIsRolling(false);
        }
    }, [gameState?.phase, gameState?.lastRoll]);

    const createGame = async () => {
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
        if (!joinPlayerName.trim() && !authenticated) {
            alert('Please enter your name or log in');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameCode: joinCode,
                    playerName: joinPlayerName,
                    avatar: playerAvatar,
                    privyId: authenticated ? user.id : null,
                    privyUser: authenticated ? user : null
                })
            });
            const data = await res.json();
            if (data.success) {
                setGameCode(joinCode);
                setPlayerId(data.playerId);
                setPlayerName(data.playerName);
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
    if (view === 'home') {
        return <Home startDelay={startDelay} setStartDelay={setStartDelay} createGame={createGame} setView={setView} />;
    }

    if (view === 'create') {
        return <CreateGame gameCode={gameCode} startDelay={startDelay} setView={setView} setJoinCode={setJoinCode} copyToClipboard={copyToClipboard} />;
    }

    if (view === 'join') {
        return (
            <JoinGame
                joinCode={joinCode}
                setJoinCode={setJoinCode}
                joinPlayerName={joinPlayerName}
                setJoinPlayerName={setJoinPlayerName}
                playerAvatar={playerAvatar}
                setPlayerAvatar={setPlayerAvatar}
                joinGame={joinGame}
                setView={setView}
                // Auth props
                login={login}
                authenticated={authenticated}
                user={user}
            />
        );
    }

    // GAME VIEW
    if (!gameState) return <div className="app"><div className="loading">Connecting...</div></div>;

    const currentPlayer = gameState.currentPlayer;

    // WAITING ROOM
    if (gameState.phase === 'waiting') {
        return <WaitingRoom gameState={gameState} waitTimeLeft={waitTimeLeft} gameCode={gameCode} />;
    }

    // MAIN GAMEPLAY
    return (
        <Gameplay
            gameState={gameState}
            currentPlayer={currentPlayer}
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
}

export default App;
