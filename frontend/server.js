import express from 'express';
import cors from 'cors';
import { db } from './src/lib/store.js';
import { initializeGame, generatePlayerId, getPublicState, resolveRound } from './src/lib/gameLogic.js';
import { createPublicClient, createWalletClient, http, decodeEventLog, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- BLOCKCHAIN CONFIG (Crank Indexer) ---
import { DICEROLLER_ABI, CONTRACT_ADDRESS, SWITCHBOARD_CROSSBAR_URL } from './src/lib/vrf.js';
// Note: CONTRACT_ADDRESS is now 0xc0c6c5d63ACed3bD7Dd85ef2e89FFE0464A7660d (Simulated)

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

const publicClient = createPublicClient({ chain: monadMainnet, transport: http() });

// Crank Wallet for Permissionless Reveal (Requires MON for gas)
let crankWallet = null;
if (process.env.ADMIN_PRIVATE_KEY) {
    const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY);
    crankWallet = createWalletClient({
        account,
        chain: monadMainnet,
        transport: http(),
    });
    console.log(`🤖 Crank initialized: ${account.address}`);
} else {
    console.warn("⚠️ ADMIN_PRIVATE_KEY not set. Backend cannot auto-reveal rolls.");
}

// Memory stores for orchestration
const pendingRequests = new Map(); // requestId -> roundId

/**
 * Switchboard Crank: Polls Switchboard Crossbar and settles
 */
async function processSwitchboardCrank(requestId, roundId) {
    if (!crankWallet) return;

    try {
        console.log(`🔓 [Crank] Fulfilling Switchboard Round ${roundId} (Req: ${requestId})...`);

        // 1. Fetch proof from Switchboard Crossbar
        const url = `${SWITCHBOARD_CROSSBAR_URL}/updates/eth/randomness?ids=${requestId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Switchboard proof not ready yet");

        const data = await res.json();
        // Crossbar returns an array of updates/proofs
        if (!data || !data.updates || data.updates.length === 0) {
            throw new Error("No updates found in Crossbar response");
        }

        const proof = data.updates[0];

        // 2. Transact settleAndFulfill
        const hash = await crankWallet.writeContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'settleAndFulfill',
            args: [proof, requestId],
            account: crankWallet.account
        });

        console.log(`   ✅ Crank fulfill TX sent: ${hash}`);
        pendingRequests.delete(requestId);
    } catch (e) {
        const msg = e.message;
        if (!msg.includes("not ready")) {
            console.error(`   ❌ Switchboard Crank Error:`, msg);
        }
    }
}

function setupContractListener() {
    console.log(`📡 Indexer: Watching ${CONTRACT_ADDRESS} for VRF events...`);

    publicClient.watchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: DICEROLLER_ABI,
        onLogs: async (logs) => {
            for (const log of logs) {
                try {
                    const event = decodeEventLog({ abi: DICEROLLER_ABI, data: log.data, topics: log.topics });

                    if (event.eventName === 'DiceRequested') {
                        const { roundId, requestId } = event.args;
                        console.log(`🎲 [Log] DiceRequested: Round ${roundId} | ID: ${requestId}`);
                        pendingRequests.set(requestId, roundId.toString());

                        // Try to process immediately
                        processSwitchboardCrank(requestId, roundId.toString());
                    }

                    if (event.eventName === 'DiceRolled') {
                        const { roundId, result, gameId } = event.args;
                        const txHash = log.transactionHash;
                        console.log(`🏁 [Viem] DiceRolled Detected: Round ${roundId} | Result ${result} | Game ${gameId}`);

                        const game = await db.getGame(gameId);
                        if (!game) {
                            console.warn(`   ⚠️  Received DiceRolled for unknown game: ${gameId}`);
                            continue;
                        }

                        console.log(`   ✅ Resolving Game ${gameId} (Current Phase: ${game.phase})`);
                        resolveRound(game, result, txHash);
                        await db.setGame(gameId, game);
                        console.log(`   ✨ Game ${gameId} advanced to 'resolve' phase.`);
                    }
                } catch (e) {
                    console.error("❌ Indexer Event Processing Error:", e);
                }
            }
        }
    });
}

// --- CRANK WORKERS ---

/**
 * Game State Crank: Handles timeouts and phase transitions for all active games.
 * This is the central authority to avoid distributed flickering.
 */
async function processGameCrank() {
    try {
        const { checkTimeouts } = await import('./src/lib/gameLogic.js');
        const games = await db.getAllGames();

        for (const game of games) {
            const originalState = JSON.stringify(game);

            // 1. Check for standard timeouts (resolve -> commit, waiting -> commit)
            checkTimeouts(game);

            // 2. Custom Hardened Transition: commit -> rolling
            if (game.phase === 'commit' && Date.now() > game.commitDeadline) {
                game.phase = 'rolling';
                if (!game.currentRoundId) {
                    game.currentRoundId = Date.now().toString();
                }
            }

            // 3. Persist if state changed
            if (JSON.stringify(game) !== originalState) {
                console.log(`⚙️ [Crank] Advancing Game ${game.gameCode} to ${game.phase} phase`);
                await db.setGame(game.gameCode, game);
            }
        }
    } catch (e) {
        console.error("❌ Game Crank Error:", e.message);
    }
}

// Start Listeners
setupContractListener();

// Periodic Crank Loops
setInterval(processGameCrank, 2000); // Check games every 2s
setInterval(() => {
    for (const [reqId, roundId] of pendingRequests.entries()) {
        processSwitchboardCrank(reqId, roundId);
    }
}, 5000); // Check reveals every 5s

// --- API ROUTES ---

/**
 * Secret Submission: Players POST their bound secret here after committing.
 */
app.post('/api/submit-secret', async (req, res) => {
    const { roundId, userReveal } = req.body;
    if (!roundId || !userReveal) return res.status(400).json({ error: 'Missing data' });

    console.log(`🔑 [API] Secret shared for round ${roundId}`);
    roundSecrets.set(roundId.toString(), userReveal);

    // Check if we already have a pending sequence for this round
    for (const [seq, rid] of pendingSequences.entries()) {
        if (rid === roundId) {
            processReveal(seq, rid);
            break;
        }
    }

    res.json({ success: true });
});

app.post('/api/create', async (req, res) => {
    try {
        const { startDelayMinutes } = req.body;
        const gameState = initializeGame(startDelayMinutes || 1);
        await db.setGame(gameState.gameCode, gameState);
        await db.trackGame(gameState.gameCode);
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
            return res.json({ success: true, playerId, gameState: getPublicState(gameState, playerId) });
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
        res.json({ success: true, playerId, gameState: getPublicState(gameState, playerId) });
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

        res.json(getPublicState(gameState, playerId));
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`🎲 Hardened Game Server + Crank running on port ${PORT}`);
});
