// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNTokenVault.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/TTNVestingManager.sol";

contract DeployTTNManagerScript is Script {
   function run() external {
        
        vm.startBroadcast();

        // Deploy implementation contracts
      
        VestingManager vestingImpl = new VestingManager();


        console.log("Implementation contracts deployed:");
        console.log("TTNVestingManager implementation:", address(vestingImpl));
     



        // Deploy vault proxy without initialization
        // Deploy vesting manager proxy without initialization
        ERC1967Proxy vestingProxy = new ERC1967Proxy(
            address(vestingImpl),
            ""  // Empty data - no initialization
        );

        console.log("TTNVestingManager proxy deployed at:", address(vestingProxy));

    

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia");
        console.log("\nImplementation Addresses:");
        console.log("TTNVestingManager:", address(vestingImpl));
  
        console.log("\nProxy Addresses:");
        console.log("TTNVestingManager:", address(vestingProxy));


        // These are the addresses you verify on Basescan
        console.log("TokenVault Implementation:", address(vestingImpl));

     
        console.log("TokenVault Proxy:", address(vestingProxy));

    }
} 