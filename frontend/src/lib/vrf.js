import { createWalletClient, http, publicActions, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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

const CONTRACT_ADDRESS = process.env.DICEROLLER_ADDRESS || "0x466b833b1f3cD50A14bC34D68fAD6be996DC74Ea";

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
 * Execute an on-chain roll in the background.
 * Fires the request, and setup a background promise to fulfill it.
 */
export async function executeOnChainRoll(gameCode, roundNumber, db) {
    const config = getVRFConfig();
    if (!config) throw new Error("Blockchain not configured");
    const { adminWallet, contract } = config;

    try {
        const roundId = BigInt(Date.now());
        global.pendingRolls = global.pendingRolls || new Map();
        global.pendingRolls.set(roundId.toString(), { gameCode, roundNumber });

        console.log(`🎲 [VRF] REQUESTING ROLL: Game: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);
        const reqTx = await contract.write.requestDiceRoll([roundId]);
        console.log(`   ✅ Request Sent! Tx: ${reqTx}`);

        // Fulfillment in "background"
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
                console.error("❌ [VRF] Background Execution Error:", err.message);
                // Reset state on failure so it can retry
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

/**
 * Perform a full on-chain roll (Request -> Submit) synchronously.
 * Useful for debug buttons and ensuring results before responding.
 */
export async function rollDice(gameCode, roundNumber, db) {
    const config = getVRFConfig();
    if (!config) throw new Error("Blockchain not configured");
    const { adminWallet, contract } = config;

    try {
        const roundId = BigInt(Date.now());

        // Track this roll so event listeners can resolve it if they are running
        if (global.pendingRolls) {
            global.pendingRolls.set(roundId.toString(), { gameCode, roundNumber });
        }

        console.log(`\n🎲 [rollDice] Game: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);

        // 1. REQUEST
        const reqTxHash = await contract.write.requestDiceRoll([roundId]);
        console.log(`   ✅ Request Sent: ${reqTxHash}`);

        // 2. WAIT FOR CONFIRMATION
        await adminWallet.waitForTransactionReceipt({ hash: reqTxHash });

        // 3. PULL & SUBMIT
        const mockRandomness = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
        const submitTxHash = await contract.write.submitVerifiedRoll([roundId, mockRandomness]);
        console.log(`   ✅ Submit Sent: ${submitTxHash}`);

        // 4. WAIT FOR CONFIRMATION
        await adminWallet.waitForTransactionReceipt({ hash: submitTxHash });

        const result = Number((BigInt(mockRandomness) % 3n) + 1n);
        console.log(`   🎉 Finished! Result: ${result}\n`);

        return { success: true, txHash: submitTxHash, result, roundId: roundId.toString() };
    } catch (error) {
        console.error("❌ rollDice Error:", error.message);
        throw error;
    }
}
