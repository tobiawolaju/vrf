import { db } from '../src/lib/store.js';
import { getPublicState } from '../src/lib/gameLogic.js';
import { executeOnChainRoll } from '../src/lib/vrf.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { gameCode, playerId } = req.query;
        const gameState = await db.getGame(gameCode);

        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        // TRIGGER ON-CHAIN ROLL IF NEEDED
        if (gameState.phase === 'commit' && Date.now() > gameState.commitDeadline && !gameState.rollRequested) {
            console.log(`🚀 [Vercel] Triggering Roll for ${gameCode}...`);
            gameState.rollRequested = true;
            gameState.phase = 'rolling';
            await db.setGame(gameCode, gameState);

            // Trigger in background (Vercel has limited execution time)
            executeOnChainRoll(gameCode, gameState.round, db).catch(err => {
                console.error(`❌ [Vercel] Background Roll Failed for ${gameCode}:`, err.message);
            });
        }

        const publicState = getPublicState(gameState, playerId);

        // Update stats if game ended
        if (publicState.phase === 'ended' && !gameState.statsUpdated) {
            const winner = publicState.winner;
            if (winner) {
                await db.updateGameStats(gameState, winner.id);
                gameState.statsUpdated = true;
            }
        }

        await db.setGame(gameCode, gameState);
        res.status(200).json(publicState);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
