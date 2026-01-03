import { db } from '../src/lib/store.js';
import { generatePlayerId, getPublicState } from '../src/lib/gameLogic.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { gameCode, playerName, avatar, privyId } = req.body;
        if (!gameCode) return res.status(400).json({ error: 'Missing gameCode' });

        const gameState = await db.getGame(gameCode);
        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        if (gameState.phase !== 'waiting') {
            return res.status(400).json({ error: 'Match already in progress' });
        }

        let playerId = privyId || generatePlayerId();

        // Re-join logic
        const existingPlayer = gameState.players.find(p => p.id === playerId);
        if (existingPlayer) {
            existingPlayer.connected = true;
            if (avatar) existingPlayer.avatar = avatar;
            if (playerName) existingPlayer.name = playerName;

            await db.setGame(gameCode, gameState);
            return res.status(200).json({
                success: true,
                playerId,
                gameState: getPublicState(gameState, playerId)
            });
        }

        // New player logic
        const newPlayer = {
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
        await db.trackGame(gameCode);

        res.status(200).json({
            success: true,
            playerId,
            gameState: getPublicState(gameState, playerId)
        });
    } catch (e) {
        console.error('Join API Error:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
}
