// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISwitchboard} from "@switchboard-xyz/on-demand-solidity/ISwitchboard.sol";

// Abstract contract for handling callbacks
abstract contract SwitchboardCallbackHandler {
    error SwitchboardCallbackCallerNotSwitchboard();

    // The address of the Switchboard contract
    ISwitchboard public immutable switchboard;

    constructor(address _switchboard) {
        switchboard = ISwitchboard(_switchboard);
    }

    modifier onlySwitchboard() {
        if (msg.sender != address(switchboard)) {
            revert SwitchboardCallbackCallerNotSwitchboard();
        }
        _;
    }

    // This function is called by Switchboard to fulfill the request
    // The `randomnessId` is the unique ID of the request
    // The `randomness` is the result
    function switchboardCallback(
        bytes32 randomnessId,
        uint256[] calldata randomness
    ) external onlySwitchboard {
        onRandomnessReady(randomnessId, randomness);
    }

    function onRandomnessReady(
        bytes32 randomnessId,
        uint256[] calldata randomness
    ) internal virtual;
}

contract DiceRoller is SwitchboardCallbackHandler {
    // --- Errors ---
    error InvalidRoundId();
    error RoundAlreadyRolled();
    error RequestAlreadyPending();
    error NotOwner();

    // --- Events ---
    event DiceRequested(uint256 indexed roundId, bytes32 randomnessId);
    event DiceRolled(uint256 indexed roundId, uint8 result);

    // --- State ---
    address public owner;
    bytes32 public queueId; // The Switchboard Queue ID (Monad)

    // Mapping from randomnessId => roundId
    mapping(bytes32 => uint256) public randomnessIdToRound;
    
    // Mapping from roundId => completed
    mapping(uint256 => bool) public roundComplete;
    mapping(uint256 => uint8) public roundResult;

    constructor(address _switchboard, bytes32 _queueId) SwitchboardCallbackHandler(_switchboard) {
        owner = msg.sender;
        queueId = _queueId;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @notice Checks if a round is complete
     * @param roundId The ID of the round
     */
    function isRoundComplete(uint256 roundId) external view returns (bool) {
        return roundComplete[roundId];
    }

    /**
     * @notice Requests a dice roll (1-3) for a specific round.
     * @param roundId The ID of the round (gameCode hash + round count, or just unique ID)
     */
    function requestDiceRoll(uint256 roundId) external onlyOwner returns (bytes32) {
        if (roundComplete[roundId]) revert RoundAlreadyRolled();
        
        // 1. Request randomness from Switchboard
        // We use the current block timestamp + sender + roundId for uniqueness
        // But Switchboard handles the prompt. 
        // We effectively just call `requestRandomness`.
        
        // Note: In Callback pattern, we send the request to the router/switchboard
        // bytes memory callback = abi.encodePacked(this.switchboardCallback.selector);
        // But the abstract handler uses a specific interface.
        
        // Switchboard On-Demand `requestRandomness`:
        // function requestRandomness(
        //    bytes32 _queueId,
        //    uint32 _callbackPid, // 0 usually for derived
        //    bytes calldata _callbackParams, // We can pass roundId here!
        //    address _callbackContract,
        //    bytes4 _callbackFunctionId
        // ) external payable returns (bytes32);

        // We'll pass the roundId in the params so we can decode it in the callback?
        // OR we map the returned requestId to the roundId. Mapping is safer/standard.

        bytes32 requestId = switchboard.requestRandomness(
            queueId,
            0, // _callbackPid (not used for simple callback)
            new bytes(0), // _callbackParams
            address(this), // _callbackContract
            this.switchboardCallback.selector // _callbackFunctionId
        );

        randomnessIdToRound[requestId] = roundId;

        emit DiceRequested(roundId, requestId);
        return requestId;
    }

    /**
     * @notice Callback handler called by Switchboard
     */
    function onRandomnessReady(
        bytes32 randomnessId,
        uint256[] calldata randomness
    ) internal override {
        uint256 roundId = randomnessIdToRound[randomnessId];
        
        // Safety check: if this ID wasn't mapped, ignore (or revert)
        // If we revert, switchboard might retry? Better to just return if invalid state.
        if (roundId == 0 && randomnessIdToRound[bytes32(0)] != roundId) {
             // It's possible roundId 0 is valid, but let's assume 1-based or handle 0 specifically
        }
        
        if (roundComplete[roundId]) {
            return; // Already handled (shouldn't happen with unique IDs)
        }

        // --- THE LOGIC ---
        // Get the first random number
        uint256 randomValue = randomness[0];
        
        // Modulo 3 to get 0, 1, 2. Add 1 to get 1, 2, 3.
        uint8 result = uint8((randomValue % 3) + 1);

        roundResult[roundId] = result;
        roundComplete[roundId] = true;

        emit DiceRolled(roundId, result);
    }
}
