import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createWalletClient, http, publicActions, getContract, decodeEventLog, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- Pyth Entropy Config ---
const ENTROPY_CONTRACT = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603"; // Monad Mainnet
const ENTROPY_PROVIDER = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344"; // Default Pyth provider

// --- Contract Config ---
const CONTRACT_ADDRESS = "0x131e56853F087F74Dbd59f7c6581cd57201a5f34"; // Pyth Entropy DiceRoller

const DICEROLLER_ABI = [
    {
        "type": "constructor",
        "inputs": [
            { "name": "_entropy", "type": "address" },
            { "name": "_entropyProvider", "type": "address" }
        ]
    },
    {
        "type": "function",
        "name": "requestDiceRoll",
        "inputs": [
            { "name": "roundId", "type": "uint256" },
            { "name": "userCommitment", "type": "bytes32" }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "getFee",
        "inputs": [],
        "outputs": [{ "name": "", "type": "uint128" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getDiceResult",
        "inputs": [{ "name": "roundId", "type": "uint256" }],
        "outputs": [
            { "name": "isFulfilled", "type": "bool" },
            { "name": "result", "type": "uint8" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "DiceRequested",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "sequenceNumber", "type": "uint64", "indexed": false },
            { "name": "requester", "type": "address", "indexed": false }
        ]
    },
    {
        "type": "event",
        "name": "DiceRolled",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "result", "type": "uint8", "indexed": false },
            { "name": "randomness", "type": "uint256", "indexed": false }
        ]
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

        console.log("✅ Pyth Entropy VRF Oracle Backend initialized");
        console.log(`   Contract: ${CONTRACT_ADDRESS}`);
        console.log(`   Entropy: ${ENTROPY_CONTRACT}`);
        console.log(`   Provider: ${ENTROPY_PROVIDER}`);
    } catch (e) {
        console.error("❌ Failed to initialize:", e.message);
        process.exit(1);
    }
}

// Generate random commitment for user
function generateUserCommitment() {
    // Generate 32 random bytes
    const randomBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
    }
    // Convert to hex string with 0x prefix
    const commitment = '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return commitment;
}

// --- API Endpoints ---

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'pyth-entropy-vrf-oracle',
        entropy: ENTROPY_CONTRACT,
        provider: ENTROPY_PROVIDER
    });
});

// Get the fee required for a VRF request
app.get('/api/get-fee', async (req, res) => {
    try {
        const fee = await contract.read.getFee();
        res.json({
            success: true,
            fee: fee.toString(),
            feeInEther: (Number(fee) / 1e18).toFixed(6)
        });
    } catch (error) {
        console.error("❌ Get Fee Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Request a dice roll (commit phase)
app.post('/api/request-roll', async (req, res) => {
    try {
        const { gameCode, roundNumber } = req.body;
        const roundId = BigInt(Date.now());

        console.log(`🎲 [Pyth Entropy] Request Roll: ${gameCode} | Round: ${roundNumber} | ID: ${roundId}`);

        // Generate user commitment
        const userCommitment = generateUserCommitment();

        // Get required fee
        const fee = await contract.read.getFee();
        console.log(`   💰 Fee Required: ${(Number(fee) / 1e18).toFixed(6)} MON`);

        // Request dice roll with commitment
        const txHash = await contract.write.requestDiceRoll(
            [roundId, userCommitment],
            { value: fee }
        );

        console.log(`   ✅ Commit Transaction Sent: ${txHash}`);

        // Wait for confirmation
        const receipt = await adminWallet.waitForTransactionReceipt({ hash: txHash });

        // Parse event to get sequence number
        let sequenceNumber = null;
        for (const log of receipt.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: DICEROLLER_ABI,
                    data: log.data,
                    topics: log.topics
                });
                if (decoded.eventName === 'DiceRequested') {
                    sequenceNumber = decoded.args.sequenceNumber;
                    break;
                }
            } catch (e) {
                // Not the event we're looking for
            }
        }

        console.log(`   📝 Sequence Number: ${sequenceNumber}`);

        res.json({
            success: true,
            roundId: roundId.toString(),
            sequenceNumber: sequenceNumber?.toString(),
            txHash: txHash,
            commitment: userCommitment
        });
    } catch (error) {
        console.error("❌ Request Roll Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check if a roll is fulfilled
app.get('/api/check-result/:roundId', async (req, res) => {
    try {
        const { roundId } = req.params;

        const [isFulfilled, result] = await contract.read.getDiceResult([BigInt(roundId)]);

        res.json({
            success: true,
            roundId,
            isFulfilled,
            result: isFulfilled ? Number(result) : null
        });
    } catch (error) {
        console.error("❌ Check Result Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Combined endpoint: request and wait for result
app.post('/api/roll-dice', async (req, res) => {
    try {
        const { gameCode, roundNumber } = req.body;
        const roundId = BigInt(Date.now());

        console.log(`🎲 [Pyth Entropy] Full Roll: ${gameCode} | Round: ${roundNumber}`);

        // 1. Generate user commitment
        const userCommitment = generateUserCommitment();

        // 2. Get required fee
        const fee = await contract.read.getFee();
        console.log(`   💰 Fee: ${(Number(fee) / 1e18).toFixed(6)} MON`);

        // 3. Request dice roll (commit phase)
        const reqTxHash = await contract.write.requestDiceRoll(
            [roundId, userCommitment],
            { value: fee }
        );
        console.log(`   ✅ Commit Sent: ${reqTxHash}`);

        const reqReceipt = await adminWallet.waitForTransactionReceipt({ hash: reqTxHash });

        // Parse sequence number
        let sequenceNumber = null;
        for (const log of reqReceipt.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: DICEROLLER_ABI,
                    data: log.data,
                    topics: log.topics
                });
                if (decoded.eventName === 'DiceRequested') {
                    sequenceNumber = decoded.args.sequenceNumber;
                    break;
                }
            } catch (e) {
                // Not the event we're looking for
            }
        }

        console.log(`   📝 Sequence: ${sequenceNumber}`);
        console.log(`   ⏳ Waiting for Pyth provider to reveal...`);

        // 4. Poll for result (Pyth provider will automatically call entropyCallback)
        let result = null;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

            const [isFulfilled, diceResult] = await contract.read.getDiceResult([roundId]);

            if (isFulfilled) {
                result = Number(diceResult);
                console.log(`   🎉 Result Revealed: ${result}`);
                break;
            }

            attempts++;
        }

        if (result === null) {
            throw new Error("Timeout waiting for Pyth provider to reveal randomness");
        }

        res.json({
            success: true,
            result,
            roundId: roundId.toString(),
            sequenceNumber: sequenceNumber?.toString(),
            txHash: reqTxHash
        });
    } catch (error) {
        console.error("❌ Roll Dice Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
initializeClients();
app.listen(PORT, () => {
    console.log(`🚀 Pyth Entropy VRF Oracle running on port ${PORT}`);
});
