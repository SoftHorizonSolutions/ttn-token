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
 * @title BulkAirdropWalletsBatched
 * @dev Batch airdrop to wallet addresses (processes in chunks of 50)
 */
contract BulkAirdropWalletsBatched is Script {
    address constant TOKEN_VAULT = 0xE72dCAeA94829025391ace9cff3053c06731f46b;
    uint256 constant BATCH_SIZE = 10; // Process 10 addresses per batch (much faster)
    
    function run() external {
        ITTNTokenVault tokenVault = ITTNTokenVault(TOKEN_VAULT);
        
        console.log("=== Batched Wallets Airdrop ===");
        console.log("TokenVault:", TOKEN_VAULT);
        console.log("Batch size:", BATCH_SIZE);
        
        // Use FFI to read file
        string[] memory inputs = new string[](2);
        inputs[0] = "cat";
        inputs[1] = "script/data/wallets-data.json";
        
        bytes memory result = vm.ffi(inputs);
        string memory json = string(result);
        
        uint256 totalAddresses = vm.parseJsonUint(json, ".totalAddresses");
        uint256 totalBatches = (totalAddresses + BATCH_SIZE - 1) / BATCH_SIZE;
        
        console.log("Total addresses:", totalAddresses);
        console.log("Total batches:", totalBatches);
        console.log("");
        
        vm.startBroadcast();
        
        uint256 totalAirdropId = 0;
        
        // Process in batches
        for (uint256 batch = 0; batch < totalBatches; batch++) {
            uint256 startIndex = batch * BATCH_SIZE;
            uint256 endIndex = startIndex + BATCH_SIZE;
            if (endIndex > totalAddresses) {
                endIndex = totalAddresses;
            }
            
            uint256 batchSize = endIndex - startIndex;
            address[] memory beneficiaries = new address[](batchSize);
            uint256[] memory amounts = new uint256[](batchSize);
            
            // Fill batch arrays
            for (uint256 i = 0; i < batchSize; i++) {
                uint256 recordIndex = startIndex + i;
                string memory basePath = string.concat(".records[", vm.toString(recordIndex), "]");
                
                beneficiaries[i] = vm.parseJsonAddress(json, string.concat(basePath, ".address"));
                amounts[i] = vm.parseJsonUint(json, string.concat(basePath, ".amount"));
            }
            
            console.log("Processing batch %s/%s", batch + 1, totalBatches);
            
            // Execute batch airdrop
            uint256 airdropId = tokenVault.executeAirdrop(beneficiaries, amounts);
            totalAirdropId = airdropId; // Keep last airdrop ID
            
            console.log("Batch %s completed", batch + 1);
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== All Batches Complete ===");
        console.log("Total batches processed:", totalBatches);
        console.log("Total addresses:", totalAddresses);
        console.log("Last airdrop ID:", totalAirdropId);
        console.log("Amount per recipient: 135.9619 tokens");
    }
}
