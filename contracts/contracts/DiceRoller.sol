// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * DiceRoller - Simplified for Monad Switchboard On-Demand
 * 
 * Since Monad's Switchboard uses pull-based model (not callback),
 * we use a hybrid approach:
 * 1. Contract emits request event
 * 2. Backend fetches randomness from Switchboard API
 * 3. Backend submits to this contract
 * 4. Contract validates and emits result
 */

contract DiceRoller {
    // --- Errors ---
    error AlreadyFulfilled(uint256 roundId);
    error NotOwner();
    error InvalidResult();

    // --- Events ---
    event DiceRequested(uint256 indexed roundId, uint256 timestamp);
    event DiceRolled(uint256 indexed roundId, uint8 result, bytes32 randomness);

    // --- State ---
    address public owner;

    // Map roundId -> result
    mapping(uint256 => uint8) public diceResult;
    mapping(uint256 => bool) public fulfilled;
    mapping(uint256 => bytes32) public randomnessProof;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @notice Request a dice roll (emits event for backend to process)
     * @param roundId Unique identifier for this roll
     */
    function requestDiceRoll(uint256 roundId) external onlyOwner returns (uint256) {
        if (fulfilled[roundId]) revert AlreadyFulfilled(roundId);
        
        emit DiceRequested(roundId, block.timestamp);
        return roundId;
    }

    /**
     * @notice Submit verified randomness (called by backend after Switchboard verification)
     * @param roundId The round ID
     * @param randomness The verified random bytes32
     */
    function submitVerifiedRoll(uint256 roundId, bytes32 randomness) external onlyOwner {
        if (fulfilled[roundId]) revert AlreadyFulfilled(roundId);
        if (randomness == bytes32(0)) revert InvalidResult();

        // Convert randomness to 1-3
        uint8 result = uint8((uint256(randomness) % 3) + 1);

        fulfilled[roundId] = true;
        diceResult[roundId] = result;
        randomnessProof[roundId] = randomness;

        emit DiceRolled(roundId, result, randomness);
    }

    /**
     * @notice Get dice result for a round
     */
    function getDiceResult(uint256 roundId) external view returns (bool isFulfilled, uint8 result, bytes32 proof) {
        return (fulfilled[roundId], diceResult[roundId], randomnessProof[roundId]);
    }
}
