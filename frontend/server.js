import express from 'express';
import cors from 'cors';
import { db } from './src/lib/store.js';
import { initializeGame, generatePlayerId, getPublicState } from './src/lib/gameLogic.js';
import { createWalletClient, http, publicActions, getContract, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- BLOCKCHAIN CONFIG ---

// Minimal ABI
const DICEROLLER_ABI = [
    {
        "type": "function",
        "name": "requestDiceRoll",
        "inputs": [{ "name": "roundId", "type": "uint256" }],
        "outputs": [{ "name": "", "type": "bytes32" }],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "DiceRolled",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "result", "type": "uint8", "indexed": false }
        ],
        "anonymous": false
    }
];

const CONTRACT_ADDRESS = process.env.DICEROLLER_ADDRESS || "0x0000000000000000000000000000000000000000"; // Update after deploy

// Admin Wallet (The Backend Relayer)
let adminWallet = null;
let contract = null;

if (process.env.ADMIN_PRIVATE_KEY) {
    try {
        // Define Monad Mainnet chain
        const monadMainnet = {
            id: 41454,
            name: 'Monad Mainnet',
            network: 'monad-mainnet',
            nativeCurrency: {
                decimals: 18,
                name: 'Monad',
                symbol: 'MON',
            },
            rpcUrls: {
                default: { http: [process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com'] },
                public: { http: [process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com'] },
            },
            blockExplorers: {
                default: { name: 'Monad Explorer', url: 'https://monadexplorer.com' },
            },
        };

        const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY);
        adminWallet = createWalletClient({
            account,
            chain: monadMainnet,
            transport: http(),
        }).extend(publicActions);

        console.log(`🔗 Connected to Monad as ${account.address}`);

        contract = getContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            client: adminWallet
        });

        setupContractListener();
    } catch (e) {
        console.error("❌ Failed to setup blockchain connection:", e.message);
    }
} else {
    console.warn("⚠️ ADMIN_PRIVATE_KEY not set. Blockchain features disabled.");
}

async function executeOnChainRoll(gameCode, roundNumber) {
    if (!contract) {
        console.warn("Blockchain not connected. Simulating roll (Fallback).");
        // Fallback or Error? For Migration, let's error to force config.
        throw new Error("Blockchain not configured");
    }

    // Generate a unique integer roundId. 
    // Simple hash of gameCode + roundNumber? 
    // Or just use a mapping in DB? simplified:
    // We'll trust the gameCode is unique enough, but roundId is uint256. 
    // Let's hash it: BigInt(keccak256(gameCode + round))
    // For now, let's just use a large random request ID or mapped ID.
    // Actually, simple way: ASCII bytes of gameCode + round padded?
    // Let's use a numeric hash.

    // Hash gameCode (string) + round (int) -> uint256
    const uniqueString = `${gameCode}-${roundNumber}-${Date.now()}`; // Add timestamp to avoid collisions on replay?
    // Actually Contract prevents replay of same roundId. 
    // So we should be deterministic per round IF we want idempotency.
    // But development... let's use timestamp to be safe.

    // Simple numeric hash for uint256
    let hash = 0;
    for (let i = 0; i < uniqueString.length; i++) {
        hash = ((hash << 5) - hash) + uniqueString.charCodeAt(i);
        hash |= 0;
    }
    const roundId = BigInt(Math.abs(hash) + Date.now()); // Ensure positive and basically unique

    // Store map of roundId -> gameCode to resolve later
    // We can store this in memory or DB.
    global.pendingRolls = global.pendingRolls || new Map();
    global.pendingRolls.set(roundId.toString(), { gameCode, roundNumber });

    console.log(`🎲 Requesting Roll on-chain for ${gameCode} (Round ${roundNumber}) - ID: ${roundId}`);

    const tx = await contract.write.requestDiceRoll([roundId]);
    console.log(`   Tx Hash: ${tx}`);

    return { txHash: tx, roundId: roundId.toString() };
}

function setupContractListener() {
    if (!contract) return;

    console.log("👂 Listening for DiceRolled events...");

    contract.watchEvent.DiceRolled({}, {
        onLogs: async (logs) => {
            for (const log of logs) {
                const roundId = log.args.roundId.toString();
                const result = log.args.result;
                const txHash = log.transactionHash;

                console.log(`⚡ Event: DiceRolled | ID: ${roundId} | Result: ${result}`);

                // Find game
                const pending = global.pendingRolls ? global.pendingRolls.get(roundId) : null;

                if (pending) {
                    const { gameCode } = pending;
                    const gameState = await db.getGame(gameCode);
                    if (gameState) {
                        // RESOLVE GAME
                        gameState.lastRoll = Number(result);
                        gameState.lastRollTxHash = txHash;
                        gameState.round = pending.roundNumber; // Sync round number
                        gameState.rollRequested = false;      // Reset flag

                        // Apply Game Logic (Simplified here, usually in gameLogic.js or handleResolve)
                        // Note: We need to trigger the resolution phase logic here.
                        // Assuming we have a 'resolveRound(gameState)' function?
                        // We likely need to import logic to calculate winners.
                        // For now, let's just save the roll and let the next poll/tick handle it?
                        // Or better, actively resolve it.

                        // Let's assume there is a resolve function or we do it here.
                        // The prompt says "resolves rounds using on-chain results".
                        // We'll update state and let frontend poll it.

                        gameState.phase = 'resolve';
                        gameState.resolveDeadline = Date.now() + 5000; // 5s to show result

                        // Update player scores
                        gameState.players.forEach(p => {
                            const commitment = gameState.commitments[p.id];
                            if (commitment && commitment.card === gameState.lastRoll) {
                                p.credits += 1;
                            } else if (commitment && !commitment.skip) {
                                const cardIdx = p.cards.findIndex(c => c.value === commitment.card && !c.isBurned);
                                if (cardIdx > -1) p.cards[cardIdx].isBurned = true;
                            }
                        });

                        // Clean up
                        global.pendingRolls.delete(roundId);
                        await db.setGame(gameCode, gameState);
                    }
                }
            }
        }
    });
}

// --- API ROUTES (Mimicking Vercel logic) ---

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



// Capture twitter handle in join
app.post('/api/join', async (req, res) => {
    try {
        const { gameCode, playerName, avatar, privyId, twitterHandle } = req.body;
        const gameState = await db.getGame(gameCode);

        if (!gameState) return res.status(404).json({ error: 'Game not found' });
        if (gameState.phase !== 'waiting') {
            return res.status(400).json({ error: 'you got locked out, match already in progress' });
        }

        let playerId;
        let newPlayer;

        // Check if player already in game (re-join)
        const existingPlayer = privyId ? gameState.players.find(p => p.id === privyId) : null;

        if (existingPlayer) {
            playerId = existingPlayer.id;
            existingPlayer.connected = true;
            if (avatar) existingPlayer.avatar = avatar;
            if (playerName) existingPlayer.name = playerName;
            // Update handle if it wasn't there or changed
            if (twitterHandle) existingPlayer.twitterHandle = twitterHandle;

            await db.setGame(gameCode, gameState);

            res.json({
                success: true,
                playerId,
                playerNumber: existingPlayer.playerNumber,
                playerName: existingPlayer.name,
                gameState: getPublicState(gameState, playerId)
            });
            return;
        }

        playerId = privyId || generatePlayerId();
        newPlayer = {
            id: playerId,
            playerNumber: gameState.players.length,
            name: playerName || `Player ${gameState.players.length + 1}`,
            twitterHandle: twitterHandle || null,
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
        res.json({
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
});

app.post('/api/commit', async (req, res) => {
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

        const publicState = getPublicState(gameState, playerId);

        // TRIGGER ON-CHAIN ROLL
        // If the game logic (checkTimeouts) advanced the round or if we timed out, we might need a roll.
        // Actually, checkTimeouts in gameLogic was determining passing of time.
        // We should check here if we need to roll.

        // If we are in 'commit' phase but deadline passed, we should have transitioned?
        // Let's modify gameLogic to transition to 'rolling' or similar.
        // For now, let's inject the trigger here:

        if (gameState.phase === 'commit' && Date.now() > gameState.commitDeadline && !gameState.rollRequested) {
            gameState.rollRequested = true; // Prevent double trigger
            // Note: effectively we are in "rolling" state but we keep phase 'commit' or 'rolling' until event?
            // Ideally we switch to 'rolling' phase.
            gameState.phase = 'rolling';
            await executeOnChainRoll(gameCode, gameState.round + 1); // Round is 0-indexed? check gameLogic
        }

        // Check if game just ended and needs stats update
        if (publicState.phase === 'ended' && !gameState.statsUpdated) {
            const winner = publicState.winner;
            if (winner) {
                // Determine winner ID from public state object or find in storage
                // publicState.winner is the player object
                await db.updateGameStats(gameState, winner.id);
                gameState.statsUpdated = true;
            }
        }

        // Save back any auto-updates (timeouts, stats flags)
        await db.setGame(gameCode, gameState);

        res.json(publicState);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await db.getLeaderboard();
        res.json(leaderboard);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`🎲 Local Dev Server running on http://localhost:${PORT}`);
    console.log(`   (Mimicking Vercel Serverless environment)`);
});
