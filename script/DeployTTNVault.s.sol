// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNTokenVault.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployTTNVaultScript is Script {
   function run() external {
        
        vm.startBroadcast();

        // Deploy implementation contracts
        TokenVault vaultImpl = new  TokenVault();


        console.log("Implementation contracts deployed:");
        console.log("TTNTokenVault implementation:", address(vaultImpl));
     



        // Deploy vault proxy without initialization
        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            ""  // Empty data - no initialization
        );

        console.log("TTNTokenVault proxy deployed at:", address(vaultProxy));

    

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia");
        console.log("\nImplementation Addresses:");
        console.log("TTNTokenVault:", address(vaultImpl));
  
        console.log("\nProxy Addresses:");
        console.log("TTNTokenVault:", address(vaultProxy));


        // These are the addresses you verify on Basescan
        console.log("TokenVault Implementation:", address(vaultImpl));

     
        console.log("TokenVault Proxy:", address(vaultProxy));

    }
} 