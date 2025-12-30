import express from 'express';
import cors from 'cors';
import { db } from './src/lib/store.js';
import { initializeGame, generatePlayerId, getPublicState } from './src/lib/gameLogic.js';

// Import the handlers conceptually, but since they are Vercel-style (req, res), 
// we can either wrap them or just use the logic directly. 
// Using logic directly is cleaner for Express.

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- API ROUTES (Mimicking Vercel logic) ---

app.post('/api/create', async (req, res) => {
    try {
        const { startDelayMinutes } = req.body;
        const gameState = initializeGame(startDelayMinutes || 1);
        await db.setGame(gameState.gameCode, gameState);
        res.json({ success: true, gameCode: gameState.gameCode });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/join', async (req, res) => {
    try {
        const { gameCode, playerName, avatar, privyId } = req.body;
        const gameState = await db.getGame(gameCode);

        if (!gameState) return res.status(404).json({ error: 'Game not found' });
        if (gameState.phase !== 'waiting') {
            return res.status(400).json({ error: 'you got locked out, match already in progress' });
        }

    }

        let playerId;
    let newPlayer;

    // Check if player already in game (re-join)
    const existingPlayer = privyId ? gameState.players.find(p => p.id === privyId) : null;

    if (existingPlayer) {
        playerId = existingPlayer.id;
        existingPlayer.connected = true;
        if (avatar) existingPlayer.avatar = avatar;
        if (playerName) existingPlayer.name = playerName;

        await db.setGame(gameCode, gameState);

        res.json({
            success: true,
            playerId,
            playerNumber: existingPlayer.playerNumber,
            playerName: existingPlayer.name,
            gameState: getPublicState(gameState, playerId)
        });
        return;
    }

    playerId = privyId || generatePlayerId();
    newPlayer = {
        id: playerId,
        playerNumber: gameState.players.length,
        name: playerName || `Player ${gameState.players.length + 1}`,
        cards: [
            { value: 1, isBurned: false },
            { value: 2, isBurned: false },
            { value: 3, isBurned: false }
        ],
        credits: 0,
        firstCorrectRound: null,
        connected: true,
        avatar: avatar || null
    };

    gameState.players.push(newPlayer);
    gameState.joinedCount++;

    await db.setGame(gameCode, gameState);
    res.json({
        success: true,
        playerId,
        playerNumber: newPlayer.playerNumber,
        playerName: newPlayer.name,
        gameState: getPublicState(gameState, playerId)
    });
} catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal Server Error' });
}
});

app.post('/api/commit', async (req, res) => {
    try {
        const { gameCode, playerId, card, skip } = req.body;
        const gameState = await db.getGame(gameCode);

        if (!gameState || gameState.phase !== 'commit') return res.status(400).json({ error: 'Invalid state' });

        const player = gameState.players.find(p => p.id === playerId);
        if (!player) return res.status(400).json({ error: 'Invalid player' });

        if (skip) {
            gameState.commitments[playerId] = { card: null, skip: true };
        } else {
            const availableCard = player.cards.find(c => c.value === card && !c.isBurned);
            if (!availableCard) return res.status(400).json({ error: 'Invalid card' });
            gameState.commitments[playerId] = { card, skip: false };
        }

        // Check for game end and process stats if needed
        if (gameState.phase === 'ended') {
            gameState = await db.processGameStats(gameState);
        }

        await db.setGame(gameCode, gameState);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/state', async (req, res) => {
    try {
        const { gameCode, playerId } = req.query;
        const gameState = await db.getGame(gameCode);

        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        const publicState = getPublicState(gameState, playerId);

        // Save back any auto-updates
        // Check for game end and process stats if needed
        if (gameState.phase === 'ended') {
            gameState = await db.processGameStats(gameState);
        }

        await db.setGame(gameCode, gameState);

        res.json(publicState);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await db.getLeaderboard();
        res.json(leaderboard);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`🎲 Local Dev Server running on http://localhost:${PORT}`);
    console.log(`   (Mimicking Vercel Serverless environment)`);
});
