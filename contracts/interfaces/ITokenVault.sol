// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenVault {
    function revokeAllocation(uint256 allocationId) external returns (bool);
    function reduceAllocation(uint256 allocationId, uint256 amount) external returns (bool);
    function addManager(address newManager) external;
    function removeManager(address manager) external;
    function isManager(address account) external view returns (bool);
    function getAllManagers() external view returns (address[] memory);
    function getAllocationsForBeneficiary(address beneficiary) external view returns (uint256[] memory);
    function getAllocationById(uint256 allocationId) external view returns (uint256 amount, address beneficiary, bool revoked);
    function allocations(uint256 allocationId) external view returns (uint256 amount, address beneficiary, bool revoked);
} 