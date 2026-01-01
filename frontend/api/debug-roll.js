import { db } from '../src/lib/store.js';
import { rollDice } from '../src/lib/vrf.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { gameCode } = req.body;
        const gameState = await db.getGame(gameCode);

        if (!gameState) {
            return res.status(404).json({ error: 'Game not found' });
        }

        console.log(`🛠️ [Vercel DEBUG] Manual Roll Triggered for ${gameCode}`);

        // Execute the full on-chain roll synchronously
        // Note: Vercel hobby tier has a 10s timeout, but Pro has 60s.
        // If this exceeds 10s, it might fail. But for a debug button it's worth it.
        // rollDice now internally calls resolveRound and updates the DB.
        const result = await rollDice(gameCode, gameState.round || 1, db);

        res.status(200).json(result);
    } catch (e) {
        console.error("Vercel debug-roll error:", e);
        res.status(500).json({ error: e.message });
    }
}
