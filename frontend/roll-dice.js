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
    console.log("🎲 [Test] Starting Switchboard VRF Test...");
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
        console.log(`   ✅ Request TX: ${hash}`);

        console.log("⏳ Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // 2. Extract requestId from logs
        const logs = receipt.logs;
        let requestId = null;
        for (const log of logs) {
            try {
                const event = decodeEventLog({ abi: DICEROLLER_ABI, data: log.data, topics: log.topics });
                if (event.eventName === 'DiceRequested') {
                    requestId = event.args.requestId;
                }
            } catch (e) { }
        }

        if (!requestId) throw new Error("Could not find requestId in logs");
        console.log(`   🎯 Request ID: ${requestId}`);

        // 3. Wait for Switchboard & Fulfill (Simulation of Crank)
        console.log("🧪 Waiting for Switchboard proof (this takes ~5-10s)...");

        let proof = null;
        for (let i = 0; i < 20; i++) {
            try {
                const url = `${SWITCHBOARD_CROSSBAR_URL}/updates/eth/randomness?ids=${requestId}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data.updates && data.updates.length > 0) {
                        proof = data.updates[0];
                        break;
                    }
                }
            } catch (e) { }
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!proof) throw new Error("Switchboard proof timeout");
        console.log("   ✅ Proof received!");

        // 4. Settle on-chain
        console.log("⬅️  Fulfilling Dice Roll...");
        const fulfillHash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'settleAndFulfill',
            args: [proof, requestId],
        });
        console.log(`   ✅ Fulfill TX: ${fulfillHash}`);

        const fulfillReceipt = await publicClient.waitForTransactionReceipt({ hash: fulfillHash });

        // 5. Check result
        const result = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'diceResults',
            args: [roundId]
        });

        console.log("\n═══════════════════════════════════════════");
        console.log(`🎉 SUCCESS! DICE RESULT: ${result}`);
        console.log("═══════════════════════════════════════════\n");

    } catch (e) {
        console.error("❌ Test Failed:", e.message);
    }
}

testRoll();
