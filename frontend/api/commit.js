import { db } from '../src/lib/store.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { gameCode, playerId, card, skip } = req.body;
        if (!gameCode || !playerId) return res.status(400).json({ error: 'Missing parameters' });

        const gameState = await db.getGame(gameCode);
        if (!gameState || gameState.phase !== 'commit') {
            return res.status(400).json({ error: 'Invalid game state or phase' });
        }

        const player = gameState.players.find(p => p.id === playerId);
        if (!player) return res.status(400).json({ error: 'Player not found in this game' });

        if (skip) {
            gameState.commitments[playerId] = { card: null, skip: true };
        } else {
            const availableCard = player.cards.find(c => c.value === card && !c.isBurned);
            if (!availableCard) return res.status(400).json({ error: 'Card not available or already burned' });
            gameState.commitments[playerId] = { card, skip: false };
        }

        await db.setGame(gameCode, gameState);
        res.status(200).json({ success: true });
    } catch (e) {
        console.error('Commit API Error:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
}
