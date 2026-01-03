import { createWalletClient, http, publicActions, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { resolveRound } from './gameLogic.js';
import { CrossbarClient } from "@switchboard-xyz/on-demand"; // Import Switchboard SDK
import dotenv from 'dotenv';

dotenv.config();

// --- CONFIG ---
// Updated to the new Switchboard-compliant contract
const CONTRACT_ADDRESS = "0xf77C2B4F796E4fea9465a7eaa4606a3a64c09971";
const QUEUE_ID = "0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752"; // Monad Mainnet Queue

const DICEROLLER_ABI = [
    {
        "type": "function",
        "name": "requestDiceRoll",
        "inputs": [{ "name": "roundId", "type": "uint256" }],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "fulfillRandomness",
        "inputs": [
            { "name": "roundId", "type": "uint256" },
            { "name": "proof", "type": "bytes" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "DiceRequested",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "requester", "type": "address", "indexed": false }
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
let crossbar = null;

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

            // Initialize Switchboard Client
            crossbar = new CrossbarClient("https://crossbar.switchboard.xyz");

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
 * NOTE: For On-Demand, on-chain request is optional if we push directly, 
 * but we keep it for semantic tracking in the contract.
 */
async function _sendVrfRequest(gameCode, roundNumber) {
    const config = getVRFConfig();
    if (!config) throw new Error("Blockchain not configured");
    const { adminWallet, contract } = config;

    const roundId = BigInt(Date.now());

    // Track this roll globally
    global.pendingRolls = global.pendingRolls || new Map();
    global.pendingRolls.set(roundId.toString(), { gameCode, roundNumber });

    console.log(`🎲 [VRF] STARTING ROLL: Game: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);

    // 1. REQUEST (Optional Log)
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
 * INTERNAL: Completes the VRF process by FETCHING A REAL PROOF
 * from Switchboard and submitting it.
 */
async function _completeVrfRoll(context, db) {
    const { roundId, adminWallet, contract, gameCode } = context;

    console.log(`   ⏳ Fetching Oracle Proof from Switchboard...`);

    // 2. FETCH PROOF FROM SWITCHBOARD
    const result = await crossbar.fetch(QUEUE_ID);

    // Switchboard returns an array of encoded updates (proofs). We normally take the first one.
    const proof = result.encoded[0];
    if (!proof) throw new Error("Failed to fetch proof from Switchboard");

    console.log(`   📦 Proof Received: ${proof.slice(0, 20)}...`);

    // 3. SUBMIT PROOF TO CONTRACT
    console.log(`   🔄 Submitting Proof to Contract...`);
    const subTxHash = await contract.write.fulfillRandomness([roundId, proof]);
    console.log(`   ✅ Fulfillment Sent: ${subTxHash}`);

    // 4. WAIT FOR CONFIRMATION
    await adminWallet.waitForTransactionReceipt({ hash: subTxHash });

    console.log(`   🏁 Roll Finished on-chain!`);

    // Return hash. Server listener will pick up the event to update DB.
    return { result: null, txHash: subTxHash };
}

/**
 * Execute an on-chain roll in the BACKGROUND (for normal game flow).
 */
export async function executeOnChainRoll(gameCode, roundNumber, db) {
    try {
        const context = await _sendVrfRequest(gameCode, roundNumber);

        // Continue in background
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
 * RECOVERY: Called when a roll is stuck in 'rolling' state.
 */
export async function retryFulfillment(gameCode, roundId, db) {
    try {
        console.log(`🔄 [VRF] Retrying fulfillment for ${gameCode} (Round ${roundId})`);
        const config = getVRFConfig();
        if (!config) return;
        const { contract, adminWallet } = config;

        // FETCH PROOF FROM SWITCHBOARD (REAL RECOVERY)
        console.log(`   ⏳ Fetching fresh Oracle Proof...`);
        const result = await crossbar.fetch(QUEUE_ID);
        const proof = result.encoded[0];

        console.log(`   🔄 Submitting Retry...`);
        const subTxHash = await contract.write.fulfillRandomness([BigInt(roundId), proof]);
        console.log(`   ✅ Retry Submit Sent: ${subTxHash}`);

        await adminWallet.waitForTransactionReceipt({ hash: subTxHash });

        // Note: Database update is handled by the event listener in server.js when the event triggers.
        // But for redundancy we return success.

        return { success: true };
    } catch (e) {
        console.error(`⚠️ [VRF] Retry failed: ${e.message}`);
        return { success: false, error: e.message };
    }
}
