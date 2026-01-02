// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Removed invalid import. We define the callback interface implicitly by enforcing msg.sender check.

contract DiceRoller {
    // --- Errors ---
    error OnlySwitchboard();
    error AlreadyFulfilled(uint256 roundId);
    error InvalidRandomness();

    // --- Events ---
    // Emitted when game requests randomness. Backend listens to this.
    event DiceRequested(uint256 indexed roundId, address requester);
    
    // Emitted when Switchboard fulfills the request.
    event DiceRolled(uint256 indexed roundId, uint8 result, bytes32 randomness);

    // --- State ---
    address public immutable switchboard; // The only address allowed to callback
    
    // Map roundId -> result (0 if pending)
    mapping(uint256 => uint8) public diceResults;
    mapping(uint256 => bytes32) public randomnessProofs;

    constructor(address _switchboard) {
        switchboard = _switchboard;
    }

    /**
     * @notice Requests randomness for a specific game round.
     * @param roundId The unique round identifier (e.g. timestamp)
     */
    function requestDiceRoll(uint256 roundId) external {
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);
        emit DiceRequested(roundId, msg.sender);
    }

    /**
     * @notice Callback function called ONLY by the Switchboard Oracle.
     * @param _roundId The round ID passed back from the request context (or encoded)
     * @param _randomness The resolved randomness
     */
    // Note: The specific function signature depends on how the Switchboard Function is configured to call back.
    // Standard pattern often uses a specific selector or generic `callback`.
    // We will implement a generic handler that we expect the Oracle to target.
    function fulfillRandomness(uint256 _roundId, bytes32 _randomness) external {
        // 1. Validate Caller
        if (msg.sender != switchboard) revert OnlySwitchboard();

        // 2. Validate State
        if (diceResults[_roundId] != 0) revert AlreadyFulfilled(_roundId);
        if (_randomness == bytes32(0)) revert InvalidRandomness();

        // 3. Derive Logic (1-3 Dice)
        // result = (randomness % 3) + 1
        uint8 result = uint8((uint256(_randomness) % 3) + 1);

        // 4. Store
        diceResults[_roundId] = result;
        randomnessProofs[_roundId] = _randomness;

        // 5. Emit
        emit DiceRolled(_roundId, result, _randomness);
    }

    /**
     * @notice View function to check status
     */
    function getDiceResult(uint256 roundId) external view returns (bool isFulfilled, uint8 result) {
        result = diceResults[roundId];
        isFulfilled = result != 0;
    }
}

