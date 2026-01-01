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

async function rollDice(gameCode, roundNumber) {
    if (!contract) {
        throw new Error("Blockchain not configured");
    }

    try {
        const roundId = BigInt(Date.now());

        // Track this roll so the event listener can resolve the game state
        global.pendingRolls = global.pendingRolls || new Map();
        global.pendingRolls.set(roundId.toString(), { gameCode, roundNumber });

        console.log(`\n🎲 [rollDice] STARTING ON-CHAIN ROLL: Game: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);

        // 1. REQUEST
        console.log('   📡 1. Requesting dice roll on-chain...');
        const reqTxHash = await contract.write.requestDiceRoll([roundId]);
        console.log(`   ✅ Request Sent! Tx: ${reqTxHash}`);

        // 2. WAIT FOR CONFIRMATION
        console.log('   ⏳ 2. Waiting for request confirmation...');
        await adminWallet.waitForTransactionReceipt({ hash: reqTxHash });

        // 3. PULL & SUBMIT (Acting as Switchboard Puller)
        console.log('   🔮 3. Pulling verified randomness (Simulating Switchboard API)...');
        const mockRandomness = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
        console.log(`   Fetched Randomness: ${mockRandomness}`);

        console.log('   📡 4. Submitting verified randomness to contract...');
        const submitTxHash = await contract.write.submitVerifiedRoll([roundId, mockRandomness]);
        console.log(`   ✅ Submit Sent! Tx: ${submitTxHash}`);

        // 4. WAIT FOR RESULT
        console.log('   ⏳ 5. Waiting for submission confirmation...');
        await adminWallet.waitForTransactionReceipt({ hash: submitTxHash });

        const result = Number((BigInt(mockRandomness) % 3n) + 1n);
        console.log(`   🎉 [rollDice] FINISHED! Result: ${result}\n`);

        return { success: true, txHash: submitTxHash, result, roundId: roundId.toString() };
    } catch (error) {
        console.error("❌ rollDice Error:", error.message);
        throw error;
    }
}

async function executeOnChainRoll(gameCode, roundNumber) {
    if (!contract) {
        console.warn("❌ [VRF] Blockchain not connected. Simulation Fallback.");
        throw new Error("Blockchain not configured");
    }

    try {
        const roundId = BigInt(Date.now());
        global.pendingRolls = global.pendingRolls || new Map();
        global.pendingRolls.set(roundId.toString(), { gameCode, roundNumber });

        console.log(`🎲 [VRF] REQUESTING ROLL: Game: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);
        const reqTx = await contract.write.requestDiceRoll([roundId]);
        console.log(`   ✅ Request Sent! Tx: ${reqTx}`);

        (async () => {
            try {
                const receipt = await adminWallet.waitForTransactionReceipt({ hash: reqTx });
                console.log(`   📦 Request Mined in block ${receipt.blockNumber}`);

                const mockRandomness = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
                const subTx = await contract.write.submitVerifiedRoll([roundId, mockRandomness]);
                console.log(`   ✅ Submit Sent! Tx: ${subTx}`);

                await adminWallet.waitForTransactionReceipt({ hash: subTx });
                console.log(`   🏁 Submit Mined!`);
            } catch (err) {
                console.error("❌ [VRF] Failed to fulfill request in background:", err.message);
                setTimeout(async () => {
                    const st = await db.getGame(gameCode);
                    if (st && st.rollRequested && st.phase === 'rolling') {
                        st.rollRequested = false;
                        st.phase = 'commit';
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
                const pending = global.pendingRolls ? global.pendingRolls.get(roundId) : null;

                if (pending) {
                    const { gameCode } = pending;
                    const gameState = await db.getGame(gameCode);
                    if (gameState) {
                        gameState.lastRoll = Number(result);
                        gameState.lastRollTxHash = txHash;
                        gameState.round = pending.roundNumber;
                        gameState.rollRequested = false;
                        gameState.phase = 'resolve';
                        gameState.resolveDeadline = Date.now() + 5000;

                        gameState.players.forEach(p => {
                            const commitment = gameState.commitments[p.id];
                            if (commitment && commitment.card === gameState.lastRoll) {
                                p.credits += 1;
                            } else if (commitment && !commitment.skip) {
                                const cardIdx = p.cards.findIndex(c => c.value === commitment.card && !c.isBurned);
                                if (cardIdx > -1) p.cards[cardIdx].isBurned = true;
                            }
                        });

                        global.pendingRolls.delete(roundId);
                        await db.setGame(gameCode, gameState);
                    }
                }
            }
        }
    });
}

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
        if (gameState.phase !== 'waiting') {
            return res.status(400).json({ error: 'you got locked out, match already in progress' });
        }

        let playerId = privyId || generatePlayerId();
        const existingPlayer = gameState.players.find(p => p.id === playerId);

        if (existingPlayer) {
            existingPlayer.connected = true;
            if (avatar) existingPlayer.avatar = avatar;
            if (playerName) existingPlayer.name = playerName;
            if (twitterHandle) existingPlayer.twitterHandle = twitterHandle;

            await db.setGame(gameCode, gameState);
            return res.json({
                success: true,
                playerId,
                playerNumber: existingPlayer.playerNumber,
                playerName: existingPlayer.name,
                gameState: getPublicState(gameState, playerId)
            });
        }

        const newPlayer = {
            id: playerId,
            playerNumber: gameState.players.length,
            name: playerName || `Player ${gameState.players.length + 1}`,
            twitterHandle: twitterHandle || null,
            cards: [{ value: 1, isBurned: false }, { value: 2, isBurned: false }, { value: 3, isBurned: false }],
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

        if (gameState.phase === 'commit' && Date.now() > gameState.commitDeadline && !gameState.rollRequested) {
            console.log(`🚀 [GAME] Triggering Roll for ${gameCode}...`);
            gameState.rollRequested = true;
            gameState.phase = 'rolling';
            await db.setGame(gameCode, gameState);

            executeOnChainRoll(gameCode, gameState.round).catch(async err => {
                console.error(`❌ [GAME] Failed to initiate roll for ${gameCode}:`, err.message);
                const st = await db.getGame(gameCode);
                if (st && st.rollRequested && st.phase === 'rolling') {
                    st.rollRequested = false;
                    st.phase = 'commit';
                    await db.setGame(gameCode, st);
                }
            });
        }

        const publicState = getPublicState(gameState, playerId);

        if (publicState.phase === 'ended' && !gameState.statsUpdated) {
            const winner = publicState.winner;
            if (winner) {
                await db.updateGameStats(gameState, winner.id);
                gameState.statsUpdated = true;
            }
        }

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
        const result = await rollDice(gameCode, gameState.round || 1);
        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`🎲 Local Dev Server running on http://localhost:${PORT}`);
    console.log(`   (Mimicking Vercel Serverless environment)`);
});
