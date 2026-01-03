import { createWalletClient, http, publicActions, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { resolveRound } from './gameLogic.js';
import dotenv from 'dotenv';

dotenv.config();

// --- CONFIG ---
const CONTRACT_ADDRESS = "0x59921233Ed41da6c49936De3364BB064320999E4";
const ORACLE_BACKEND_URL = process.env.ORACLE_BACKEND_URL || "http://localhost:3001";

const DICEROLLER_ABI = [
    {
        "type": "function",
        "name": "requestDiceRoll",
        "inputs": [{ "name": "roundId", "type": "uint256" }],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "DiceRolled",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "result", "type": "uint8", "indexed": false },
            { "name": "randomness", "type": "uint256", "indexed": false }
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
 * Execute an on-chain roll by calling the dedicated oracle backend.
 */
export async function executeOnChainRoll(gameCode, roundNumber, db) {
    try {
        console.log(`🎲 [VRF] Requesting roll from oracle backend: ${gameCode} | Round: ${roundNumber}`);

        // Call the oracle backend
        const response = await fetch(`${ORACLE_BACKEND_URL}/api/roll-dice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameCode, roundNumber })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Oracle backend failed');
        }

        console.log(`   ✅ Roll Complete! Result: ${data.result} | TX: ${data.txHash}`);

        // Update game state in DB
        if (db) {
            const st = await db.getGame(gameCode);
            if (st) {
                resolveRound(st, data.result, data.txHash);
                await db.setGame(gameCode, st);
                console.log(`   💾 Game state updated in DB.`);
            }
        }

        return {
            txHash: data.txHash,
            roundId: data.roundId,
            result: data.result
        };
    } catch (e) {
        console.error("❌ executeOnChainRoll Error:", e.message);

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

        throw e;
    }
}

/**
 * RECOVERY: Called when a roll is stuck in 'rolling' state.
 */
export async function retryFulfillment(gameCode, roundId, db) {
    try {
        console.log(`🔄 [VRF] Retrying fulfillment via oracle backend for ${gameCode} (Round ${roundId})`);

        const response = await fetch(`${ORACLE_BACKEND_URL}/api/fulfill-roll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId })
        });

        const data = await response.json();

        if (!data.success) {
            return { success: false, error: data.error };
        }

        // Update DB if we got a result
        if (db && data.result) {
            const st = await db.getGame(gameCode);
            if (st && st.phase === 'rolling') {
                resolveRound(st, data.result, data.txHash);
                await db.setGame(gameCode, st);
                console.log(`   💾 Game state updated in DB (Recovery).`);
            }
        }

        return { success: true, result: data.result };
    } catch (e) {
        console.error(`⚠️ [VRF] Retry failed: ${e.message}`);
        return { success: false, error: e.message };
    }
}
