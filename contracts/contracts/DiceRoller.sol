// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropy} from "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";

/**
 * @title DiceRoller
 * @notice Dice rolling contract using Pyth Entropy for verifiable randomness
 */
contract DiceRoller is IEntropyConsumer {
    // --- Errors ---
    error AlreadyFulfilled(uint256 roundId);
    error InvalidRandomness();
    error InsufficientFee(uint128 required, uint256 provided);
    error Unauthorized();

    // --- Events ---
    event DiceRequested(uint256 indexed roundId, uint64 sequenceNumber, address requester);
    event DiceRolled(uint256 indexed roundId, uint8 result, uint256 randomness);

    // --- State ---
    IEntropy public immutable entropy;
    address public immutable entropyProvider;
    
    // Map roundId -> result (0 if pending)
    mapping(uint256 => uint8) public diceResults;
    
    // Map roundId -> sequenceNumber (for tracking Pyth requests)
    mapping(uint256 => uint64) public roundToSequence;
    
    // Map sequenceNumber -> roundId (for callback)
    mapping(uint64 => uint256) public sequenceToRound;

    constructor(address _entropy, address _entropyProvider) {
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
    }

    /**
     * @notice Get the fee required for requesting randomness
     */
    function getFee() public view returns (uint128) {
        return entropy.getFee(entropyProvider);
    }

    /**
     * @notice Request a dice roll using Pyth Entropy
     * @param roundId The unique round identifier
     * @param userCommitment User's random commitment (keccak256 of random bytes)
     */
    function requestDiceRoll(uint256 roundId, bytes32 userCommitment) external payable {
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);
        
        uint128 fee = getFee();
        if (msg.value < fee) revert InsufficientFee(fee, msg.value);

        // Request randomness from Pyth Entropy
        uint64 sequenceNumber = entropy.requestWithCallback{value: fee}(
            entropyProvider,
            userCommitment
        );

        // Store mappings
        roundToSequence[roundId] = sequenceNumber;
        sequenceToRound[sequenceNumber] = roundId;

        emit DiceRequested(roundId, sequenceNumber, msg.sender);

        // Refund excess payment
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }

    /**
     * @notice Callback function called by Pyth Entropy with the random number
     * @param sequenceNumber The sequence number of the request
     * @param randomNumber The generated random number
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address, // provider (unused)
        bytes32 randomNumber
    ) internal override {
        uint256 roundId = sequenceToRound[sequenceNumber];
        
        if (randomNumber == bytes32(0)) revert InvalidRandomness();

        // Derive dice result (1-3)
        uint8 result = uint8((uint256(randomNumber) % 3) + 1);

        // Store result
        diceResults[roundId] = result;
        
        emit DiceRolled(roundId, result, uint256(randomNumber));
    }

    /**
     * @notice Get the Entropy contract address (required by IEntropyConsumer)
     */
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /**
     * @notice Get dice result for a round
     */
    function getDiceResult(uint256 roundId) external view returns (bool isFulfilled, uint8 result) {
        result = diceResults[roundId];
        isFulfilled = result != 0;
    }
}
