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

export const CONTRACT_ADDRESS = "0x4d2B7a429734348e0010d5cFB5B71D5cA99b86Ca"; // Pure Switchboard Deployment
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

/**
 * Step 2: Settle Roll (Client-Side / Host-Side)
 * Used when backend crank is slow or offline.
 */
export async function settleHardenedRoll(requestId, walletClient, publicClient) {
    try {
        console.log(`🔓 [VRF] Fetching Switchboard Proof for Req: ${requestId}...`);

        // Poll for proof (retry a few times)
        let proof = null;
        for (let i = 0; i < 10; i++) {
            try {
                const url = `${SWITCHBOARD_CROSSBAR_URL}/updates/eth/randomness?ids=${requestId}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.updates && data.updates.length > 0) {
                        proof = data.updates[0];
                        break;
                    }
                }
            } catch (err) { /* ignore network blips */ }
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s between polls
        }

        if (!proof) throw new Error("Could not fetch proof from Crossbar.");

        const [account] = await walletClient.getAddresses();
        const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: DICEROLLER_ABI,
            functionName: 'settleAndFulfill',
            args: [proof, requestId],
            account
        });

        console.log(`   ✅ Settle TX Sent: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { success: true, hash, receipt };

    } catch (e) {
        console.error("❌ settleHardenedRoll Error:", e.message);
        return { success: false, error: e.message };
    }
}

// --- REWARD NFT ---
export const REWARD_NFT_ADDRESS = "0xE7C41Ed19AE276bD2507b0377061617fa4E281E0";
export const REWARD_NFT_ABI = [
    {
        "type": "function",
        "name": "mintReward",
        "inputs": [{ "name": "player", "type": "address" }],
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "nonpayable"
    }
];

export async function mintVictoryBadge(walletClient, publicClient) {
    try {
        console.log("🏆 Minting Victory Badge...");
        const [account] = await walletClient.getAddresses();

        const hash = await walletClient.writeContract({
            address: REWARD_NFT_ADDRESS,
            abi: REWARD_NFT_ABI,
            functionName: 'mintReward',
            args: [account],
            account
        });

        console.log(`   ✅ Mint TX: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { success: true, hash, receipt };
    } catch (e) {
        console.error("❌ mintVictoryBadge Error:", e.message);
        return { success: false, error: e.message };
    }
}
