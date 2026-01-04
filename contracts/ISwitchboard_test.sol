// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { SwitchboardTypes } from '../libraries/SwitchboardTypes.sol';

/**
 * @title ISwitchboard
 * @notice Interface for the Switchboard contract
 */
interface ISwitchboard {
    // ==========================================================================
    // Feed Update Functions
    // ==========================================================================

    /**
     * Update feeds with new oracle results
     * @dev This is for backwards compatibility with Switchboard on-demand contracts
     * @dev reverts if the timestamp is out of valid range (optional flow for timestamp-sequenced updates)
     * @param updates Encoded switchboard update(s) with signatures
     */
    function updateFeeds(bytes[] calldata updates) external payable;

    /**
     * @notice Main API - Updates feeds from encoded bytes data
     * @param feeds The encoded feed update data as bytes
     * @return updateData The parsed FeedUpdateData struct
     */
    function updateFeeds(
        bytes calldata feeds
    )
        external
        payable
        returns (SwitchboardTypes.FeedUpdateData memory updateData);

    /**
     * @notice Gets a verified feed value or reverts
     * @param updateData The feed update data
     * @param feedId The ID of the feed
     * @return value The verified value of the feed
     * @return timestamp The verified timestamp of the feed
     * @return slotNumber The verified slot number of the feed
     */
    function getFeedValue(
        SwitchboardTypes.FeedUpdateData calldata updateData,
        bytes32 feedId
    )
        external
        view
        returns (int256 value, uint256 timestamp, uint64 slotNumber);

    /**
     * Get the latest Update struct for a feed
     * @dev This is for backwards compatibility with the old Switchboard contracts
     * @dev Intended to be called within the same transaction as a feed update for the most up-to-date data.
     * @dev Reverts if the feed does not have the minimum number of valid responses
     * @param feedId The identifier for the feed to get the latest update for
     * @return Update The latest update for the given feed (LegacyUpdate format for ABI compatibility)
     */
    function latestUpdate(
        bytes32 feedId
    ) external view returns (SwitchboardTypes.LegacyUpdate memory);

    /**
     * @notice Get the latest update for a feed
     * @param feedId The feed identifier
     * @return update The latest update data
     */
    function getLatestUpdate(
        bytes32 feedId
    ) external view returns (SwitchboardTypes.Update memory update);

    /**
     * @notice Get the latest value for a feed
     * @param feedId The feed identifier
     * @return value The latest feed value
     * @return timestamp The timestamp of the update
     * @return slotNumber The slot number of the update
     */
    function getLatestValue(
        bytes32 feedId
    )
        external
        view
        returns (int128 value, uint256 timestamp, uint64 slotNumber);

    /**
     * @notice Check if a feed exists
     * @param feedId The feed identifier
     * @return exists True if feed exists
     */
    function feedExists(bytes32 feedId) external view returns (bool exists);

    /**
     * @notice Calculate current result for a feed
     * @param aggregatorId The feed identifier to calculate the current result for
     * @return currentResult The current result for the given feed
     */
    function findCurrentResult(
        bytes32 aggregatorId
    )
        external
        view
        returns (SwitchboardTypes.CurrentResult memory currentResult);

    /**
     * @notice Get the total number of active feeds
     * @return count The number of feeds that have been updated
     */
    function getActiveFeedCount() external view returns (uint256 count);

    /**
     * @notice Get all active feed IDs
     * @return feedIds Array of all feed IDs that have been updated
     */
    function getAllActiveFeedIds()
        external
        view
        returns (bytes32[] memory feedIds);

    /**
     * @notice Get a paginated list of active feed IDs
     * @param offset Starting index
     * @param limit Maximum number of results to return
     * @return feedIds Array of feed IDs
     * @return total Total number of active feeds
     */
    function getActiveFeedIds(
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory feedIds, uint256 total);

    /**
     * @notice Check if a feed ID is active
     * @param feedId The feed ID to check
     * @return exists True if the feed has been updated at least once
     */
    function isFeedActive(bytes32 feedId) external view returns (bool exists);

    // ==========================================================================
    // Fee Functions
    // ==========================================================================

    /**
     * Get the fee in wei for submitting a set of updates
     * @dev This is for backwards compatibility with the old Switchboard contracts
     * @param updates Encoded switchboard update(s) with signatures
     * @return uint256 The fee in wei for submitting the updates
     */
    function getFee(bytes[] calldata updates) external view returns (uint256);

    /**
     * @notice Get the update fee
     * @return The fee required for updates in wei
     */
    function updateFee() external view returns (uint256);

    // ==========================================================================
    // Contract Info Functions
    // ==========================================================================

    /**
     * @notice Gets the verifier contract address
     * @return The address of the verifier contract
     */
    function verifierAddress() external view returns (address);

    /**
     * @notice Gets the implementation address
     * @return The address of the implementation contract
     */
    function implementation() external view returns (address);

    /**
     * @notice Get contract version
     * @return version The contract version
     */
    function version() external pure returns (string memory);

    // ==========================================================================
    // Randomness Functions
    // ==========================================================================

    /**
     * @notice Create a randomness request with auto-selected oracle
     * @param randomnessId Unique identifier for this randomness request
     * @param minSettlementDelay Minimum seconds before randomness can be settled
     * @return oracle The oracle address selected to fulfill this request
     */
    function createRandomness(
        bytes32 randomnessId,
        uint64 minSettlementDelay
    ) external returns (address oracle);

    /**
     * @notice Create a randomness request with a specific oracle
     * @param randomnessId Unique identifier for this randomness request
     * @param minSettlementDelay Minimum seconds before randomness can be settled
     * @param oracle The specific oracle address to fulfill this request
     */
    function createRandomnessWithOracle(
        bytes32 randomnessId,
        uint64 minSettlementDelay,
        address oracle
    ) external;

    /**
     * @notice Reroll randomness with auto-selected oracle
     * @dev Caller must be the authority for this randomness
     * @param randomnessId The randomness id to reroll
     * @return oracle The new oracle address selected
     */
    function rerollRandomness(
        bytes32 randomnessId
    ) external returns (address oracle);

    /**
     * @notice Reroll randomness with a specific oracle
     * @dev Caller must be the authority for this randomness
     * @param randomnessId The randomness id to reroll
     * @param oracle The specific oracle address to fulfill this request
     */
    function rerollRandomnessWithOracle(
        bytes32 randomnessId,
        address oracle
    ) external;

    /**
     * @notice Get randomness data by id
     * @param randomnessId The randomness id
     * @return The randomness struct
     */
    function getRandomness(
        bytes32 randomnessId
    ) external view returns (SwitchboardTypes.Randomness memory);

    /**
     * @notice Check if randomness is ready to be settled
     * @param randomnessId The randomness id
     * @return ready True if the settlement delay has passed
     */
    function isRandomnessReady(
        bytes32 randomnessId
    ) external view returns (bool ready);

    /**
     * @notice Settle randomness from encoded oracle response
     * @param encodedRandomness The encoded randomness reveal data (discriminator 4)
     */
    function settleRandomness(
        bytes calldata encodedRandomness
    ) external payable;
}
