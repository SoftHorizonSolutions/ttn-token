// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../../contracts/ABCToken/ABCToken.sol";
import "../../contracts/ABCToken/ABCTokenVault.sol";
import "../../contracts/ABCToken/ABCVestingManager.sol";

contract InteractABCScript is Script {
    function run() external {
        vm.startBroadcast();

        // Get proxy addresses from environment variables or use defaults
        address tokenProxy = 0x1A5000e8A2354f30dB93bb094aD77425490612e5;
        address impl_token = 0x9dbed8F9900DDa277129A0766E6Fc83F09a2C766;

        address admin = vm.envOr("ADMIN", msg.sender);

        console.log("=== MINTING TOKENS ===");
        

        // Validate addresses
        if (tokenProxy == address(0)) {
            revert("TOKEN_PROXY address not provided");
        }
        if (impl_token == address(0)) {
            revert("VAULT_PROXY address not provided");
        }
       

        // Initialize ABCToken proxy
        console.log("\n--- Initializing ABCToken proxy ---");
        ABCToken tokenContract = ABCToken(tokenProxy);
        try tokenContract.getTokenBalance(0x5AB1626fFFC6378E954a4Ba167b3E2A95Bf83706) {
            console.log("Balance:", tokenContract.getTokenBalance(0x5AB1626fFFC6378E954a4Ba167b3E2A95Bf83706));
        } catch Error(string memory reason) {
            console.log("[ERROR] ABCToken minted successfully:", reason);
        } catch {
            console.log("[ERROR] ABCToken failed  to mint with unknown error");
        }

        vm.stopBroadcast();

        console.log("\n=== INITIALIZATION SUMMARY ===");
        console.log("All proxy contracts have been initialized with the following configuration:");
        console.log("Admin:", admin);
    }
} 