import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createWalletClient, http, publicActions, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- Blockchain Config ---
const CONTRACT_ADDRESS = "0x59921233Ed41da6c49936De3364BB064320999E4";
const QUEUE_ID = "0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752";
const CROSSBAR_URL = "https://crossbar.switchboard.xyz";

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
    nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
    rpcUrls: {
        default: { http: [process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com'] },
        public: { http: [process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com'] },
    },
};

let adminWallet, contract;

// Initialize on startup
function initializeClients() {
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

        console.log("✅ VRF Oracle Backend initialized");
    } catch (e) {
        console.error("❌ Failed to initialize:", e.message);
        process.exit(1);
    }
}

// Fetch randomness proof from Switchboard Crossbar
async function fetchSwitchboardProof(queueId) {
    try {
        const response = await fetch(`${CROSSBAR_URL}/fetch/${queueId}`);
        if (!response.ok) {
            throw new Error(`Crossbar fetch failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.encoded[0]; // Get first encoded proof
    } catch (error) {
        throw new Error(`Failed to fetch Switchboard proof: ${error.message}`);
    }
}

// --- API Endpoints ---

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'vrf-oracle-backend' });
});

// Request a dice roll (creates on-chain request)
app.post('/api/request-roll', async (req, res) => {
    try {
        const { gameCode, roundNumber } = req.body;
        const roundId = BigInt(Date.now());

        console.log(`🎲 [Oracle] Request Roll: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);

        const reqTxHash = await contract.write.requestDiceRoll([roundId]);
        console.log(`   ✅ Request Sent: ${reqTxHash}`);

        res.json({
            success: true,
            roundId: roundId.toString(),
            txHash: reqTxHash
        });
    } catch (error) {
        console.error("❌ Request Roll Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Fulfill a dice roll (fetches proof and submits)
app.post('/api/fulfill-roll', async (req, res) => {
    try {
        const { roundId } = req.body;

        console.log(`🔄 [Oracle] Fulfilling Roll: ${roundId}`);

        // Fetch proof from Switchboard
        const proof = await fetchSwitchboardProof(QUEUE_ID);

        if (!proof) throw new Error("Failed to fetch proof from Switchboard");

        console.log(`   📦 Proof Received`);

        // Submit to contract
        const subTxHash = await contract.write.fulfillRandomness([BigInt(roundId), proof]);
        console.log(`   ✅ Fulfillment Sent: ${subTxHash}`);

        // Wait for confirmation
        const receipt = await adminWallet.waitForTransactionReceipt({ hash: subTxHash });

        // Parse event to get result
        const logs = receipt.logs;
        let diceResult = null;

        for (const log of logs) {
            try {
                const decoded = contract.interface.parseLog(log);
                if (decoded && decoded.name === 'DiceRolled') {
                    diceResult = Number(decoded.args.result);
                    break;
                }
            } catch (e) {
                // Not the event we're looking for
            }
        }

        console.log(`   🏁 Roll Complete! Result: ${diceResult}`);

        res.json({
            success: true,
            result: diceResult,
            txHash: subTxHash
        });
    } catch (error) {
        console.error("❌ Fulfill Roll Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Combined endpoint: request + fulfill in one call
app.post('/api/roll-dice', async (req, res) => {
    try {
        const { gameCode, roundNumber } = req.body;
        const roundId = BigInt(Date.now());

        console.log(`🎲 [Oracle] Full Roll: ${gameCode} | Round: ${roundNumber}`);

        // 1. Request
        const reqTxHash = await contract.write.requestDiceRoll([roundId]);
        await adminWallet.waitForTransactionReceipt({ hash: reqTxHash });

        // 2. Fetch proof
        const proof = await fetchSwitchboardProof(QUEUE_ID);
        if (!proof) throw new Error("Failed to fetch proof");

        // 3. Fulfill
        const subTxHash = await contract.write.fulfillRandomness([roundId, proof]);
        const receipt = await adminWallet.waitForTransactionReceipt({ hash: subTxHash });

        // 4. Parse result
        let diceResult = null;
        for (const log of receipt.logs) {
            if (log.topics[0] === contract.interface.getEvent('DiceRolled').topicHash) {
                const decoded = contract.interface.parseLog(log);
                diceResult = Number(decoded.args.result);
                break;
            }
        }

        console.log(`   🏁 Complete! Result: ${diceResult}`);

        res.json({
            success: true,
            result: diceResult,
            roundId: roundId.toString(),
            txHash: subTxHash
        });
    } catch (error) {
        console.error("❌ Roll Dice Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
initializeClients();
app.listen(PORT, () => {
    console.log(`🚀 VRF Oracle Backend running on port ${PORT}`);
});
