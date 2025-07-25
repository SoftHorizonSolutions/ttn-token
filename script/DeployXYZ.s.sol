// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/XYZToken/XYZToken.sol";
import "../contracts/XYZToken/XYZTokenVault.sol";
import "../contracts/XYZToken/XYZVestingManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployXYZScript is Script {
    function run() external {
        
        vm.startBroadcast();

        // Deploy implementation contracts
        XYZToken tokenImpl = new XYZToken();
        XYZTokenVault vaultImpl = new XYZTokenVault();
        XYZVestingManager vestingImpl = new XYZVestingManager();

        console.log("Implementation contracts deployed:");
        console.log("XYZToken implementation:", address(tokenImpl));
        console.log("XYZTokenVault implementation:", address(vaultImpl));
        console.log("XYZVestingManager implementation:", address(vestingImpl));


        // Deploy proxy contracts WITHOUT initialization
        address deployer = msg.sender;

        // Deploy XYZToken proxy (without initializer)
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl),
            ""           // Empty data (no initializer)
        );

        console.log("TTNToken proxy deployed at:", address(tokenProxy));

        // Deploy XYZTokenVault proxy (without initializer)
        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            ""           // Empty data (no initializer)
        );

        console.log("XYZTokenVault proxy deployed at:", address(vaultProxy));

        // Deploy XYZVestingManager proxy (without initializer)
        ERC1967Proxy vestingProxy = new ERC1967Proxy(
            address(vestingImpl),
            ""           // Empty data (no initializer)
        );

        console.log("XYZVestingManager proxy deployed at:", address(vestingProxy));

        vm.stopBroadcast();


        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia");
        console.log("Deployer:", deployer);
        console.log("\nImplementation Addresses (for verification):");
        console.log("XYZToken:", address(tokenImpl));
        console.log("XYZTokenVault:", address(vaultImpl));
        console.log("XYZVestingManager:", address(vestingImpl));
        console.log("\nProxy Addresses:");
        console.log("XYZToken:", address(tokenProxy));
        console.log("XYZTokenVault:", address(vaultProxy));
        console.log("XYZVestingManager:", address(vestingProxy));

        console.log("\n=== NEXT STEPS ===");
        console.log("1. Initialize proxy contracts on safe transaction builder");
        console.log("2. Grant roles to TokenVault and VestingManager");
    }
} 