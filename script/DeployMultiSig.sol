// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNToken.sol";
import "../contracts/TTNTokenVault.sol";
import "../contracts/TTNVestingManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployScript is Script {
    function run() external {
        
        vm.startBroadcast();

        // Deploy implementation contracts
        TTNToken tokenImpl = new TTNToken();
        TokenVault vaultImpl = new TokenVault();
        VestingManager vestingImpl = new VestingManager();

        console.log("Implementation contracts deployed:");
        console.log("TTNToken implementation:", address(tokenImpl));
        console.log("TTNTokenVault implementation:", address(vaultImpl));
        console.log("TTNVestingManager implementation:", address(vestingImpl));


        // Deploy proxy contracts WITHOUT initialization
        address deployer = msg.sender;

        // Deploy TTNToken proxy (without initializer)
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl),
            ""           // Empty data (no initializer)
        );

        console.log("TTNToken proxy deployed at:", address(tokenProxy));

        // Deploy TTNTokenVault proxy (without initializer)
        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            ""           // Empty data (no initializer)
        );

        console.log("TTNTokenVault proxy deployed at:", address(vaultProxy));

        // Deploy TTNVestingManager proxy (without initializer)
        ERC1967Proxy vestingProxy = new ERC1967Proxy(
            address(vestingImpl),
            ""           // Empty data (no initializer)
        );

        console.log("TTNVestingManager proxy deployed at:", address(vestingProxy));

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia");
        console.log("Deployer:", deployer);
        console.log("\nImplementation Addresses (for verification):");
        console.log("TTNToken:", address(tokenImpl));
        console.log("TTNTokenVault:", address(vaultImpl));
        console.log("TTNVestingManager:", address(vestingImpl));
        console.log("\nProxy Addresses:");
        console.log("TTNToken:", address(tokenProxy));
        console.log("TTNTokenVault:", address(vaultProxy));
        console.log("TTNVestingManager:", address(vestingProxy));

        console.log("\n=== NEXT STEPS ===");
        console.log("1. Initialize proxy contracts on safe transaction builder");
        console.log("2. Grant roles to TokenVault and VestingManager");
    }
} 