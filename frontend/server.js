import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { db } from './src/lib/store.js';
import { initializeGame, generatePlayerId, getPublicState } from './src/lib/gameLogic.js';
import { getVRFConfig, rollDice, executeOnChainRoll as vrf_executeOnChainRoll } from './src/lib/vrf.js';
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

async function executeOnChainRoll(gameCode, roundNumber) {
    return await vrf_executeOnChainRoll(gameCode, roundNumber, db);
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
