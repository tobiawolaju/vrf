import { createPublicClient, createWalletClient, http, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DICEROLLER_ABI, CONTRACT_ADDRESS } from './src/lib/vrf.js';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3001';
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

async function runTest() {
    console.log("🚀 [E2E Test] Starting Headless Game Flow Test...");
    console.log(`📡 Contract: ${CONTRACT_ADDRESS}`);

    try {
        // 1. Create Game via API
        console.log("1️⃣  Creating new game...");
        const createRes = await fetch(`${API_URL}/api/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDelayMinutes: 0.1 })
        });
        const { gameCode } = await createRes.json();
        console.log(`   ✅ Game Created: ${gameCode}`);

        // 2. Join Game (as Host)
        console.log("2️⃣  Joining game as Host...");
        const joinRes = await fetch(`${API_URL}/api/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameCode,
                playerName: "TestHost",
                privyId: `did:test:${Date.now()}`
            })
        });
        const { playerId } = await joinRes.json();
        console.log(`   ✅ Joined as ${playerId}`);

        // 3. Trigger Rolling Phase (Manually wait for crank or force it)
        console.log("3️⃣  Simulating 'Rolling' phase...");
        // In the real app, the crank moves phase to 'rolling' after timeout.
        // We will just perform the on-chain roll now.

        // 4. On-Chain Roll
        console.log("4️⃣  Requesting On-Chain Dice Roll...");
        const roundId = BigInt(Date.now());
        const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'requestDiceRoll',
            args: [roundId, gameCode],
        });
        console.log(`   ✅ TX Sent: ${hash}`);
        console.log("⏳ Waiting for blockchain confirmation...");
        await publicClient.waitForTransactionReceipt({ hash });

        console.log("\n🎊 Step 1 Complete (On-Chain)!");
        console.log("📺 NOW LOOK AT YOUR SERVER TERMINAL.");
        console.log("You should see the server log the 'DiceRolled' event and resolve the game.");

        console.log("\n5️⃣  Checking Final Game State via API in 5 seconds...");
        await new Promise(r => setTimeout(r, 5000));

        const stateRes = await fetch(`${API_URL}/api/state?gameCode=${gameCode}&playerId=${playerId}`);
        const state = await stateRes.json();

        console.log(`   🏁 Final Phase: ${state.phase}`);
        if (state.phase === 'resolve') {
            console.log(`   🎉 SUCCESS! Result was ${state.lastRoll}`);
        } else {
            console.log(`   ❌ FAILED. Phase is still ${state.phase}. Check server logs.`);
        }

    } catch (e) {
        console.error("❌ E2E Test Failed:", e.message);
    }
}

runTest();
