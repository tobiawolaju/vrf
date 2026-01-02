import { createWalletClient, http, publicActions, getContract, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// CONFIG
const CONTRACT_ADDRESS = process.env.DICEROLLER_ADDRESS; // Will be set after deployment
if (!CONTRACT_ADDRESS || !process.env.ADMIN_PRIVATE_KEY) {
    console.error("❌ Missing DICEROLLER_ADDRESS or ADMIN_PRIVATE_KEY in .env");
    process.exit(1);
}

const CONST_RPC = process.env.MONAD_RPC_URL || 'https://rpc-mainnet.monadinfra.com';

const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY);
const client = createWalletClient({
    account,
    chain: {
        id: 143,
        name: 'Monad Mainnet',
        network: 'monad-mainnet',
        nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
        rpcUrls: { default: { http: [CONST_RPC] } }
    },
    transport: http()
}).extend(publicActions);

const ABI = [
    parseAbiItem('event DiceRequested(uint256 indexed roundId, address requester)'),
    parseAbiItem('function fulfillRandomness(uint256 _roundId, bytes32 _randomness) external')
];

async function main() {
    console.log(`🔮 LOCAL ORACLE STARTED`);
    console.log(`   Address: ${account.address}`);
    console.log(`   Target:  ${CONTRACT_ADDRESS}`);
    console.log(`   Listening for DiceRequested...`);

    // Watch for Events
    client.watchEvent({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem('event DiceRequested(uint256 indexed roundId, address requester)'),
        onLogs: async (logs) => {
            for (const log of logs) {
                const roundId = log.args.roundId;
                const requester = log.args.requester;
                console.log(`\n⚡ REQUEST RECEIVED: Round ${roundId} from ${requester}`);

                try {
                    // Generate Secure Randomness (Local Node)
                    const randomness = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
                    console.log(`   🎲 Randomness Generated: ${randomness.slice(0, 10)}...`);

                    // Fulfill
                    console.log(`   📤 Submitting Fulfillment...`);
                    const hash = await client.writeContract({
                        address: CONTRACT_ADDRESS,
                        abi: ABI,
                        functionName: 'fulfillRandomness',
                        args: [roundId, randomness]
                    });

                    console.log(`   ✅ Fulfillment Tx: ${hash}`);
                } catch (err) {
                    console.error(`   ❌ Falied to fulfill: ${err.message}`);
                }
            }
        }
    });

    // Keep process alive
    await new Promise(() => { });
}

main().catch(console.error);
