// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title SwitchboardTypes
 * @notice Library containing types used across the Switchboard oracle system
 */
library SwitchboardTypes {
    /**
     * @notice Structure containing feed update data
     * @param slotNumber The Solana slot number (8 bytes)
     * @param timestamp The timestamp of the update
     * @param feedInfos Array of feed information in this update
     * @param signatures Array of oracle signatures (65 bytes each: r + s + v)
     */
    struct FeedUpdateData {
        uint64 slotNumber;
        uint64 timestamp;
        FeedInfo[] feedInfos;
        bytes[] signatures; // Array of 65-byte ECDSA signatures (r + s + v)
    }

    /**
     * @notice Structure containing feed information
     * @param feedId The unique identifier (checksum) of the feed
     * @param value The current value of the feed
     * @param minOracleSamples Minimum number of oracle samples required for this feed
     */
    struct FeedInfo {
        bytes32 feedId;
        int128 value;
        uint8 minOracleSamples;
    }

    /**
     * @notice Packed size constants for data layout compatibility
     */
    uint256 constant FEED_INFO_PACKED_SIZE = 49; // 32 + 16 + 1 bytes

    /**
     * An update to a feed
     * @param result The result of the update
     * @param timestamp The timestamp of the update
     * @param slotNumber The Solana slot number when the update occurred
     */
    struct Update {
        int128 result;
        uint256 timestamp;
        uint64 slotNumber;
    }

    /**
     * Legacy ABI-compatible update structure (matches old on_demand interface)
     * @param feedId The feed identifier (replaces oracleId from legacy)
     * @param result The result of the update
     * @param timestamp The timestamp of the update
     * @param slotNumber The Solana slot number when the update occurred
     */
    struct LegacyUpdate {
        bytes32 feedId;
        int128 result;
        uint256 timestamp;
        uint64 slotNumber;
    }

    /**
     * The current result for a feed (compatible with ISwitchboardModule)
     * @param result The result of the feed
     * @param minTimestamp The minimum timestamp of the feed
     * @param maxTimestamp The maximum timestamp of the feed
     * @param minResult The minimum result of the feed
     * @param maxResult The maximum result of the feed
     * @param stdev The standard deviation of the feed
     * @param range The range of the feed
     * @param mean The mean of the feed
     */
    struct CurrentResult {
        int128 result;
        uint256 minTimestamp;
        uint256 maxTimestamp;
        int128 minResult;
        int128 maxResult;
        int128 stdev;
        int128 range;
        int128 mean;
    }

    /**
     * Randomness request data
     * @param randId The unique identifier for the randomness request
     * @param createdAt When the request was created
     * @param authority The address that created the request
     * @param rollTimestamp The timestamp when randomness was rolled (for settlement timing)
     * @param minSettlementDelay Minimum seconds before settlement is allowed
     * @param oracle The oracle assigned to fulfill this request
     * @param value The random value (populated after settlement)
     * @param settledAt When the randomness was settled (0 if not settled)
     */
    struct Randomness {
        bytes32 randId;
        uint256 createdAt;
        address authority;
        uint256 rollTimestamp;
        uint64 minSettlementDelay;
        address oracle;
        uint256 value;
        uint256 settledAt;
    }

    /**
     * Decoded randomness reveal message from oracle
     * @param randId The randomness request ID
     * @param result The random value
     * @param r Signature component r
     * @param s Signature component s
     * @param v Signature recovery id
     */
    struct RandomnessMessage {
        bytes32 randId;
        uint256 result;
        bytes32 r;
        bytes32 s;
        uint8 v;
    }
}
