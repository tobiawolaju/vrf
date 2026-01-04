import { keccak256, bytesToHex, hexToBytes } from 'viem';

/**
 * SWITCHBOARD VRF LIBRARY (FRONTEND)
 * 
 * Flow:
 * 1. Player calls requestDiceRoll (On-chain)
 * 2. Backend (Crank) detects DiceRequested event
 * 3. Backend fetches proof from Crossbar API
 * 4. Backend calls settleAndFulfill on-chain
 */

export const CONTRACT_ADDRESS = "0xc0c6c5d63ACed3bD7Dd85ef2e89FFE0464A7660d"; // Simulated Switchboard Deployment
export const SWITCHBOARD_CROSSBAR_URL = "https://crossbar.switchboard.xyz";

export const DICEROLLER_ABI = [
    {
        "type": "function",
        "name": "requestDiceRoll",
        "inputs": [
            { "name": "roundId", "type": "uint256" },
            { "name": "gameId", "type": "string" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "settleAndFulfill",
        "inputs": [
            { "name": "proof", "type": "bytes" },
            { "name": "requestId", "type": "bytes32" }
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "getDiceStatus",
        "inputs": [{ "name": "roundId", "type": "uint256" }],
        "outputs": [
            { "name": "requested", "type": "bool" },
            { "name": "fulfilled", "type": "bool" },
            { "name": "result", "type": "uint8" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "diceResults",
        "inputs": [{ "name": "roundId", "type": "uint256" }],
        "outputs": [{ "name": "", "type": "uint8" }],
        "stateMutability": "view"
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

/**
 * Step 1: Request Roll (Player Signs)
 */
export async function requestHardenedRoll(roundId, gameId, walletClient, publicClient) {
    try {
        console.log(`🎲 [VRF] Requesting Switchboard Roll | Round: ${roundId} | Game: ${gameId}`);

        const [account] = await walletClient.getAddresses();

        const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'requestDiceRoll',
            args: [BigInt(roundId), gameId],
            account
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Request TX: ${hash}`);
        return { success: true, hash, receipt };
    } catch (e) {
        console.error("❌ requestHardenedRoll Error:", e.message);
        return { success: false, error: e.message };
    }
}

