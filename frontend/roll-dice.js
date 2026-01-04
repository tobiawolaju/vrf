import { createPublicClient, createWalletClient, http, hexToBytes, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DICEROLLER_ABI, CONTRACT_ADDRESS, SWITCHBOARD_CROSSBAR_URL } from './src/lib/vrf.js';
import dotenv from 'dotenv';

dotenv.config();

const MONAD_RPC_URL = process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com';
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ ADMIN_PRIVATE_KEY missing from .env");
    process.exit(1);
}

const monadMainnet = {
    id: 143,
    name: 'Monad Mainnet',
    network: 'monad-mainnet',
    nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
    rpcUrls: {
        default: { http: [MONAD_RPC_URL] },
        public: { http: [MONAD_RPC_URL] },
    },
};

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: monadMainnet, transport: http() });
const walletClient = createWalletClient({ account, chain: monadMainnet, transport: http() });

async function testRoll() {
    console.log("🎲 [Test] Starting Dice Roll Test (Simulation Mode enabled)...");
    console.log(`📡 Using Contract: ${CONTRACT_ADDRESS}`);
    console.log(`👤 Using Account: ${account.address}`);

    const roundId = BigInt(Date.now());
    const gameId = "TEST_GAME";

    try {
        // 1. Request Roll
        console.log("➡️  Requesting Dice Roll...");
        const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'requestDiceRoll',
            args: [roundId, gameId],
        });
        console.log(`   ✅ TX: ${hash}`);

        console.log("⏳ Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // 2. Check Logs
        const logs = receipt.logs;
        let result = null;
        for (const log of logs) {
            try {
                const event = decodeEventLog({ abi: DICEROLLER_ABI, data: log.data, topics: log.topics });
                if (event.eventName === 'DiceRolled') {
                    result = event.args.result;
                    console.log(`   🎯 DiceRolled Event found! Result: ${result}`);
                }
            } catch (e) { }
        }

        if (result === null) {
            console.log("   ℹ️ No DiceRolled event yet (Switchboard mode?). Checking status...");
            // If not in simulation mode, we'd need to wait for the crank. 
            // But for this test, we expect Simulation to be ON.
        }

        // 3. Final Verification
        const finalResult = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'diceResults',
            args: [roundId]
        });

        console.log("\n═══════════════════════════════════════════");
        console.log(`🎉 SUCCESS! DICE RESULT: ${finalResult}`);
        console.log("═══════════════════════════════════════════\n");

    } catch (e) {
        console.error("❌ Test Failed:", e.message);
    }
}

testRoll();
