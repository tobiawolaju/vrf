import { db } from '../src/lib/store.js';
import { resolveRound } from '../src/lib/gameLogic.js';

export default async function handler(req, res) {
    // Enable CORS manually if needed (Vercel usually handles this, but good to be safe for cross-origin if configured)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { gameCode, result, txHash } = req.body;
        if (!gameCode || result === undefined) {
            return res.status(400).json({ error: 'Missing data' });
        }

        console.log(`📡 [API] Direct Resolution Request: Game ${gameCode} | Result ${result}`);

        const game = await db.getGame(gameCode);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Only resolve if we are in the correct phase
        if (game.phase === 'rolling') {
            resolveRound(game, result, txHash);
            await db.setGame(gameCode, game);
            console.log(`   ✨ Game ${gameCode} resolved via API push.`);
        } else {
            console.log(`   ⚠️ Game ${gameCode} ignored resolve request (Phase: ${game.phase})`);
        }

        res.status(200).json({ success: true });
    } catch (e) {
        console.error("❌ API Resolve Error:", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
