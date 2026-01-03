// Test script for Pyth Entropy VRF integration
import { createWalletClient, http, publicActions, getContract, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const CONTRACT_ADDRESS = "0x131e56853F087F74Dbd59f7c6581cd57201a5f34";

const DICEROLLER_ABI = [
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
    }
];

const monadMainnet = {
    id: 143,
    name: 'Monad Mainnet',
    network: 'monad-mainnet',
    nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
    rpcUrls: {
        default: { http: ['https://rpc-mainnet.monadinfra.com'] },
        public: { http: ['https://rpc-mainnet.monadinfra.com'] },
    },
};

async function testPythEntropyVRF() {
    console.log("🧪 Testing Pyth Entropy VRF Integration\n");
    console.log(`Contract: ${CONTRACT_ADDRESS}\n`);

    // Setup wallet
    const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY);
    const client = createWalletClient({
        account,
        chain: monadMainnet,
        transport: http(),
    }).extend(publicActions);

    const contract = getContract({
        address: CONTRACT_ADDRESS,
        abi: DICEROLLER_ABI,
        client
    });

    // 1. Get fee
    console.log("1️⃣ Getting VRF fee...");
    const fee = await contract.read.getFee();
    console.log(`   Fee: ${fee.toString()} wei (${(Number(fee) / 1e18).toFixed(6)} MON)\n`);

    // 2. Generate user commitment
    console.log("2️⃣ Generating user commitment...");
    const randomBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
    }
    const userCommitment = '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    console.log(`   Commitment: ${userCommitment}\n`);

    // 3. Request dice roll
    const roundId = BigInt(Date.now());
    console.log(`3️⃣ Requesting dice roll (Round ID: ${roundId})...`);

    try {
        const txHash = await contract.write.requestDiceRoll(
            [roundId, userCommitment],
            { value: fee }
        );
        console.log(`   ✅ Transaction sent: ${txHash}`);

        const receipt = await client.waitForTransactionReceipt({ hash: txHash });
        console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}\n`);

        // 4. Poll for result
        console.log("4️⃣ Waiting for Pyth provider to reveal randomness...");
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

            const [isFulfilled, result] = await contract.read.getDiceResult([roundId]);

            if (isFulfilled) {
                console.log(`   🎉 Result revealed: ${result}`);
                console.log(`   ✅ Test completed successfully!\n`);
                return;
            }

            attempts++;
            process.stdout.write(`   ⏳ Attempt ${attempts}/${maxAttempts}...\r`);
        }

        console.log(`\n   ⚠️ Timeout: Result not revealed within ${maxAttempts * 2} seconds`);
        console.log(`   Note: Pyth provider may take longer. Check result manually with roundId: ${roundId}`);

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        throw error;
    }
}

// Run test
testPythEntropyVRF()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    });
