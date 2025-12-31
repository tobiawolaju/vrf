/**
 * On-Chain Dice Roll Test Script
 * 
 * This script triggers a real Switchboard VRF request on Monad Mainnet
 * and waits for the verified result.
 * 
 * Usage: node roll-dice.js
 * 
 * Make sure .env has:
 * - ADMIN_PRIVATE_KEY
 * - DICEROLLER_ADDRESS
 */

import { createWalletClient, http, publicActions, getContract, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

// Colors
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Monad Mainnet configuration
const monadMainnet = {
    id: 41454,
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

// Contract configuration
const DICEROLLER_ABI = [
    {
        type: "function",
        name: "requestDiceRoll",
        inputs: [{ name: "roundId", type: "uint256" }],
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "nonpayable"
    },
    {
        type: "event",
        name: "DiceRolled",
        inputs: [
            { name: "roundId", type: "uint256", indexed: true },
            { name: "result", type: "uint8", indexed: false }
        ],
        anonymous: false
    },
    {
        type: "function",
        name: "getDiceResult",
        inputs: [{ name: "roundId", type: "uint256" }],
        outputs: [
            { name: "isFulfilled", type: "bool" },
            { name: "result", type: "uint8" }
        ],
        stateMutability: "view"
    }
];

const CONTRACT_ADDRESS = process.env.DICEROLLER_ADDRESS || "0x466b833b1f3cD50A14bC34D68fAD6be996DC74Ea";

async function rollDice() {
    log('blue', '\n🎲 ON-CHAIN DICE ROLL TEST');
    log('blue', '═══════════════════════════════════════════\n');

    // Check environment
    if (!process.env.ADMIN_PRIVATE_KEY) {
        log('red', '❌ Error: ADMIN_PRIVATE_KEY not set in .env');
        log('yellow', 'Add your private key to frontend/.env');
        process.exit(1);
    }

    try {
        // Setup wallet and contract
        log('yellow', '⚙️  Setting up connection...');
        const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY);
        const walletClient = createWalletClient({
            account,
            chain: monadMainnet,
            transport: http(),
        }).extend(publicActions);

        log('green', `✓ Connected as: ${account.address}\n`);

        const contract = getContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            client: walletClient
        });

        // Generate unique round ID
        const roundId = BigInt(Date.now());
        log('yellow', `🎯 Round ID: ${roundId}\n`);

        // Request dice roll
        log('yellow', '📡 Requesting on-chain randomness...');
        log('blue', `   Contract: ${CONTRACT_ADDRESS}`);

        const requestTxHash = await contract.write.requestDiceRoll([roundId]);

        log('green', `✓ Request submitted!`);
        log('blue', `   Tx Hash: ${requestTxHash}`);
        log('magenta', `   View: https://monadvision.com/tx/${requestTxHash}\n`);

        // Wait for transaction confirmation
        log('yellow', '⏳ Waiting for transaction confirmation...');
        const receipt = await walletClient.waitForTransactionReceipt({
            hash: requestTxHash,
            confirmations: 1
        });
        log('green', `✓ Request confirmed in block ${receipt.blockNumber}\n`);

        // Listen for DiceRolled event
        log('yellow', '👂 Listening for Switchboard Oracle response...');
        log('blue', '   (This may take 5-30 seconds)\n');

        const timeout = 120000; // 2 minutes timeout
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const unwatch = contract.watchEvent.DiceRolled(
                { roundId },
                {
                    onLogs: async (logs) => {
                        for (const log of logs) {
                            if (log.args.roundId.toString() === roundId.toString()) {
                                const result = log.args.result;
                                const resultTxHash = log.transactionHash;

                                unwatch();

                                console.log('\n');
                                console.log(colors.green + '═══════════════════════════════════════════' + colors.reset);
                                console.log(colors.green + '🎉 DICE ROLLED - VERIFIED RESULT' + colors.reset);
                                console.log(colors.green + '═══════════════════════════════════════════' + colors.reset);
                                console.log('');
                                console.log(colors.magenta + `   🎲 Result: ${result}` + colors.reset);
                                console.log(colors.blue + `   🔗 Round ID: ${roundId}` + colors.reset);
                                console.log('');
                                console.log(colors.yellow + '📜 Verification:' + colors.reset);
                                console.log(colors.blue + `   Request Tx:  ${requestTxHash}` + colors.reset);
                                console.log(colors.green + `   Result Tx:   ${resultTxHash}` + colors.reset);
                                console.log('');
                                console.log(colors.magenta + `   🔍 Verify on Explorer:` + colors.reset);
                                console.log(colors.blue + `   https://monadvision.com/tx/${resultTxHash}` + colors.reset);
                                console.log('');
                                console.log(colors.green + '✅ Randomness verified by Switchboard Oracle on Monad!' + colors.reset);
                                console.log('');

                                resolve({ result, resultTxHash, requestTxHash, roundId });
                            }
                        }
                    },
                    onError: (error) => {
                        unwatch();
                        reject(error);
                    }
                }
            );

            // Timeout handler
            setTimeout(() => {
                unwatch();
                log('red', '\n❌ Timeout waiting for Oracle response');
                log('yellow', 'Possible reasons:');
                log('yellow', '  - Switchboard Oracle queue is busy');
                log('yellow', '  - Insufficient gas/fees');
                log('yellow', '  - Network congestion');
                log('blue', `\nCheck request transaction: https://monadvision.com/tx/${requestTxHash}`);
                reject(new Error('Timeout'));
            }, timeout);

            // Progress indicator
            const progressInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                process.stdout.write(`\r   ⏱️  Waiting... ${elapsed}s`);
            }, 1000);

            // Clear interval when done
            setTimeout(() => clearInterval(progressInterval), timeout);
        });

    } catch (error) {
        log('red', `\n❌ Error: ${error.message}`);
        if (error.message.includes('insufficient funds')) {
            log('yellow', '\n💡 Your wallet needs MON for gas fees');
        }
        process.exit(1);
    }
}

// Run the script
rollDice()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        if (error.message !== 'Timeout') {
            console.error(error);
        }
        process.exit(1);
    });
