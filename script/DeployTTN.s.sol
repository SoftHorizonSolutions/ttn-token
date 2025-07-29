// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNToken.sol";
import "../contracts/TTNTokenVault.sol";
import "../contracts/TTNVestingManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployTTNScript is Script {
   function run() external {
        
        vm.startBroadcast();

        TTNToken tokenImpl = new TTNToken();
        TokenVault vaultImpl = new TokenVault();
        VestingManager vestingImpl = new VestingManager();

        console.log("Implementation contracts deployed:");
        console.log("TTNToken implementation:", address(tokenImpl));
        console.log("TTNTokenVault implementation:", address(vaultImpl));
        console.log("TTNVestingManager implementation:", address(vestingImpl));

        // Deploy proxy contracts
        // Get deployer address from the broadcast
        // address deployer = 0x5fF68B636265bb203cBf6f395E8dC9B8bEBF8869;
        // Deploy without initialization
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl),
            ""  // Empty data - no initialization
        );

        console.log("TTNToken proxy deployed at:", address(tokenProxy));

        // Deploy vault proxy without initialization
        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            ""  // Empty data - no initialization
        );

        console.log("TTNTokenVault proxy deployed at:", address(vaultProxy));

        // Deploy vesting manager proxy without initialization
        ERC1967Proxy vestingProxy = new ERC1967Proxy(
            address(vestingImpl),
            ""  // Empty data - no initialization
        );

        console.log("TTNVestingManager proxy deployed at:", address(vestingProxy));

        // Note: Contracts are not initialized yet - will be done via Safe UI

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia");
        console.log("\nImplementation Addresses:");
        console.log("TTNToken:", address(tokenImpl));
        console.log("TTNTokenVault:", address(vaultImpl));
        console.log("TTNVestingManager:", address(vestingImpl));
        console.log("\nProxy Addresses:");
        console.log("TTNToken:", address(tokenProxy));
        console.log("TTNTokenVault:", address(vaultProxy));
        console.log("TTNVestingManager:", address(vestingProxy));

        // These are the addresses you verify on Basescan
        console.log("TTNToken Implementation:", address(tokenImpl));
        console.log("TokenVault Implementation:", address(vaultImpl));
        console.log("VestingManager Implementation:", address(vestingImpl));

        // These are the addresses users interact with
        console.log("TTNToken Proxy:", address(tokenProxy));
        console.log("TokenVault Proxy:", address(vaultProxy));
        console.log("VestingManager Proxy:", address(vestingProxy));
    }
} 