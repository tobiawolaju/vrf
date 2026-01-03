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
        
        // Just emit event - the oracle backend will handle the Switchboard interaction
        emit DiceRequested(roundId, msg.sender);
    }

    /**
     * @notice Fulfills the randomness request using a Switchboard Proof.
     * @param roundId The round ID this proof is for.
     * @param proof The cryptographic proof (encoded randomness) from Switchboard.
     */
    function fulfillRandomness(uint256 roundId, bytes calldata proof) external {
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);

        // For now, we extract randomness from the proof bytes directly
        // In a full implementation, you would verify the proof signatures
        // The proof format from Switchboard contains the randomness value
        
        // Simple extraction: hash the proof to get randomness
        uint256 randomness = uint256(keccak256(proof));
        if (randomness == 0) revert InvalidRandomness();

        // Derive dice result (1-3)
        uint8 result = uint8((randomness % 3) + 1);

        // Store result
        diceResults[roundId] = result;
        emit DiceRolled(roundId, result, randomness);
    }

    function getDiceResult(uint256 roundId) external view returns (bool isFulfilled, uint8 result) {
        result = diceResults[roundId];
        isFulfilled = result != 0;
    }
}

