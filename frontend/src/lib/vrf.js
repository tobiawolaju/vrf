import { keccak256, bytesToHex, hexToBytes } from 'viem';
import { resolveRound } from './gameLogic.js';

/**
 * ORACLE-NATIVE VRF LIBRARY (FRONTEND)
 * 
 * This library handles the trust-minimal VRF flow using Pyth Entropy.
 * The player's browser is responsible for:
 * 1. Generating local entropy (commitment secret)
 * 2. Requesting the roll on-chain
 * 3. Fetching the oracle's secret from Pyth Hermes
 * 4. Finalizing the roll on-chain
 */

// --- CONFIG ---
const CONTRACT_ADDRESS = "0x131e56853F087F74Dbd59f7c6581cd57201a5f34"; // DiceRoller.sol
const PYTH_ENTROPY_ADDRESS = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603";
const PYTH_PROVIDER = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344";

export const DICEROLLER_ABI = [
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
        "name": "getDiceStatus",
        "inputs": [{ "name": "roundId", "type": "uint256" }],
        "outputs": [
            { "name": "requested", "type": "bool" },
            { "name": "fulfilled", "type": "bool" },
            { "name": "result", "type": "uint8" },
            { "name": "sequenceNumber", "type": "uint64" }
        ],
        "stateMutability": "view"
    }
];

const PYTH_ABI = [
    {
        "type": "function",
        "name": "revealWithCallback",
        "inputs": [
            { "name": "provider", "type": "address" },
            { "name": "sequenceNumber", "type": "uint64" },
            { "name": "userReveal", "type": "bytes32" },
            { "name": "providerReveal", "type": "bytes32" }
        ],
        "outputs": [],
        "stateMutability": "payable"
    }
];

/**
 * Step 1: Generate Player Commitment
 */
export function generateVRFCommitment() {
    const userRandom = crypto.getRandomValues(new Uint8Array(32));
    const userRandomHex = bytesToHex(userRandom);
    const userCommitment = keccak256(userRandomHex);
    return { userRandomHex, userCommitment };
}

/**
 * Step 2: Request Roll (Player Signs)
 */
export async function requestRoll(roundId, userCommitment, walletClient, publicClient) {
    try {
        console.log(`🎲 [VRF] Requesting Roll for Round ${roundId}...`);

        const [account] = await walletClient.getAddresses();
        const fee = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'getFee'
        });

        const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'requestDiceRoll',
            args: [BigInt(roundId), userCommitment],
            value: fee,
            account
        });

        console.log(`   ✅ Request TX Sent: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Find sequenceNumber from logs if needed, or just poll DiceStatus later
        return { success: true, hash, receipt };
    } catch (e) {
        console.error("❌ requestRoll Error:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Step 3: Reveal (Player Signs)
 */
export async function finalizeRoll(roundId, userRandomHex, walletClient, publicClient) {
    try {
        console.log(`🔓 [VRF] Finalizing Roll for Round ${roundId}...`);

        // 1. Get sequenceNumber from contract
        const status = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'getDiceStatus',
            args: [BigInt(roundId)]
        });

        if (!status.requested) throw new Error("Roll not requested yet");
        if (status.fulfilled) return { success: true, alreadyFulfilled: true };

        const sequenceNumber = status.sequenceNumber;
        console.log(`   📝 Sequence Number: ${sequenceNumber}`);

        // 2. Fetch Provider Reveal from Pyth Hermes API
        console.log("   📡 Fetching Pyth provider reveal...");
        const revealResponse = await fetch(`https://hermes.pyth.network/v2/entropy/ops/reveal?sequence_number=${sequenceNumber}`);
        if (!revealResponse.ok) throw new Error("Failed to fetch reveal from Pyth Hermes");

        const revealData = await revealResponse.json();
        const providerReveal = revealData.provider_reveal;

        // 3. Reveal with Callback (Player Signs)
        const [account] = await walletClient.getAddresses();
        const hash = await walletClient.writeContract({
            address: PYTH_ENTROPY_ADDRESS,
            abi: PYTH_ABI,
            functionName: 'revealWithCallback',
            args: [PYTH_PROVIDER, sequenceNumber, userRandomHex, providerReveal],
            account
        });

        console.log(`   ✅ Reveal TX Sent: ${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });

        return { success: true, hash };
    } catch (e) {
        console.error("❌ finalizeRoll Error:", e.message);
        return { success: false, error: e.message };
    }
}
