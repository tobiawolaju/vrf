import { createPublicClient, http, decodeEventLog } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

const MONAD_RPC_URL = process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com';
const SWITCHBOARD_ROUTER = "0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67";

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

const client = createPublicClient({ chain: monadMainnet, transport: http() });

const SWITCHBOARD_ABI = [
    { "inputs": [], "name": "verifierAddress", "outputs": [{ "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "getActiveFeedCount", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

const VERIFIER_ABI = [
    { "inputs": [], "name": "getActiveOracleSigningKeys", "outputs": [{ "type": "address[]" }], "stateMutability": "view", "type": "function" }
];

async function checkOracles() {
    try {
        console.log("🔍 Checking Switchboard Oracles on Monad Mainnet...");

        const verifier = await client.readContract({
            address: SWITCHBOARD_ROUTER,
            abi: SWITCHBOARD_ABI,
            functionName: 'verifierAddress'
        });
        console.log(`📡 Verifier Address: ${verifier}`);

        const oracles = await client.readContract({
            address: verifier,
            abi: VERIFIER_ABI,
            functionName: 'getActiveOracleSigningKeys'
        });

        console.log(`✅ Found ${oracles.length} active oracles:`);
        oracles.forEach((o, i) => console.log(`   [${i}] ${o}`));

        if (oracles.length === 0) {
            console.warn("⚠️  WARNING: No active oracles found on this verifier!");
        }

    } catch (e) {
        console.error("❌ Error checking oracles:", e.message);
    }
}

checkOracles();
