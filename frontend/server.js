import express from 'express';
import cors from 'cors';
import { db } from './src/lib/store.js';
import { initializeGame, generatePlayerId, getPublicState, resolveRound } from './src/lib/gameLogic.js';
import { DICEROLLER_ABI } from './src/lib/vrf.js';
import { createPublicClient, http, decodeEventLog } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- BLOCKCHAIN CONFIG (Read-Only) ---
const CONTRACT_ADDRESS = "0x131e56853F087F74Dbd59f7c6581cd57201a5f34";

const monadMainnet = {
    id: 143,
    name: 'Monad Mainnet',
    network: 'monad-mainnet',
    nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
    rpcUrls: {
        default: { http: [process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com'] },
        public: { http: [process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com'] },
    },
};

const client = createPublicClient({
    chain: monadMainnet,
    transport: http(),
});

/**
 * @notice Read-Only Indexer
 * Listens for DiceRequested to map roundId -> gameCode
 * Listens for DiceRolled to resolve rounds in the DB
 */
const roundToGame = new Map();

function setupContractListener() {
    console.log(`📡 Indexer: Watching ${CONTRACT_ADDRESS} for VRF events...`);

    client.watchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: DICEROLLER_ABI,
        onLogs: async (logs) => {
            for (const log of logs) {
                try {
                    const event = decodeEventLog({
                        abi: DICEROLLER_ABI,
                        data: log.data,
                        topics: log.topics
                    });

                    if (event.eventName === 'DiceRequested') {
                        const { roundId } = event.args;
                        console.log(`🎲 [Log] DiceRequested: Round ${roundId}`);
                        // In a real app, we'd persist this mapping.
                        // For simplicity, we assume the game state contains the roundId.
                    }

                    if (event.eventName === 'DiceRolled') {
                        const { roundId, result } = event.args;
                        const txHash = log.transactionHash;
                        console.log(`🏁 [Log] DiceRolled: Round ${roundId} | Result ${result}`);

                        // Find the game tied to this roundId
                        // Since multiple games might be active, we scan the DB or use a mapping
                        // For this demo, we'll try to find an active game where game.roundId == roundId
                        const games = await db.getAllGames?.() || []; // Helper needed
                        for (const game of games) {
                            if (game.currentRoundId === roundId.toString()) {
                                console.log(`   ✅ Resolving Game ${game.gameCode} with result ${result}`);
                                resolveRound(game, result, txHash);
                                await db.setGame(game.gameCode, game);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore non-dice events
                }
            }
        }
    });
}

setupContractListener();

// --- API ROUTES ---

app.post('/api/create', async (req, res) => {
    try {
        const { startDelayMinutes } = req.body;
        const gameState = initializeGame(startDelayMinutes || 1);
        await db.setGame(gameState.gameCode, gameState);
        res.json({ success: true, gameCode: gameState.gameCode });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/join', async (req, res) => {
    try {
        const { gameCode, playerName, avatar, privyId, twitterHandle } = req.body;
        const gameState = await db.getGame(gameCode);

        if (!gameState) return res.status(404).json({ error: 'Game not found' });
        if (gameState.phase !== 'waiting') return res.status(400).json({ error: 'Match already in progress' });

        let playerId = privyId || generatePlayerId();
        const existingPlayer = gameState.players.find(p => p.id === playerId);

        if (existingPlayer) {
            existingPlayer.connected = true;
            await db.setGame(gameCode, gameState);
            return res.json({
                success: true,
                playerId,
                gameState: getPublicState(gameState, playerId)
            });
        }

        const newPlayer = {
            id: playerId,
            playerNumber: gameState.players.length,
            name: playerName || `Player ${gameState.players.length + 1}`,
            cards: [{ value: 1, isBurned: false }, { value: 2, isBurned: false }, { value: 3, isBurned: false }],
            credits: 0,
            connected: true,
            avatar: avatar || null
        };

        gameState.players.push(newPlayer);
        gameState.joinedCount++;

        await db.setGame(gameCode, gameState);
        res.json({
            success: true,
            playerId,
            gameState: getPublicState(gameState, playerId)
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/commit', async (req, res) => {
    try {
        const { gameCode, playerId, card, skip } = req.body;
        const gameState = await db.getGame(gameCode);

        if (!gameState || gameState.phase !== 'commit') return res.status(400).json({ error: 'Invalid state' });

        const player = gameState.players.find(p => p.id === playerId);
        if (!player) return res.status(400).json({ error: 'Invalid player' });

        gameState.commitments[playerId] = skip ? { card: null, skip: true } : { card, skip: false };

        await db.setGame(gameCode, gameState);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/state', async (req, res) => {
    try {
        const { gameCode, playerId } = req.query;
        const gameState = await db.getGame(gameCode);

        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        // Phase Transition Logic (Read-Only State Management)
        if (gameState.phase === 'commit' && Date.now() > gameState.commitDeadline) {
            console.log(`🚀 [GAME] Deadline reached for ${gameCode}. Moving to 'rolling'.`);
            gameState.phase = 'rolling';
            // Generate a roundId for this roll if not present
            if (!gameState.currentRoundId) {
                gameState.currentRoundId = Date.now().toString();
            }
            await db.setGame(gameCode, gameState);
        }

        res.json(getPublicState(gameState, playerId));
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`🎲 Trust-Minimal Game Server running on port ${PORT}`);
});
