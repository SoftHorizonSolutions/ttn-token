// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNToken.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployTTNTokenScript is Script {
   function run() external {
        
        vm.startBroadcast();

        // Deploy implementation contracts
        TTNToken tokenImpl = new TTNToken();
       

        // Deploy proxy contracts
        // Get deployer address from the broadcast
        // address deployer = 0x5fF68B636265bb203cBf6f395E8dC9B8bEBF8869;
        // Deploy without initialization
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl),
            ""  // Empty data - no initialization
        );

        console.log("TTNToken proxy deployed at:", address(tokenProxy));

       
        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia");
        console.log("\nImplementation Addresses:");
        console.log("TTNToken:", address(tokenImpl));
       
        console.log("\nProxy Addresses:");
        console.log("TTNToken:", address(tokenProxy));

        // These are the addresses you verify on Basescan
        console.log("TTNToken Implementation:", address(tokenImpl));
   
        // These are the addresses users interact with
        console.log("TTNToken Proxy:", address(tokenProxy));

    }
} 