import { db } from '../src/lib/store.js';
import { generatePlayerId, getPublicState } from '../src/lib/gameLogic.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { gameCode, playerName, avatar } = req.body;
        const gameState = await db.getGame(gameCode);

        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        // Note: Strict timing check is done in getPublicState/checkTimeouts, 
        // but for joining we might want to block if "effectively" started.
        // We defer to checkTimeouts logic which will set phase/round if time has passed.
        // Since we didn't run checkTimeouts immediately here, we might let them "join" 
        // and then they see the game has started.
        if (gameState.phase !== 'waiting') {
            return res.status(400).json({ error: 'you got locked out, match already in progress' });
        }

        const playerId = generatePlayerId();
        const newPlayer = {
            id: playerId,
            playerNumber: gameState.players.length,
            name: playerName || `Player ${gameState.players.length + 1}`,
            cards: [
                { value: 1, isBurned: false },
                { value: 2, isBurned: false },
                { value: 3, isBurned: false }
            ],
            credits: 0,
            firstCorrectRound: null,
            connected: true,
            avatar: avatar || null
        };

        gameState.players.push(newPlayer);
        gameState.joinedCount++;

        await db.setGame(gameCode, gameState);

        res.status(200).json({
            success: true,
            playerId,
            playerNumber: newPlayer.playerNumber,
            playerName: newPlayer.name,
            gameState: getPublicState(gameState, playerId)
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
