// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { SwitchboardTypes } from '../libraries/SwitchboardTypes.sol';

/**
 * @title ISwitchboardVerifier
 * @notice Interface for the Switchboard verification system
 */
interface ISwitchboardVerifier {
    /**
     * @notice Verifies the feed update data
     * @param updateData The feed update data to verify
     * @return numValidSignatures The number of valid signatures
     */
    function verifyOracleSignatures(
        SwitchboardTypes.FeedUpdateData calldata updateData
    ) external view returns (uint8 numValidSignatures);

    /**
     * @notice Check if an oracle signing key is valid
     * @param signingKey The oracle signing key to check
     * @return True if the signing key is valid
     */
    function isValidOracleSigningKey(
        address signingKey
    ) external view returns (bool);

    /**
     * @notice Get all active oracle signing keys
     * @return activeKeys Array of active oracle signing key addresses
     */
    function getActiveOracleSigningKeys()
        external
        view
        returns (address[] memory activeKeys);

    /**
     * @notice Get oracle keys with their verification timestamps
     * @return signingKeys Array of oracle signing keys
     * @return verificationTimestamps Array of corresponding verification timestamps
     */
    function getOracleKeysWithTimestamps()
        external
        view
        returns (
            address[] memory signingKeys,
            uint256[] memory verificationTimestamps
        );
}
