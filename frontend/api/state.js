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

        // RECOVERY MECHANISM (For Serverless Timeouts)
        // If we are 'rolling' for more than 5 seconds, the background 'Oracle' probably died.
        // We use this poll to retry the submission.
        if (gameState.phase === 'rolling' && gameState.rollRequestedTime) {
            const now = Date.now();
            const elapsed = now - gameState.rollRequestedTime;

            // Retry every 5 seconds if still stuck (but stop after 30s watchdog handles it)
            if (elapsed > 5000 && elapsed < 30000) {
                // Simple specific check to avoid spamming: only retry if NOT retrying recently?
                // For simplicity, we just try. The nonce management in wallet might get tricky if spamming,
                // but single-user polling is manageable.

                // Only retry if we haven't tried in the last 5 seconds (store retry time?)
                // Or just rely on the race - if one succeeds, state changes.
                const lastRetry = gameState.lastRetryTime || 0;
                if (now - lastRetry > 8000) {
                    console.warn(`⚠️ [Vercel] Detected Stale Roll (${Math.floor(elapsed / 1000)}s). Retrying...`);
                    gameState.lastRetryTime = now;
                    await db.setGame(gameCode, gameState);

                    // Import dynamically to avoid top-level issues if circular? No, standard import is fine.
                    const { retryFulfillment } = await import('../src/lib/vrf.js');
                    retryFulfillment(gameCode, gameState.round, db).catch(e => console.error(e));
                }
            }
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
