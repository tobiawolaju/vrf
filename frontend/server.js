import express from 'express';
import cors from 'cors';
import { db } from './src/lib/store.js';
import { initializeGame, generatePlayerId, getPublicState, resolveRound } from './src/lib/gameLogic.js';
import { getVRFConfig, executeOnChainRoll } from './src/lib/vrf.js'; // rollDice helper removed
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- BLOCKCHAIN CONFIG ---

const vrfConfig = getVRFConfig();
const contract = vrfConfig?.contract;
const adminWallet = vrfConfig?.adminWallet;

if (vrfConfig) {
    console.log(`🔗 Connected to Monad as ${adminWallet.account.address}`);
    setupContractListener();
} else {
    console.warn("⚠️ ADMIN_PRIVATE_KEY not set or VRF setup failed. Blockchain features disabled.");
}

function setupContractListener() {
    if (!contract) return;

    console.log("👂 Listening for DiceRolled events...");

    contract.watchEvent.DiceRolled({}, {
        onLogs: async (logs) => {
            for (const log of logs) {
                const roundId = log.args.roundId.toString();
                const result = Number(log.args.result);
                const randomness = log.args.randomness;
                const txHash = log.transactionHash; // The Oracle Callback Tx Hash

                console.log(`⚡ [ORACLE] DiceRolled | ID: ${roundId} | Result: ${result}`);

                // Find local game waiting for this roundId
                const pending = global.pendingRolls ? global.pendingRolls.get(roundId) : null;

                if (pending) {
                    const { gameCode } = pending;
                    const gameState = await db.getGame(gameCode);
                    if (gameState) {
                        console.log(`   ✅ Resolving Game ${gameCode} with result ${result}`);
                        resolveRound(gameState, result, txHash);
                        global.pendingRolls.delete(roundId);

                        // Clear stuck state tracking
                        gameState.rollRequested = false;
                        gameState.rollRequestedTime = null;

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
            return res.status(400).json({ error: 'Match already in progress' });
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

        // TRIGGER ROLL if deadline passed
        if (gameState.phase === 'commit' && Date.now() > gameState.commitDeadline && !gameState.rollRequested) {
            console.log(`🚀 [GAME] Requesting Oracle Roll for ${gameCode}...`);
            gameState.rollRequested = true;
            gameState.phase = 'rolling';
            gameState.rollRequestedTime = Date.now();
            await db.setGame(gameCode, gameState);

            // Execute Request (Async - result will come via Event Listener)
            executeOnChainRoll(gameCode, gameState.round, db).catch(async err => {
                console.error(`❌ [GAME] Failed to request roll for ${gameCode}:`, err.message);
                // Reset to try again
                const st = await db.getGame(gameCode);
                if (st && st.rollRequested && st.phase === 'rolling') {
                    st.rollRequested = false;
                    st.phase = 'commit';
                    st.rollRequestedTime = null;
                    await db.setGame(gameCode, st);
                }
            });
        }

        // STUCK STATE WATCHDOG (20s)
        if (gameState.phase === 'rolling' && gameState.rollRequestedTime) {
            const sinceStart = Date.now() - gameState.rollRequestedTime;
            if (sinceStart > 20000) {
                console.warn(`⚠️ [GAME] Oracle request timed out (>20s). Resetting.`);
                gameState.rollRequested = false;
                gameState.phase = 'commit';
                gameState.rollRequestedTime = null;
                await db.setGame(gameCode, gameState);
            }
        }

        const publicState = getPublicState(gameState, playerId);

        // Update Leaderboard if needed
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

// Manual Logic Trigger (Requests Oracle Only)
app.post('/api/force-roll', async (req, res) => {
    try {
        const { gameCode } = req.body;
        const gameState = await db.getGame(gameCode);
        if (!gameState) return res.status(404).json({ error: 'Game not found' });

        console.log(`🛠️ [MANUAL] Forcing Oracle Request for ${gameCode}`);
        const result = await executeOnChainRoll(gameCode, gameState.round || 1, db);
        res.json({ success: true, ...result });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`🎲 Game Server running on http://localhost:${PORT}`);
});
