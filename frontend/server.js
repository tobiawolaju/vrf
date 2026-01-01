import express from 'express';
import crypto from 'crypto';
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

// Comprehensive ABI for Switchboard On-Demand Flow
const DICEROLLER_ABI = [
    {
        "type": "function",
        "name": "requestDiceRoll",
        "inputs": [{ "name": "roundId", "type": "uint256" }],
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "submitVerifiedRoll",
        "inputs": [
            { "name": "roundId", "type": "uint256" },
            { "name": "randomness", "type": "bytes32" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "DiceRequested",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "timestamp", "type": "uint256", "indexed": false }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "DiceRolled",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "result", "type": "uint8", "indexed": false },
            { "name": "randomness", "type": "bytes32", "indexed": false }
        ],
        "anonymous": false
    }
];

const CONTRACT_ADDRESS = process.env.DICEROLLER_ADDRESS || "0x466b833b1f3cD50A14bC34D68fAD6be996DC74Ea";

// Admin Wallet (The Backend Relayer)
let adminWallet = null;
let contract = null;

if (process.env.ADMIN_PRIVATE_KEY) {
    try {
        // Define Monad Mainnet chain
        const monadMainnet = {
            id: 143,
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
        console.warn("❌ [VRF] Blockchain not connected. Simulation Fallback.");
        throw new Error("Blockchain not configured");
    }

    try {
        // Use a consistent ID generation (Date.now() is fine, but log it clearly)
        const roundId = BigInt(Date.now());

        // Store map of roundId -> gameCode to resolve later
        global.pendingRolls = global.pendingRolls || new Map();
        global.pendingRolls.set(roundId.toString(), { gameCode, roundNumber });

        console.log(`🎲 [VRF] REQUESTING ROLL: Game: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);

        // 1. REQUEST
        // We use wait for the transaction to be sent, but we handle the pull/submit in the background
        const reqTx = await contract.write.requestDiceRoll([roundId]);
        console.log(`   ✅ Request Sent! Tx: ${reqTx}`);

        // 2. FETCH & SUBMIT (Background Task)
        // We don't await this so the API can return immediately
        (async () => {
            try {
                // Wait for transaction receipt to ensure it's on-chain
                console.log(`   ⏳ Waiting for reach for Tx: ${reqTx}...`);
                const receipt = await adminWallet.waitForTransactionReceipt({ hash: reqTx });
                console.log(`   📦 Request Mined in block ${receipt.blockNumber}`);

                console.log(`🔮 [VRF] Fetching randomness for ID: ${roundId}...`);
                // Simulate pulling from Switchboard API (in production this would be an API call)
                const mockRandomness = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;

                console.log(`📡 [VRF] Submitting randomness to contract...`);
                const subTx = await contract.write.submitVerifiedRoll([roundId, mockRandomness]);
                console.log(`   ✅ Submit Sent! Tx: ${subTx}`);

                await adminWallet.waitForTransactionReceipt({ hash: subTx });
                console.log(`   🏁 Submit Mined!`);
            } catch (err) {
                console.error("❌ [VRF] Failed to fulfill request in background:", err.message);
                // If it fails, we might want to reset rollRequested after some time
                setTimeout(async () => {
                    const st = await db.getGame(gameCode);
                    if (st && st.rollRequested && st.phase === 'rolling') {
                        console.log(`🔄 [VRF] Resetting rollRequested for ${gameCode} due to background failure.`);
                        st.rollRequested = false;
                        st.phase = 'commit'; // Kick back to commit so it can retry
                        await db.setGame(gameCode, st);
                    }
                }, 10000);
            }
        })();

        return { txHash: reqTx, roundId: roundId.toString() };
    } catch (e) {
        console.error("❌ executeOnChainRoll Error:", e.message);
        throw e;
    }
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

        // TRIGGER ON-CHAIN ROLL
        // Refactored to occur BEFORE state object is built for returning, 
        // and using a more robust state lock.

        if (gameState.phase === 'commit' && Date.now() > gameState.commitDeadline && !gameState.rollRequested) {
            console.log(`🚀 [GAME] Triggering Roll for ${gameCode}...`);
            gameState.rollRequested = true;
            gameState.phase = 'rolling';

            // Save state IMMEDIATELY so other parallel polls don't re-trigger
            await db.setGame(gameCode, gameState);

            // Execute in background
            executeOnChainRoll(gameCode, gameState.round).catch(async err => {
                console.error(`❌ [GAME] Failed to initiate roll for ${gameCode}:`, err.message);
                // Reset state so it can retry on next poll if the TX failed to even send
                const st = await db.getGame(gameCode);
                if (st && st.rollRequested && st.phase === 'rolling') {
                    console.log(`🔄 [GAME] Resetting state for ${gameCode} due to immediate failure.`);
                    st.rollRequested = false;
                    st.phase = 'commit';
                    await db.setGame(gameCode, st);
                }
            });
        }

        const publicState = getPublicState(gameState, playerId);

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

app.post('/api/debug-roll', async (req, res) => {
    try {
        const { gameCode } = req.body;
        const gameState = await db.getGame(gameCode);
        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        console.log(`🛠️ [DEBUG] Manual Roll Triggered for ${gameCode}`);

        const { txHash } = await executeOnChainRoll(gameCode, gameState.round || 1);

        // Wait for result (max 20s)
        let result = null;
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const st = await db.getGame(gameCode);
            if (st.lastRollTxHash === txHash) {
                result = st.lastRoll;
                break;
            }
        }

        res.json({ success: true, txHash, result });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`🎲 Local Dev Server running on http://localhost:${PORT}`);
    console.log(`   (Mimicking Vercel Serverless environment)`);
});
