// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console.sol";

interface ITTNTokenVault {
    function executeAirdrop(
        address[] calldata beneficiaries,
        uint256[] calldata amounts
    ) external returns (uint256);
}

/**
 * @title BulkAirdropTGE
 * @dev Bulk airdrop TGE tokens using executeAirdrop function
 */
contract BulkAirdropTGE is Script {
    address constant TOKEN_VAULT = 0xE72dCAeA94829025391ace9cff3053c06731f46b;
    
    function run() external {
        ITTNTokenVault tokenVault = ITTNTokenVault(TOKEN_VAULT);
        
        console.log("=== Bulk TGE Airdrop ===");
        console.log("TokenVault:", TOKEN_VAULT);
        
        // Use FFI to read file (workaround for fs_permissions)
        string[] memory inputs = new string[](2);
        inputs[0] = "cat";
        inputs[1] = "script/data/vesting-data.json";
        
        bytes memory result = vm.ffi(inputs);
        string memory json = string(result);
        
        uint256 totalAddresses = vm.parseJsonUint(json, ".totalAddresses");
        uint256 totalAllocation = vm.parseJsonUint(json, ".totalAllocation");
        
        console.log("Total addresses:", totalAddresses);
        console.log("Total Minted tokens:", totalAllocation);
        console.log("");
        
        // Prepare arrays for bulk airdrop
        address[] memory beneficiaries = new address[](totalAddresses);
        uint256[] memory amounts = new uint256[](totalAddresses);
        string[] memory labels = new string[](totalAddresses);
        
        // Parse all data from JSON
        for (uint256 i = 0; i < totalAddresses; i++) {
            string memory basePath = string.concat(".records[", vm.toString(i), "]");
            
            beneficiaries[i] = vm.parseJsonAddress(json, string.concat(basePath, ".address"));
            amounts[i] = vm.parseJsonUint(json, string.concat(basePath, ".amount"));
            labels[i] = vm.parseJsonString(json, string.concat(basePath, ".label"));
        }
        
        console.log("Data parsed successfully");
        console.log("First beneficiary:", beneficiaries[0]);
        console.log("First amount:", amounts[0]);
        console.log("First label:", labels[0]);
        console.log("");
        
        vm.startBroadcast();
        
        // Execute bulk airdrop
        console.log("Executing bulk airdrop...");
        uint256 airdropId = tokenVault.executeAirdrop(beneficiaries, amounts);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Airdrop Complete ===");
        console.log("Airdrop ID:", airdropId);
        console.log("Total recipients:", totalAddresses);
        console.log("Total amount:", totalAllocation);
        console.log("");
        
        // Display first few recipients
        console.log("=== Recipients (first 5) ===");
        uint256 displayCount = totalAddresses < 5 ? totalAddresses : 5;
        for (uint256 i = 0; i < displayCount; i++) {
            console.log("Recipient: %s | Amount: %s | Label: %s", beneficiaries[i], amounts[i], labels[i]);
        }
        
        if (totalAddresses > 5) {
            console.log("... and %s more recipients", totalAddresses - 5);
        }
        
        console.log("");
        console.log("=== Summary ===");
        console.log("Airdrop ID:", airdropId);
        console.log("Total recipients:", totalAddresses);
        console.log("All tokens minted directly to beneficiaries");
    }
}
