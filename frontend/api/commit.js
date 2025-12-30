import { db } from '../src/lib/store.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

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
        res.status(200).json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
