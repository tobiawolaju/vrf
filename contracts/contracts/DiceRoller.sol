// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropy} from "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";

/**
 * @title DiceRoller
 * @notice Dice rolling contract using Pyth Entropy for verifiable randomness.
 * @dev Architecture: Oracle-Native VRF. 
 * The contract is the source of truth. The backend is read-only.
 * Request-Callback-Finalize flow is managed by Pyth Entropy.
 */
contract DiceRoller is IEntropyConsumer {
    // --- Errors ---
    error AlreadyFulfilled(uint256 roundId);
    error AlreadyRequested(uint256 roundId);
    error InvalidRandomness();
    error InsufficientFee(uint128 required, uint256 provided);
    error Unauthorized();

    // --- Events ---
    event DiceRequested(uint256 indexed roundId, uint64 sequenceNumber, address requester, bytes32 userCommitment);
    event DiceRolled(uint256 indexed roundId, uint8 result, uint256 randomness);

    // --- State ---
    IEntropy public immutable entropy;
    address public immutable entropyProvider;
    
    // roundId -> result (0 if pending or not started)
    mapping(uint256 => uint8) public diceResults;
    
    // roundId -> sequenceNumber
    mapping(uint256 => uint64) public roundToSequence;
    
    // sequenceNumber -> roundId (for callback routing)
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
     * @notice Step 1: Request a dice roll
     * @dev Player generates userRandom locally and submits userCommitment = keccak256(userRandom)
     * @param roundId The unique round identifier
     * @param userCommitment Player's random commitment
     */
    function requestDiceRoll(uint256 roundId, bytes32 userCommitment) external payable {
        if (roundToSequence[roundId] != 0) revert AlreadyRequested(roundId);
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);
        
        uint128 fee = getFee();
        if (msg.value < fee) revert InsufficientFee(fee, msg.value);

        // Request randomness from Pyth Entropy
        // This returns a sequenceNumber which handles the commit phase on Pyth's end
        uint64 sequenceNumber = entropy.requestWithCallback{value: fee}(
            entropyProvider,
            userCommitment
        );

        // Store mappings for internal routing
        roundToSequence[roundId] = sequenceNumber;
        sequenceToRound[sequenceNumber] = roundId;

        emit DiceRequested(roundId, sequenceNumber, msg.sender, userCommitment);

        // Refund excess payment
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }

    /**
     * @notice Internal Callback: Called by Pyth Entropy when randomness is revealed.
     * @dev This is the ONLY path for randomness fulfillment.
     * Triggered when someone (usually the requester) calls entropy.revealWithCallback(...)
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address, // provider (unused)
        bytes32 randomNumber
    ) internal override {
        uint256 roundId = sequenceToRound[sequenceNumber];
        
        // Safety checks
        if (roundId == 0) revert Unauthorized();
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);
        if (randomNumber == bytes32(0)) revert InvalidRandomness();

        // Derive dice result (1-3)
        // Note: randomness is combined (User Secret ^ Provider Secret) by Pyth
        uint8 result = uint8((uint256(randomNumber) % 3) + 1);

        // Store immutable result
        diceResults[roundId] = result;
        
        emit DiceRolled(roundId, result, uint256(randomNumber));
    }

    /**
     * @notice Required by IEntropyConsumer
     */
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /**
     * @notice Helper to check status
     */
    function getDiceStatus(uint256 roundId) external view returns (
        bool requested,
        bool fulfilled,
        uint8 result,
        uint64 sequenceNumber
    ) {
        sequenceNumber = roundToSequence[roundId];
        requested = (sequenceNumber != 0);
        result = diceResults[roundId];
        fulfilled = (result != 0);
    }
}
