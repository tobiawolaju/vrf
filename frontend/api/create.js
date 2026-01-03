import { db } from '../src/lib/store.js';
import { initializeGame } from '../src/lib/gameLogic.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { startDelayMinutes } = req.body;
        const gameState = initializeGame(startDelayMinutes || 1);

        await db.setGame(gameState.gameCode, gameState);
        await db.trackGame(gameState.gameCode);

        res.status(200).json({ success: true, gameCode: gameState.gameCode });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
