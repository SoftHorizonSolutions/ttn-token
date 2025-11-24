// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../../contracts/TTNTokenVault.sol";

/**
 * @title DiagnoseAllocationFailure
 * @dev Script to diagnose why createAllocation is failing
 */
contract DiagnoseAllocationFailure is Script {
    bytes32 constant DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    string constant DATA_FILE = "scripts/bulk-claiming/data/claiming-addresses.json";
    
    function run() external {
        address vaultProxy = vm.envAddress("TOKEN_VAULT_PROXY");
        TokenVault vault = TokenVault(vaultProxy);
        address caller = msg.sender;
        
        console.log("=== Diagnosing Allocation Failure ===");
        console.log("TokenVault:", vaultProxy);
        console.log("Caller:", caller);
        console.log("");
        
        // Check if paused
        bool isPaused = vault.paused();
        console.log("Contract paused:", isPaused);
        if (isPaused) {
            console.log("ERROR: CONTRACT IS PAUSED - This will cause all createAllocation calls to revert!");
            console.log("   Solution: Unpause the contract using unpause() function");
            return;
        }
        
        // Check permissions
        bool hasAdminRole = vault.hasRole(DEFAULT_ADMIN_ROLE, caller);
        bool hasManagerRole = vault.hasRole(MANAGER_ROLE, caller);
        console.log("Caller has DEFAULT_ADMIN_ROLE:", hasAdminRole);
        console.log("Caller has MANAGER_ROLE:", hasManagerRole);
        
        if (!hasAdminRole && !hasManagerRole) {
            console.log("ERROR: MISSING PERMISSIONS - Caller does not have required role");
            return;
        }
        
        console.log("");
        console.log("OK: Permissions OK");
        console.log("");
        
        // Test with a sample address from the data file
        console.log("=== Testing with Sample Data ===");
        
        // Read first few records to test
        string[] memory readInputs = new string[](3);
        readInputs[0] = "sh";
        readInputs[1] = "-c";
        readInputs[2] = string.concat("jq '{totalAddresses: .totalAddresses, records: .records[51:56]}' ", DATA_FILE);
        bytes memory result = vm.ffi(readInputs);
        string memory json = string(result);
        
        // Test addresses 51-55 (the ones that failed)
        for (uint256 i = 0; i < 5; i++) {
            string memory basePath = string.concat(".records[", vm.toString(i), "]");
            
            address beneficiary = vm.parseJsonAddress(json, string.concat(basePath, ".address"));
            uint256 amount = vm.parseJsonUint(json, string.concat(basePath, ".amount"));
            
            console.log("");
            console.log("Testing address index", 51 + i, ":");
            console.log("  Beneficiary:", beneficiary);
            console.log("  Amount:", amount);
            
            // Validate data
            if (beneficiary == address(0)) {
                console.log("  ERROR: INVALID - Beneficiary is zero address");
                continue;
            }
            if (amount == 0) {
                console.log("  ERROR: INVALID - Amount is zero");
                continue;
            }
            
            console.log("  OK: Data looks valid");
            
            // Try to simulate the call
            vm.startBroadcast();
            try vault.createAllocation(beneficiary, amount) returns (uint256 id) {
                console.log("  SUCCESS: Would create allocation ID", id);
            } catch Error(string memory reason) {
                console.log("  ERROR: REVERT -", reason);
            } catch (bytes memory lowLevelData) {
                console.log("  ERROR: REVERT - Custom error");
                console.log("  Error data:");
                console.logBytes(lowLevelData);
            }
            vm.stopBroadcast();
        }
        
        console.log("");
        console.log("=== Diagnosis Complete ===");
    }
}

