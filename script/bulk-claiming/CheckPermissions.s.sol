// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {TokenVault} from "../../contracts/TTNTokenVault.sol";

/**
 * @title CheckPermissions
 * @dev Script to check if a wallet has the required permissions
 */
contract CheckPermissions is Script {
    // This will check the address from --private-key (msg.sender)
    // Or set a specific address to check
    address constant WALLET_TO_CHECK = 0x241791B1BABc46FDD35fFa6447bb347B6a59b9aa;
    
    bytes32 constant DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    function run() public view {
        // Read address from environment variable
        address vaultProxy = vm.envAddress("TOKEN_VAULT_PROXY");
        TokenVault vault = TokenVault(vaultProxy);
        
        console.log("=== Checking Permissions ===");
        console.log("TokenVault:", vaultProxy);
        console.log("Wallet:", WALLET_TO_CHECK);
        console.log("");
        
        // Check if paused
        bool isPaused = vault.paused();
        console.log("Contract paused:", isPaused);
        
        // Check roles
        bool hasAdminRole = vault.hasRole(DEFAULT_ADMIN_ROLE, WALLET_TO_CHECK);
        bool hasManagerRole = vault.hasRole(MANAGER_ROLE, WALLET_TO_CHECK);
        bool isManager = vault.isManager(WALLET_TO_CHECK);
        
        console.log("");
        console.log("=== Role Status ===");
        console.log("Has DEFAULT_ADMIN_ROLE:", hasAdminRole);
        console.log("Has MANAGER_ROLE:", hasManagerRole);
        console.log("Is Manager (either role):", isManager);
        
        console.log("");
        console.log("=== Can Create Allocation? ===");
        if (isPaused) {
            console.log("NO - Contract is PAUSED");
        } else if (hasAdminRole || hasManagerRole) {
            console.log("YES - Has required role");
        } else {
            console.log("NO - Missing required role");
        }
    }
}

