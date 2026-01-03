import { db } from '../src/lib/store.js';
import { getPublicState } from '../src/lib/gameLogic.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { gameCode, playerId } = req.query;
        if (!gameCode) return res.status(400).json({ error: 'Missing gameCode' });

        const gameState = await db.getGame(gameCode);
        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        const publicState = getPublicState(gameState, playerId);

        // Update stats if game ended and not already recorded
        if (publicState.phase === 'ended' && !gameState.statsUpdated) {
            const winner = publicState.winner;
            if (winner) {
                await db.updateGameStats(gameState, winner.id);
                gameState.statsUpdated = true;
                await db.setGame(gameCode, gameState);
            }
        }

        res.status(200).json(publicState);
    } catch (e) {
        console.error('State API Error:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
}
