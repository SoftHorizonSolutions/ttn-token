// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../../contracts/ABCToken/ABCToken.sol";
import "../../contracts/ABCToken/ABCTokenVault.sol";
import "../../contracts/ABCToken/ABCVestingManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployABCScript is Script {
   function run() external {
        
        vm.startBroadcast();

        // Deploy implementation contracts
        ABCToken tokenImpl = new ABCToken();
        ABCTokenVault vaultImpl = new  ABCTokenVault();
        ABCVestingManager vestingImpl = new  ABCVestingManager();

        console.log("Implementation contracts deployed:");
        console.log("ABCToken implementation:", address(tokenImpl));
        console.log("ABCTokenVault implementation:", address(vaultImpl));
        console.log("ABCVestingManager implementation:", address(vestingImpl));

        // Deploy proxy contracts
        // Get deployer address from the broadcast
        // address deployer = 0x5fF68B636265bb203cBf6f395E8dC9B8bEBF8869;
        // Deploy without initialization
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl),
            ""  // Empty data - no initialization
        );

        console.log("ABCToken proxy deployed at:", address(tokenProxy));

        // Deploy vault proxy without initialization
        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            ""  // Empty data - no initialization
        );

        console.log("ABCTokenVault proxy deployed at:", address(vaultProxy));

        // Deploy vesting manager proxy without initialization
        ERC1967Proxy vestingProxy = new ERC1967Proxy(
            address(vestingImpl),
            ""  // Empty data - no initialization
        );

        console.log("ABCVestingManager proxy deployed at:", address(vestingProxy));

        // Note: Contracts are not initialized yet - will be done via Safe UI

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia");
        console.log("\nImplementation Addresses:");
        console.log("ABCToken:", address(tokenImpl));
        console.log("ABCTokenVault:", address(vaultImpl));
        console.log("ABCVestingManager:", address(vestingImpl));
        console.log("\nProxy Addresses:");
        console.log("ABCToken:", address(tokenProxy));
        console.log("ABCTokenVault:", address(vaultProxy));
        console.log("ABCVestingManager:", address(vestingProxy));

        // These are the addresses you verify on Basescan
        console.log("ABCToken Implementation:", address(tokenImpl));
        console.log("TokenVault Implementation:", address(vaultImpl));
        console.log("VestingManager Implementation:", address(vestingImpl));

        // These are the addresses users interact with
        console.log("ABCToken Proxy:", address(tokenProxy));
        console.log("TokenVault Proxy:", address(vaultProxy));
        console.log("VestingManager Proxy:", address(vestingProxy));
    }
} 