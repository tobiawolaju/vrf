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
        const result = await rollDice(gameCode, gameState.round || 1, db);

        // Manual sync: rollDice returns the result, but doesn't necessarily 
        // update the game state in KV as the background listener would.
        // Let's update it here for immediate feedback if the listener is inactive.
        gameState.lastRoll = result.result;
        gameState.lastRollTxHash = result.txHash;
        gameState.phase = 'resolve';
        gameState.resolveDeadline = Date.now() + 5000;

        // Apply scores (same logic as server.js listener)
        gameState.players.forEach(p => {
            const commitment = gameState.commitments[p.id];
            if (commitment && commitment.card === gameState.lastRoll) {
                p.credits += 1;
            } else if (commitment && !commitment.skip) {
                const cardIdx = p.cards.findIndex(c => c.value === commitment.card && !c.isBurned);
                if (cardIdx > -1) p.cards[cardIdx].isBurned = true;
            }
        });

        await db.setGame(gameCode, gameState);

        res.status(200).json(result);
    } catch (e) {
        console.error("Vercel debug-roll error:", e);
        res.status(500).json({ error: e.message });
    }
}
