// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITTNToken {
    function mint(address to, uint256 amount) external;
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function getTotalMinted() external view returns (uint256);
    function getRemainingMintableTokens() external view returns (uint256);
    function getTokenBalance(address walletAddress) external view returns (uint256);
} 