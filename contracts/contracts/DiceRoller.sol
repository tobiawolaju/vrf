// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISwitchboard} from "@switchboard-xyz/on-demand-solidity/ISwitchboard.sol";
import {Structs} from "@switchboard-xyz/on-demand-solidity/structs/Structs.sol";

/*
    Last Die Standing – Fairness Anchor Contract (Switchboard On-Demand Ver.)
*/

contract DiceRoller {
    // --- Errors ---
    error AlreadyFulfilled(uint256 roundId);
    error RandomnessNotSettled();
    error NotOwner();

    // --- Events ---
    event DiceRequested(uint256 indexed roundId, bytes32 randomnessId);
    event DiceRolled(uint256 indexed roundId, uint8 result);

    // --- Storage ---
    ISwitchboard public switchboard;
    address public owner;
    bytes32 public queueId; // Monad Mainnet or Testnet Queue ID

    // Map roundId -> randomnessId
    mapping(uint256 => bytes32) public roundToRandomnessId;
    
    // Map randomnessId -> roundId
    mapping(bytes32 => uint256) public randomnessIdToRound;

    // Map roundId -> result
    mapping(uint256 => uint8) public diceResult;
    mapping(uint256 => bool) public fulfilled;

    constructor(address _switchboard, bytes32 _queueId) {
        switchboard = ISwitchboard(_switchboard);
        queueId = _queueId;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // 1. Request Randomness
    function requestDiceRoll(uint256 roundId) external onlyOwner returns (bytes32) {
        if (fulfilled[roundId]) revert AlreadyFulfilled(roundId);

        // Create unique ID based on sender, block, and round
        bytes32 randomnessId = keccak256(abi.encodePacked(msg.sender, block.timestamp, roundId));
        
        roundToRandomnessId[roundId] = randomnessId;
        randomnessIdToRound[randomnessId] = roundId;

        // Request from Switchboard
        // minSettlementDelay = 5 seconds (adjust as needed)
        switchboard.requestRandomness(randomnessId, address(this), queueId, 5);

        emit DiceRequested(roundId, randomnessId);
        return randomnessId;
    }

    // 2. Resolve Randomness (Called by backend with proof from Crossbar)
    // Note: The docs call this 'resolve' or 'settleRandomness' wrapper.
    function resolveDiceRoll(bytes[] calldata updates) external payable {
        // 1. Submit proofs to Switchboard
        // 'updates' contains the encoded randomness from Crossbar
        // This makes the randomness available via switchboard.getRandomness(id)
        switchboard.updateFeeds(updates);

        // We can't easily know WHICH randomnessId was just updated inside this generic call unless passed?
        // Actually, updateFeeds updates the Oracle state. We still need to know which ID to read.
        // Usually, the caller knows. But strictly speaking, we want to settle a SPECIFIC round.
        // Let's pass the roundId or randomnessId to verify it settled.
    }

    // Revised Resolve Approach: 
    // The Standard Pattern updates feeds AND reads the result in one go to ensure atomicity.
    function resolveRound(uint256 roundId, bytes[] calldata updates) external payable {
        if (fulfilled[roundId]) revert AlreadyFulfilled(roundId);
        
        bytes32 rId = roundToRandomnessId[roundId];
        require(rId != bytes32(0), "Round not requested");

        // Update Switchboard State
        // This consumes value (fee) if required, though typically updateFeeds fee is paid here?
        // Switchboard `settleRandomness` might be a better direct call if using that API?
        // Docs > "Step 3: Setup Update Feed Handler ... function resolve(bytes[] calldata switchboardUpdateFeeds)"
        // Inside: switchboard.updateFeeds(...); randomness = switchboard.getRandomness(id).result;
        
        switchboard.updateFeeds{ value: msg.value }(updates);

        Structs.RandomnessResult memory randomness = switchboard.getRandomness(rId).result;
        
        // Ensure it settled
        if (randomness.settledAt == 0) revert RandomnessNotSettled();

        // Convert to 1-3
        uint8 result = uint8((randomness.value % 3) + 1);

        fulfilled[roundId] = true;
        diceResult[roundId] = result;

        emit DiceRolled(roundId, result);
    }

    // View
    function getDiceResult(uint256 roundId) external view returns (bool isFulfilled, uint8 result) {
        return (fulfilled[roundId], diceResult[roundId]);
    }
}
