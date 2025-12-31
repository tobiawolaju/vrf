// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
    Last Die Standing – Fairness Anchor Contract (Switchboard On-Demand Version)
    
    Updated to use the "Pull" model (On-Demand) as per Switchboard docs.
    Flow:
    1. requestDiceRoll(roundId) -> returns randomnessId
    2. ... Offchain: Wait for settlement ...
    3. ... Offchain: Fetch proof from Crossbar ...
    4. resolveDiceRoll(roundId, proof) -> Settle & Store Result
*/

/// -----------------------------------------------------------------------
/// Switchboard Interfaces
/// -----------------------------------------------------------------------
// In a real project, use: import { ISwitchboard } from "@switchboard-xyz/on-demand-solidity/ISwitchboard.sol";
// We define minimal interfaces here for portability if SDK is not installed.

struct RandomnessResult {
    bytes32 randId;
    uint256 createdAt;
    address authority;
    uint256 rollTimestamp;
    uint64 minSettlementDelay;
    address oracle;
    uint256 value;
    uint256 settledAt;
}

interface ISwitchboard {
    function requestRandomness(
        bytes32 randomnessId,
        address authority,
        bytes32 queueId,
        uint64 minSettlementDelay
    ) external;

    function updateFeeds(bytes[] calldata updates) external;

    function getRandomness(bytes32 randomnessId) external view returns (RandomnessResult memory);
    
    function settleRandomness(bytes calldata encodedRandomness) external payable;
}

contract DiceRoller {
    /// -------------------------------------------------------------------
    /// Errors
    /// -------------------------------------------------------------------
    error AlreadyFulfilled(uint256 roundId);
    error RoundNotRequested(uint256 roundId);
    error RandomnessNotReady();

    /// -------------------------------------------------------------------
    /// Events
    /// -------------------------------------------------------------------
    event DiceRequested(uint256 indexed roundId, bytes32 randomnessId);
    event DiceLanded(uint256 indexed roundId, uint8 result);

    /// -------------------------------------------------------------------
    /// Storage
    /// -------------------------------------------------------------------
    ISwitchboard public switchboard;
    bytes32 public queueId;

    // roundId => randomnessId
    mapping(uint256 => bytes32) public roundToRandomnessId;
    
    // roundId => dice result (1-3)
    mapping(uint256 => uint8) public diceResults;
    
    // roundId => is fulfilled
    mapping(uint256 => bool) public isFulfilled;

    address public owner;

    /// -------------------------------------------------------------------
    /// Constructor
    /// -------------------------------------------------------------------
    // Monad Mainnet Switchboard: 0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67
    // Monad Testnet Switchboard: 0xD3860E2C66cBd5c969Fa7343e6912Eff0416bA33
    // Queue ID needs to be supplied based on network (see docs)
    constructor(address _switchboard, bytes32 _queueId) {
        switchboard = ISwitchboard(_switchboard);
        queueId = _queueId;
        owner = msg.sender;
    }

    /// -------------------------------------------------------------------
    /// Modifiers
    /// -------------------------------------------------------------------
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /// -------------------------------------------------------------------
    /// Step 1: Request Randomness
    /// -------------------------------------------------------------------
    function requestDiceRoll(uint256 roundId) external onlyOwner {
        if (isFulfilled[roundId]) revert AlreadyFulfilled(roundId);
        
        // Generate verifiable unique ID
        bytes32 randomnessId = keccak256(abi.encodePacked(block.timestamp, msg.sender, roundId));
        
        roundToRandomnessId[roundId] = randomnessId;

        // Request from Switchboard
        // We set authority to address(this) so only this contract can settle it (optional, but good practice)
        switchboard.requestRandomness(
            randomnessId,
            address(this),
            queueId,
            5 // minSettlementDelay (seconds) - 5s is safe for clock skew
        );

        emit DiceRequested(roundId, randomnessId);
    }

    /// -------------------------------------------------------------------
    /// Step 2: Resolve / Settle (Called after fetching proof)
    /// -------------------------------------------------------------------
    // The backend calls this with the proof fetched from Switchboard Crossbar API
    function resolveDiceRoll(uint256 roundId, bytes[] calldata updates) external payable {
        if (isFulfilled[roundId]) revert AlreadyFulfilled(roundId);
        bytes32 rId = roundToRandomnessId[roundId];
        if (rId == bytes32(0)) revert RoundNotRequested(roundId);

        // 1. Submit proofs to Switchboard
        switchboard.updateFeeds(updates);

        // 2. Read the result
        RandomnessResult memory res = switchboard.getRandomness(rId);
        
        // Ensure it is settled
        if (res.settledAt == 0) revert RandomnessNotReady();

        // 3. Derive Dice Value (1-3)
        // Use the raw random value
        uint8 result = uint8((res.value % 3) + 1);

        diceResults[roundId] = result;
        isFulfilled[roundId] = true;

        emit DiceLanded(roundId, result);
    }
    
    // View function for frontend/backend to check status
    function getRoundResult(uint256 roundId) external view returns (bool, uint8) {
        return (isFulfilled[roundId], diceResults[roundId]);
    }
}
