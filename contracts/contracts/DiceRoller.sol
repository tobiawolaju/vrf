// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@switchboard-xyz/on-demand-solidity/interfaces/ISwitchboard.sol";
import "@switchboard-xyz/on-demand-solidity/libraries/SwitchboardTypes.sol";

/**
 * @title IRandomnessModule
 * @notice Interface for Switchboard Randomness Module (queue-based)
 */
interface IRandomnessModule {
    function requestRandomness(
        bytes32 randomnessId,
        address authority,
        bytes32 queueId,
        uint64 minSettlementDelay
    ) external;
}

/**
 * @title DiceRoller
 * @notice A Switchboard-powered VRF implementation with Simulation Fallback.
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

    // Monad Mainnet Switchboard Addresses
    address public constant SWITCHBOARD = 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67;
    bytes32 public constant SWITCHBOARD_QUEUE = 0x86807068432f186a147cf0b13a30067d386204ea9d6c8b04743ac2ef010b0752;

    bool public simulationMode = true; // Set to false when Switchboard is stable
    address public owner;

    // Mapping from Switchboard requestId to metadata
    mapping(bytes32 => RollRequest) public requests;
    // Mapping from roundId to result (1-3)
    mapping(uint256 => uint8) public diceResults;
    // Prevent double requests for the same roundId
    mapping(uint256 => bool) public roundRequested;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function setSimulationMode(bool _mode) external onlyOwner {
        simulationMode = _mode;
    }

    /**
     * @notice Step 1: Request a dice roll.
     */
    function requestDiceRoll(
        uint256 roundId, 
        string calldata gameId
    ) external {
        if (roundRequested[roundId]) revert AlreadyRequested(roundId);
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);
        
        bytes32 requestId = keccak256(abi.encodePacked(roundId, gameId, block.timestamp, msg.sender));
        
        if (simulationMode) {
            // Pseudo-random result for testing UI/Logic
            uint256 pseudoRand = uint256(keccak256(abi.encodePacked(block.timestamp, requestId)));
            uint8 result = uint8((pseudoRand % 3) + 1);
            diceResults[roundId] = result;
            emit DiceRolled(roundId, gameId, result, pseudoRand);
        } else {
            // Register request with Switchboard
            IRandomnessModule(SWITCHBOARD).requestRandomness(
                requestId, 
                address(this), 
                SWITCHBOARD_QUEUE, 
                0
            );
        }

        requests[requestId] = RollRequest({
            roundId: roundId,
            gameId: gameId,
            fulfilled: simulationMode
        });
        roundRequested[roundId] = true;

        emit DiceRequested(roundId, gameId, requestId, msg.sender);
    }

    /**
     * @notice Step 2: Settle and Fulfill (Crank/Real Switchboard only)
     */
    function settleAndFulfill(bytes calldata proof, bytes32 requestId) external payable {
        if (simulationMode) revert Unauthorized();
        
        RollRequest storage req = requests[requestId];
        if (req.roundId == 0) revert Unauthorized();
        if (req.fulfilled) revert AlreadyFulfilled(req.roundId);

        ISwitchboard(SWITCHBOARD).settleRandomness{value: msg.value}(proof);
        
        SwitchboardTypes.Randomness memory rand = ISwitchboard(SWITCHBOARD).getRandomness(requestId);
        if (rand.settledAt == 0) revert InvalidRandomness();

        uint8 result = uint8((rand.value % 3) + 1);

        diceResults[req.roundId] = result;
        req.fulfilled = true;
        
        emit DiceRolled(req.roundId, req.gameId, result, rand.value);
    }

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

