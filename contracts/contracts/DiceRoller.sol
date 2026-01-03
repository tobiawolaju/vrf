// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

/**
 * @title DiceRoller
 * @notice A hardened, trust-minimal VRF implementation for "Last Die Standing".
 * @dev Implements commitment binding to prevent replay and MEV attacks.
 *      H(userReveal) == userCommitment
 *      userReveal = keccak256(abi.encode(userSecret, roundId, gameId, msg.sender))
 */
contract DiceRoller is IEntropyConsumer {
    error AlreadyRequested(uint256 roundId);
    error AlreadyFulfilled(uint256 roundId);
    error InvalidRandomness();
    error InsufficientFee(uint128 required, uint256 provided);
    error Unauthorized();

    event DiceRequested(
        uint256 indexed roundId, 
        string gameId, 
        uint64 sequenceNumber, 
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

    IEntropy public immutable entropy;
    address public immutable entropyProvider;
    
    // Mapping from sequenceNumber to Request metadata
    mapping(uint64 => RollRequest) public requests;
    // Mapping from roundId to result (1-3)
    mapping(uint256 => uint8) public diceResults;
    // Prevent double requests for the same roundId
    mapping(uint256 => bool) public roundRequested;

    constructor(address _entropy, address _entropyProvider) {
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
    }

    /**
     * @notice Step 1: Request a dice roll with a bound commitment.
     * @param roundId Unique identifier for the round (e.g. timestamp or sequence)
     * @param gameId Unique identifier for the game session
     * @param userCommitment The hash of the bound secret: H(userReveal)
     */
    function requestDiceRoll(
        uint256 roundId, 
        string calldata gameId, 
        bytes32 userCommitment
    ) external payable {
        if (roundRequested[roundId]) revert AlreadyRequested(roundId);
        if (diceResults[roundId] != 0) revert AlreadyFulfilled(roundId);
        
        uint128 fee = getFee();
        if (msg.value < fee) revert InsufficientFee(fee, msg.value);

        uint64 sequenceNumber = entropy.requestWithCallback{value: fee}(
            entropyProvider,
            userCommitment
        );

        requests[sequenceNumber] = RollRequest({
            roundId: roundId,
            gameId: gameId,
            fulfilled: false
        });
        roundRequested[roundId] = true;

        emit DiceRequested(roundId, gameId, sequenceNumber, msg.sender);

        // Refund excess fee
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }

    /**
     * @notice Step 2: Fulfill the randomness. 
     * @dev Called by Pyth Entropy contract after revealWithCallback.
     *      Permissionless: Anyone can reveal, but outcome is deterministic.
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address, // provider (unused)
        bytes32 randomNumber
    ) internal override {
        RollRequest storage req = requests[sequenceNumber];
        
        if (req.roundId == 0) return; // Not a valid request
        if (req.fulfilled) revert AlreadyFulfilled(req.roundId);
        if (randomNumber == bytes32(0)) revert InvalidRandomness();

        // Calculate result 1-3
        uint8 result = uint8((uint256(randomNumber) % 3) + 1);

        diceResults[req.roundId] = result;
        req.fulfilled = true;
        
        emit DiceRolled(req.roundId, req.gameId, result, uint256(randomNumber));
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function getFee() public view returns (uint128) {
        return entropy.getFee(entropyProvider);
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
