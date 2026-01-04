import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createPublicClient, http, decodeEventLog } from 'viem';

/**
 * @title VRF Event Indexer (Read-Only)
 * @notice This backend is strictly an observer. It does NOT hold private keys.
 * It listens for Monad events and updates the game database.
 */

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- Contract Config ---
const CONTRACT_ADDRESS = "0xc0c6c5d63ACed3bD7Dd85ef2e89FFE0464A7660d";

const DICEROLLER_ABI = [
    {
        "type": "event",
        "name": "DiceRequested",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "gameId", "type": "string", "indexed": false },
            { "name": "requestId", "type": "bytes32", "indexed": false },
            { "name": "requester", "type": "address", "indexed": false }
        ]
    },
    {
        "type": "event",
        "name": "DiceRolled",
        "inputs": [
            { "name": "roundId", "type": "uint256", "indexed": true },
            { "name": "gameId", "type": "string", "indexed": false },
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

// --- Clients ---
// Note: No WalletClient, only PublicClient (Read-Only)
const client = createPublicClient({
    chain: monadMainnet,
    transport: http(),
});

/**
 * @notice Start watching for events
 * In a real production app, this would use a persistent DB (Supabase/Redis).
 * Here we update the local game store (lib/store.js or similar if it were reachable).
 */
function watchEvents() {
    console.log(`📡 Indexer: Watching ${CONTRACT_ADDRESS} for VRF events...`);

    client.watchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: DICEROLLER_ABI,
        onLogs: (logs) => {
            logs.forEach(log => {
                const event = decodeEventLog({
                    abi: DICEROLLER_ABI,
                    data: log.data,
                    topics: log.topics
                });

                if (event.eventName === 'DiceRequested') {
                    const { roundId, requestId, requester } = event.args;
                    console.log(`🎲 [Log] DiceRequested: Round ${roundId} | ID ${requestId} | By ${requester}`);
                    // updateGameStatus(roundId, 'PENDING');
                }

                if (event.eventName === 'DiceRolled') {
                    const { roundId, result } = event.args;
                    console.log(`🏁 [Log] DiceRolled: Round ${roundId} | Result ${result}`);
                    // resolveRound(roundId, result);
                }
            });
        }
    });
}

// --- Health Check ---
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        mode: 'read-only-indexer',
        contract: CONTRACT_ADDRESS
    });
});

// START
watchEvents();
app.listen(PORT, () => {
    console.log(`🚀 Read-Only Indexer running on port ${PORT}`);
});
