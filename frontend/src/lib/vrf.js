import { keccak256, bytesToHex, hexToBytes, encodeAbiParameters, parseAbiParameters } from 'viem';

/**
 * HARDENED VRF LIBRARY (FRONTEND)
 * 
 * Implements Commitment Binding:
 * userReveal = H(userSecret, roundId, gameId, playerAddress)
 * userCommitment = H(userReveal)
 */

const CONTRACT_ADDRESS = "0x18250AffA8C219D703f2D756027186DB2574B0db";
const PYTH_ENTROPY_ADDRESS = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603";
const PYTH_PROVIDER = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344";
const BACKEND_URL = "/api";

export const DICEROLLER_ABI = [
    {
        "type": "function",
        "name": "requestDiceRoll",
        "inputs": [
            { "name": "roundId", "type": "uint256" },
            { "name": "gameId", "type": "string" },
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
            { "name": "result", "type": "uint8" }
        ],
        "stateMutability": "view"
    }
];

/**
 * Step 1: Generate Hardened Commitment
 * userReveal = keccak256(abi.encode(userSecret, roundId, gameId, msg.sender))
 */
export async function generateHardenedCommitment(roundId, gameId, playerAddress) {
    // 1. Generate 32 bytes of high-entropy secret
    const userSecret = crypto.getRandomValues(new Uint8Array(32));
    const userSecretHex = bytesToHex(userSecret);

    // 2. Bind to context: H(secret, roundId, gameId, player)
    // Solidity: abi.encode(bytes32, uint256, string, address)
    const encoded = encodeAbiParameters(
        parseAbiParameters('bytes32, uint256, string, address'),
        [userSecretHex, BigInt(roundId), gameId, playerAddress]
    );

    const userReveal = keccak256(encoded);
    const userCommitment = keccak256(userReveal);

    return { userSecretHex, userReveal, userCommitment };
}

/**
 * Step 2: Request Roll (Player Signs)
 */
export async function requestHardenedRoll(roundId, gameId, userCommitment, walletClient, publicClient) {
    try {
        console.log(`🎲 [VRF] Requesting Hardened Roll | Round: ${roundId} | Game: ${gameId}`);

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
            args: [BigInt(roundId), gameId, userCommitment],
            value: fee,
            account
        });

        console.log(`   ✅ Request TX: ${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });
        return { success: true, hash };
    } catch (e) {
        console.error("❌ requestHardenedRoll Error:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Step 3: Share Reveal Secret with Backend (For Crank Fallback)
 * This ensures the round completes even if the player goes offline.
 */
export async function shareRevealSecret(roundId, userReveal) {
    try {
        console.log(`📡 [VRF] Sharing Reveal Secret for Round ${roundId}...`);
        const res = await fetch(`${BACKEND_URL}/submit-secret`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId: roundId.toString(), userReveal })
        });
        return await res.json();
    } catch (e) {
        console.error("❌ shareRevealSecret Error:", e.message);
        return { success: false, error: e.message };
    }
}
