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
 * @notice A pure Switchboard-powered VRF implementation for "Last Die Standing".
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

    address public owner;

    // Mapping from Switchboard requestId to metadata
    mapping(bytes32 => RollRequest) public requests;
    // Mapping from roundId to result (1-3)
    mapping(uint256 => uint8) public diceResults;
    // Prevent double requests for the same roundId
    mapping(uint256 => bool) public roundRequested;

    // Demo Mode State
    bool public demoMode = true;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function setDemoMode(bool _demoMode) external onlyOwner {
        demoMode = _demoMode;
    }

    /**
     * @notice Step 1: Request a dice roll via Switchboard.
     */
    function requestDiceRoll(
        uint256 roundId, 
        string calldata gameId
    ) external {
        if (roundRequested[roundId]) revert AlreadyRequested(roundId);
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);
        
        // Generate a unique requestId from context
        bytes32 requestId = keccak256(abi.encodePacked(roundId, gameId, block.timestamp, msg.sender));
        
        if (demoMode) {
            // Immediate resolution for Demo Mode (1-3)
            // Pseudo-random using block vars (NOT secure, mainly for testing/demo)
            uint256 pseudoRandom = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, roundId)));
            uint8 result = uint8((pseudoRandom % 3) + 1);
            
            diceResults[roundId] = result;
            roundRequested[roundId] = true;
            
            // Emit DiceRolled immediately
            emit DiceRolled(roundId, gameId, result, pseudoRandom);
        } else {
            // Register request with Switchboard using the Monad Mainnet Queue
            IRandomnessModule(SWITCHBOARD).requestRandomness(
                requestId, 
                address(this), 
                SWITCHBOARD_QUEUE, 
                1
            );

            requests[requestId] = RollRequest({
                roundId: roundId,
                gameId: gameId,
                fulfilled: false
            });
            roundRequested[roundId] = true;

            emit DiceRequested(roundId, gameId, requestId, msg.sender);
        }
    }

    /**
     * @notice Step 2: Settle and Fulfill (Called once Switchboard proof is available)
     */
    function settleAndFulfill(bytes calldata proof, bytes32 requestId) external payable {
        RollRequest storage req = requests[requestId];
        if (req.roundId == 0) revert Unauthorized();
        if (req.fulfilled) revert AlreadyFulfilled(req.roundId);

        // 1. Settle on Switchboard (Crossbar proof)
        ISwitchboard(SWITCHBOARD).settleRandomness{value: msg.value}(proof);
        
        // 2. Fetch the randomness result metadata
        SwitchboardTypes.Randomness memory rand = ISwitchboard(SWITCHBOARD).getRandomness(requestId);
        require(rand.settledAt != 0, "Randomness failed to Settle");

        // 3. Update game state with verified result (1-3)
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

