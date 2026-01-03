import express from 'express';
import cors from 'cors';
import { db } from './src/lib/store.js';
import { initializeGame, generatePlayerId, getPublicState, resolveRound } from './src/lib/gameLogic.js';
import { DICEROLLER_ABI } from './src/lib/vrf.js';
import { createPublicClient, createWalletClient, http, decodeEventLog, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- BLOCKCHAIN CONFIG (Crank Indexer) ---
const CONTRACT_ADDRESS = "0x131e56853F087F74Dbd59f7c6581cd57201a5f34";
const PYTH_ENTROPY_ADDRESS = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603";
const PYTH_PROVIDER = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344";

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
const roundSecrets = new Map(); // roundId -> userReveal
const pendingSequences = new Map(); // sequenceNumber -> roundId

const PYTH_ABI = [
    {
        "type": "function",
        "name": "revealWithCallback",
        "inputs": [
            { "name": "provider", "type": "address" },
            { "name": "sequenceNumber", "type": "uint64" },
            { "name": "userReveal", "type": "bytes32" },
            { "name": "providerReveal", "type": "bytes32" }
        ],
        "outputs": [],
        "stateMutability": "payable"
    }
];

/**
 * Crank Worker: Polls Pyth Hermes and reveals
 */
async function processReveal(sequenceNumber, roundId) {
    if (!crankWallet) return;

    // 1. Check local memory first, then DB
    let userReveal = roundSecrets.get(roundId);
    if (!userReveal) {
        userReveal = await db.getSecret(roundId);
    }

    if (!userReveal) {
        console.log(`   ⏳ Waiting for user secret for round ${roundId}...`);
        return;
    }

    try {
        console.log(`🔓 [Crank] Fulfilling Round ${roundId} (Seq: ${sequenceNumber})...`);

        // 1. Fetch from Pyth Hermes
        const res = await fetch(`https://hermes.pyth.network/v2/entropy/ops/reveal?sequence_number=${sequenceNumber}`);
        if (!res.ok) throw new Error("Pyth reveal not ready yet");

        const data = await res.json();
        const providerReveal = data.provider_reveal;

        // 2. Transact
        const hash = await crankWallet.writeContract({
            address: PYTH_ENTROPY_ADDRESS,
            abi: PYTH_ABI,
            functionName: 'revealWithCallback',
            args: [PYTH_PROVIDER, BigInt(sequenceNumber), userReveal, providerReveal],
            account: crankWallet.account
        });

        console.log(`   ✅ Crank reveal TX sent: ${hash}`);
        roundSecrets.delete(roundId); // Cleanup
        pendingSequences.delete(sequenceNumber);

        // Also cleanup DB if possible (background)
        db.setSecret(roundId, null).catch(() => { });
    } catch (e) {
        // Silent fail (will retry on next event or via interval)
        const msg = e.message;
        if (!msg.includes("not ready")) console.error(`   ❌ Crank Error:`, msg);
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
                        const { roundId, sequenceNumber } = event.args;
                        console.log(`🎲 [Log] DiceRequested: Round ${roundId} | Seq ${sequenceNumber}`);
                        pendingSequences.set(Number(sequenceNumber), roundId.toString());

                        // Try to process immediately if secret already arrived
                        processReveal(Number(sequenceNumber), roundId.toString());
                    }

                    if (event.eventName === 'DiceRolled') {
                        const { roundId, result } = event.args;
                        const txHash = log.transactionHash;
                        console.log(`🏁 [Log] DiceRolled: Round ${roundId} | Result ${result}`);

                        const games = await db.getAllGames() || [];
                        for (const game of games) {
                            if (game.currentRoundId === roundId.toString() && game.phase === 'rolling') {
                                console.log(`   ✅ Resolving Game ${game.gameCode} with result ${result}`);
                                resolveRound(game, result, txHash);
                                await db.setGame(game.gameCode, game);
                                break;
                            }
                        }
                    }
                } catch (e) { /* ignore */ }
            }
        }
    });

    // Periodic Crank: Check any pending sequences every 10s
    setInterval(() => {
        for (const [seq, roundId] of pendingSequences.entries()) {
            processReveal(seq, roundId);
        }
    }, 10000);
}

setupContractListener();

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

        if (gameState.phase === 'commit' && Date.now() > gameState.commitDeadline) {
            gameState.phase = 'rolling';
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
    console.log(`🎲 Hardened Game Server + Crank running on port ${PORT}`);
});
