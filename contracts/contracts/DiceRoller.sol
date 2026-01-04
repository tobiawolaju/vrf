// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol";
import "@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol";

/**
 * @title DiceRoller
 * @notice A Switchboard-powered VRF implementation for "Last Die Standing".
 * @dev Uses the Request-Pull-Submit flow for trust-minimal randomness.
 */
contract DiceRoller {
    error AlreadyRequested(uint256 roundId);
    error AlreadyFulfilled(uint256 roundId);
    error InvalidRandomness();
    error Unauthorized();

    event DiceRequested(
        uint256 indexed roundId, 
        string gameId, 
        bytes32 requestId, 
        address requester
    );
    
    event DiceRolled(
        uint256 indexed roundId, 
        string gameId, 
        uint8 result, 
        uint256 randomness
    );

    struct RollRequest {
        uint256 roundId;
        string gameId;
        bool fulfilled;
    }

    // Monad Mainnet Switchboard Address
    address public constant SWITCHBOARD = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;

    // Mapping from Switchboard requestId to metadata
    mapping(bytes32 => RollRequest) public requests;
    // Mapping from roundId to result (1-3)
    mapping(uint256 => uint8) public diceResults;
    // Prevent double requests for the same roundId
    mapping(uint256 => bool) public roundRequested;

    /**
     * @notice Step 1: Request a dice roll via Switchboard.
     * @param roundId Unique identifier for the round
     * @param gameId Unique identifier for the game session
     */
    function requestDiceRoll(
        uint256 roundId, 
        string calldata gameId
    ) external {
        if (roundRequested[roundId]) revert AlreadyRequested(roundId);
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);
        
        // Generate a unique requestId from context
        bytes32 requestId = keccak256(abi.encodePacked(roundId, gameId, block.timestamp, msg.sender));
        
        // Register request with Switchboard
        ISwitchboard(SWITCHBOARD).createRandomness(requestId, 0);

        requests[requestId] = RollRequest({
            roundId: roundId,
            gameId: gameId,
            fulfilled: false
        });
        roundRequested[roundId] = true;

        emit DiceRequested(roundId, gameId, requestId, msg.sender);
    }

    /**
     * @notice Step 2: Settle and Fulfill the randomness.
     * @dev Called by the Crank after fetching the Switchboard proof.
     * @param proof The Switchboard VRF proof/fulfillment data
     * @param requestId The ID of the randomness request being fulfilled
     */
    function settleAndFulfill(bytes calldata proof, bytes32 requestId) external payable {
        RollRequest storage req = requests[requestId];
        if (req.roundId == 0) revert Unauthorized();
        if (req.fulfilled) revert AlreadyFulfilled(req.roundId);

        // 1. Settle on Switchboard
        ISwitchboard(SWITCHBOARD).settleRandomness{value: msg.value}(proof);
        
        // 2. Fetch the randomness value
        SwitchboardTypes.Randomness memory rand = ISwitchboard(SWITCHBOARD).getRandomness(requestId);
        if (rand.settledAt == 0) revert InvalidRandomness();

        // 3. Resolve result (1-3)
        uint8 result = uint8((rand.value % 3) + 1);

        diceResults[req.roundId] = result;
        req.fulfilled = true;
        
        emit DiceRolled(req.roundId, req.gameId, result, rand.value);
    }

    /**
     * @notice Get status of a dice roll
     */
    function getDiceStatus(uint256 roundId) external view returns (
        bool requested, 
        bool fulfilled, 
        uint8 result
    ) {
        requested = roundRequested[roundId];
        result = diceResults[roundId];
        fulfilled = result != 0;
    }
}

