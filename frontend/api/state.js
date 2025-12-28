import { db } from '../src/lib/store.js';
import { getPublicState } from '../src/lib/gameLogic.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { gameCode, playerId } = req.query;
        const gameState = await db.getGame(gameCode);

        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        const publicState = getPublicState(gameState, playerId);

        // Since getPublicState might modify state (checkTimeouts), we should save it back
        await db.setGame(gameCode, gameState);

        res.status(200).json(publicState);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
