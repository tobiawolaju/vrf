import { keccak256, hexToBytes, bytesToHex } from 'viem';

/**
 * ORACLE-NATIVE VRF ARCHITECTURE (FRONTEND PSEUDOCODE / LIB)
 * 
 * 1. Commit: Generate userRandom (32 bytes)
 * 2. Request: tx = requestDiceRoll(roundId, keccak256(userRandom))
 * 3. Fetch: Get providerReveal from Pyth Price Service
 * 4. Reveal: tx = entropy.revealWithCallback(provider, sequenceNumber, userRandom, providerReveal)
 * 5. Observe: Backend updates game state via DiceRolled event
 */

const ENTROPY_CONTRACT = "0x131e56853F087F74Dbd59f7c6581cd57201a5f34"; // DiceRoller.sol
const PYTH_ENTROPY_ADDRESS = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603";
const PYTH_PROVIDER = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344";

/**
 * Step 1: Generate Player Secret
 */
export function generateCommitment() {
    const userRandom = crypto.getRandomValues(new Uint8Array(32));
    const userRandomHex = bytesToHex(userRandom);
    const userCommitment = keccak256(userRandomHex);
    return { userRandomHex, userCommitment };
}

/**
 * Step 2: Orchestrate Roll (Full Client-Side Flow)
 */
export async function runOracleNativeRoll(roundId, walletClient, publicClient) {
    console.log("🎲 Starting Oracle-Native VRF Flow...");

    // 1. Generate commitment
    const { userRandomHex, userCommitment } = generateCommitment();

    // 2. Request Roll (Player Signs)
    // const fee = await publicClient.readContract({ ...getFee });
    // const txHash = await walletClient.writeContract({ ...requestDiceRoll(roundId, userCommitment) });
    console.log("📝 Requesting Roll on-chain...");

    // 3. Wait for DiceRequested event to get sequenceNumber
    // const logs = await publicClient.waitForTransactionReceipt({ hash: txHash });
    // const sequenceNumber = parseLogs(logs);
    const sequenceNumber = 42; // Placeholder

    // 4. Fetch Pyth Provider Reveal (Off-chain API)
    console.log("📡 Fetching Pyth provider reveal...");
    const revealResponse = await fetch(`https://hermes.pyth.network/v2/entropy/ops/reveal?sequence_number=${sequenceNumber}`);
    const { provider_reveal } = await revealResponse.json();

    // 5. Reveal (Player Signs)
    console.log("🔓 Finalizing Randomness...");
    // await walletClient.writeContract({ 
    //   address: PYTH_ENTROPY_ADDRESS, 
    //   functionName: 'revealWithCallback', 
    //   args: [PYTH_PROVIDER, sequenceNumber, userRandomHex, provider_reveal] 
    // });

    console.log("✅ Randomness revealed! Backend will index the result.");
}
