// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITTNTokenV2 {
    /// @notice The version number of this contract implementation
    function version() external view returns (uint256);

    /**
     * @dev Initializes V2 functionality
     * This is called during the upgrade process
     */
    function initializeV2() external;
} 