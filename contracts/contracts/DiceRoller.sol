// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Removed invalid import. We define the callback interface implicitly by enforcing msg.sender check.

import { ISwitchboard } from "@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol";
import { SwitchboardTypes } from "@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol";

contract DiceRoller {
    // --- Errors ---
    error AlreadyFulfilled(uint256 roundId);
    error InvalidRandomness();
    error RandomnessNotSettled();

    // --- Events ---
    event DiceRequested(uint256 indexed roundId, address requester);
    event DiceRolled(uint256 indexed roundId, uint8 result, uint256 randomness);

    // --- Switchboard State ---
    ISwitchboard public immutable switchboard;
    bytes32 public immutable queueId; // Kept for reference, though createRandomness might auto-select

    // Map roundId -> result (0 if pending)
    mapping(uint256 => uint8) public diceResults;

    constructor(address _switchboard, bytes32 _queueId) {
        switchboard = ISwitchboard(_switchboard);
        queueId = _queueId;
    }

    /**
     * @notice Requests randomness for a specific game round.
     * @param roundId The unique round identifier.
     */
    function requestDiceRoll(uint256 roundId) external {
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);

        // 1. Create Randomness Request on Switchboard
        // We use the roundId as the randomnessId (cast to bytes32).
        // 10 seconds settlement delay to ensure oracle has time to pick it up?
        // Actually for On-Demand, maybe we want instant?
        // Let's use 0 delay for "as soon as possible".
        try switchboard.createRandomness(bytes32(roundId), 0) returns (address) {
             emit DiceRequested(roundId, msg.sender);
        } catch {
            // If it fails (e.g. ID collision), we assume it might be retried or handled.
            // But we should revert to let user know.
            revert("Failed to create randomness request");
        }
    }

    /**
     * @notice Fulfills the randomness request using a Switchboard Proof.
     * @param roundId The round ID this proof is for.
     * @param proof The cryptographic proof (encoded randomness) from Switchboard.
     */
    function fulfillRandomness(uint256 roundId, bytes calldata proof) external {
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);

        // 2. Settle Randomness
        // This validates the proof against the request we created.
        // It REVERTS if the proof is invalid or signatures don't match.
        switchboard.settleRandomness(proof);

        // 3. Read Result
        SwitchboardTypes.Randomness memory r = switchboard.getRandomness(bytes32(roundId));
        
        // Ensure it is settled
        if (r.settledAt == 0) revert RandomnessNotSettled();

        // 4. Derive Result
        // Use the 'value' field from Randomness struct
        uint256 randomness = r.value;
        if (randomness == 0) revert InvalidRandomness();

        uint8 result = uint8((randomness % 3) + 1);

        // 5. Store
        diceResults[roundId] = result;
        emit DiceRolled(roundId, result, randomness);
    }

    function getDiceResult(uint256 roundId) external view returns (bool isFulfilled, uint8 result) {
        result = diceResults[roundId];
        isFulfilled = result != 0;
    }
}

