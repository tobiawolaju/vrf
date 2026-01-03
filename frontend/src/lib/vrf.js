import { createWalletClient, http, publicActions, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { resolveRound } from './gameLogic.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

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

const CONTRACT_ADDRESS = process.env.DICEROLLER_ADDRESS || "0x60A2054460b20D191f438D2A64856047Cb062B86";

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

let adminWallet = null;
let contract = null;

export function getVRFConfig() {
    if (contract) return { adminWallet, contract, DICEROLLER_ABI };

    if (process.env.ADMIN_PRIVATE_KEY) {
        try {
            const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY);
            adminWallet = createWalletClient({
                account,
                chain: monadMainnet,
                transport: http(),
            }).extend(publicActions);

            contract = getContract({
                address: CONTRACT_ADDRESS,
                abi: DICEROLLER_ABI,
                client: adminWallet
            });

            return { adminWallet, contract, DICEROLLER_ABI };
        } catch (e) {
            console.error("❌ Failed to setup blockchain connection:", e.message);
            return null;
        }
    }
    return null;
}

/**
 * INTERNAL: Starts the VRF process by sending the request transaction.
 * Returns the context needed to complete the roll.
 */
async function _sendVrfRequest(gameCode, roundNumber) {
    const config = getVRFConfig();
    if (!config) throw new Error("Blockchain not configured");
    const { adminWallet, contract } = config;

    const roundId = BigInt(Date.now());

    // Track this roll globally so event listeners can find it if needed
    global.pendingRolls = global.pendingRolls || new Map();
    global.pendingRolls.set(roundId.toString(), { gameCode, roundNumber });

    console.log(`🎲 [VRF] STARTING ROLL: Game: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);

    // 1. REQUEST
    const reqTxHash = await contract.write.requestDiceRoll([roundId]);
    console.log(`   ✅ Request Sent: ${reqTxHash}`);

    return {
        roundId,
        reqTxHash,
        adminWallet,
        contract,
        gameCode,
        roundNumber
    };
}

/**
 * INTERNAL: Completes the VRF process by waiting for request receipt,
 * generating randomness, and submitting the result.
 */
async function _completeVrfRoll(context, db) {
    const { roundId, reqTxHash, adminWallet, contract, gameCode } = context;

    // 2. WAIT FOR REQUEST CONFIRMATION
    console.log(`   ⏳ Waiting for request confirmation...`);
    const receipt1 = await adminWallet.waitForTransactionReceipt({ hash: reqTxHash });
    console.log(`   📦 Request Mined: block ${receipt1.blockNumber}`);

    // 3. GENERATE & SUBMIT RANDOMNESS
    const mockRandomness = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
    const subTxHash = await contract.write.submitVerifiedRoll([roundId, mockRandomness]);
    console.log(`   ✅ Submit Sent: ${subTxHash}`);

    // 4. WAIT FOR SUBMIT CONFIRMATION
    const receipt2 = await adminWallet.waitForTransactionReceipt({ hash: subTxHash });

    // Calculate result
    const resultValue = Number((BigInt(mockRandomness) % 3n) + 1n);
    console.log(`   🏁 Roll Finished! Result: ${resultValue}`);

    // 5. RESOLVE STATE IN DB
    if (db) {
        const st = await db.getGame(gameCode);
        if (st) {
            resolveRound(st, resultValue, subTxHash);
            await db.setGame(gameCode, st);
            console.log(`   💾 Game state updated in DB.`);
        } else {
            console.warn(`   ⚠️ Game ${gameCode} not found in DB during resolution.`);
        }
    }

    return { result: resultValue, txHash: subTxHash };
}

/**
 * Execute an on-chain roll in the BACKGROUND (for normal game flow).
 * Returns immediately after the remote request is sent.
 */
export async function executeOnChainRoll(gameCode, roundNumber, db) {
    try {
        // Start the process synchronously (send request)
        const context = await _sendVrfRequest(gameCode, roundNumber);

        // Continue the rest in the background
        _completeVrfRoll(context, db).catch(async (err) => {
            console.error(`❌ [VRF] Background Execution Error for ${gameCode}:`, err.message);

            // Attempt state recovery on failure
            try {
                const st = await db.getGame(gameCode);
                if (st && st.rollRequested && st.phase === 'rolling') {
                    console.log(`   ↺ Reverting game state to 'commit' phase.`);
                    st.rollRequested = false;
                    st.phase = 'commit';
                    await db.setGame(gameCode, st);
                }
            } catch (dbErr) {
                console.error("   ❌ Failed to revert game state:", dbErr.message);
            }
        });

        return { txHash: context.reqTxHash, roundId: context.roundId.toString() };
    } catch (e) {
        console.error("❌ executeOnChainRoll Error:", e.message);
        throw e;
    }
}

/**
 * Perform a full on-chain roll SYNCHRONOUSLY (for debug/admin).
 * Waits for the entire process to complete before returning.
 */
export async function rollDice(gameCode, roundNumber, db) {
    try {
        const context = await _sendVrfRequest(gameCode, roundNumber);
        const { result, txHash } = await _completeVrfRoll(context, db);

        return {
            success: true,
            txHash,
            result,
            roundId: context.roundId.toString()
        };
    } catch (error) {
        console.error("❌ rollDice Error:", error.message);
        throw error;
    }
}
/**
 * RECOVERY: Called when a roll is stuck in 'rolling' state.
 * Attempts to finish the Oracle job (Submit Randomness).
 */
export async function retryFulfillment(gameCode, roundId, db) {
    try {
        console.log(`🔄 [VRF] Retrying fulfillment for ${gameCode} (Round ${roundId})`);
        const config = getVRFConfig();
        if (!config) return;
        const { contract, adminWallet } = config;

        // 3. GENERATE & SUBMIT RANDOMNESS (Retry)
        // We act as the Oracle here.
        const mockRandomness = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;

        // We don't have the original request tx hash, but we can try to submit.
        // If the request didn't happen on chain, this might fail, or it might just work if request is pending.
        // Since we blindly retry, we assume request was mined.

        console.log(`   🔄 Submitting Roll...`);
        const subTxHash = await contract.write.submitVerifiedRoll([BigInt(roundId), mockRandomness]);
        console.log(`   ✅ Retry Submit Sent: ${subTxHash}`);

        // 4. WAIT FOR CONFIRMATION
        await adminWallet.waitForTransactionReceipt({ hash: subTxHash });

        // Calculate result
        const resultValue = Number((BigInt(mockRandomness) % 3n) + 1n);
        console.log(`   🏁 Retry Finished! Result: ${resultValue}`);

        // 5. RESOLVE STATE IN DB
        if (db) {
            const st = await db.getGame(gameCode);
            if (st) {
                resolveRound(st, resultValue, subTxHash);
                await db.setGame(gameCode, st);
                console.log(`   💾 Game state updated in DB (Recovery).`);
            }
        }
        return { success: true, result: resultValue };
    } catch (e) {
        // If it fails (e.g. already submitted, or request invalid), we log but don't crash
        // common error: "Request already fulfilled" or "Request not found"
        console.error(`⚠️ [VRF] Retry failed: ${e.message}`);
        return { success: false, error: e.message };
    }
}
