// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../../contracts/TTNVestingManager.sol";
import "../../contracts/TTNTokenVault.sol";
import "../../contracts/interfaces/ITTNToken.sol";

/**
 * @title BulkCreateAllocationsAndVestingBatched
 * @dev Creates allocations and vesting schedules in batches with progress tracking, retries, and resume
 *      All addresses can claim on November 30, 2024 12:00:00 UTC+1
 * 
 * Features:
 * - Automatic progress tracking (saves to scripts/bulk-claiming/data/deployment-progress.json)
 * - Resume capability (reads progress file to continue from last processed index)
 * - Retry logic for failed transactions
 * - Configurable batch size
 * 
 * Usage (ON-CHAIN EXECUTION):
 *   # Process next batch (reads progress file to resume)
 *   # IMPORTANT: --broadcast flag sends transactions on-chain
 *   forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
 *     --sig "run(uint256)" <batchSize> \
 *     --rpc-url <rpc> --private-key <key> --broadcast --ffi
 * 
 *   # Start from specific index
 *   forge script ... --sig "run(uint256,uint256)" <startIndex> <batchSize> --broadcast --ffi
 * 
 *   # Resume from last processed index (default)
 *   forge script ... --sig "run(uint256)" <batchSize> --broadcast --ffi
 * 
 * Example: Process next 50 addresses on-chain (auto-resumes from progress file)
 *   # Base Sepolia: --rpc-url https://sepolia.base.org
 *   # Or use Alchemy Base Sepolia: --rpc-url https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
 *   forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
 *     --sig "run(uint256)" 50 \
 *     --rpc-url https://sepolia.base.org \
 *     --private-key <key> --broadcast --ffi
 * 
 * Example: Start from index 1000 with batch of 50 (on-chain)
 *   forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
 *     --sig "run(uint256,uint256)" 1000 50 \
 *     --rpc-url https://sepolia.base.org \
 *     --private-key <key> --broadcast --ffi
 * 
 * NOTE: Without --broadcast flag, the script will only simulate (dry-run) and not send transactions on-chain.
 *       Each address creates 2 on-chain transactions (allocation + vesting schedule).
 */
contract BulkCreateAllocationsAndVestingBatched is Script {
    // Vesting schedule start times
    uint256 constant FIRST_VESTING_START_TIME = 1764460800; // Nov 30, 2025 00:00 UTC
    uint256 constant SECOND_VESTING_START_TIME = 1767052800; // Dec 30, 2025 00:00 UTC
    
    // Default batch size if not provided
    uint256 constant DEFAULT_BATCH_SIZE = 50;
    
    // Role constants
    bytes32 constant DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    // Progress file path
    string constant PROGRESS_FILE = "scripts/bulk-claiming/data/deployment-progress.json";
    string constant DATA_FILE = "scripts/bulk-claiming/data/claiming-addresses.json";
    
    function run() external {
        // Default: process 50 addresses, auto-resume from progress
        run(DEFAULT_BATCH_SIZE);
    }
    
    function run(uint256 batchSize) public {
        // Read progress to determine start index
        uint256 startIndex = loadProgress();
        run(startIndex, batchSize);
    }
    
    function run(uint256 startIndex, uint256 batchSize) public {
        // Read addresses from environment variables
        address vestingProxy = vm.envAddress("VESTING_MANAGER_PROXY");
        address vaultProxy = vm.envAddress("TOKEN_VAULT_PROXY");
        
        VestingManager vesting = VestingManager(vestingProxy);
        TokenVault vault = TokenVault(vaultProxy);
        
        // Get the caller address (will be the address from --private-key)
        address caller = msg.sender;
        
        console.log("=== Bulk Create Allocations and Vesting Schedules (Batched) ===");
        console.log("VestingManager:", vestingProxy);
        console.log("TokenVault:", vaultProxy);
        console.log("Caller (msg.sender):", caller);
        console.log("");
        
        // First, get totalAddresses without loading the entire file
        // Extract just the totalAddresses field as a minimal JSON object
        string[] memory totalReadInputs = new string[](3);
        totalReadInputs[0] = "sh";
        totalReadInputs[1] = "-c";
        totalReadInputs[2] = string.concat("jq '{totalAddresses: .totalAddresses}' ", DATA_FILE);
        bytes memory totalResult = vm.ffi(totalReadInputs);
        string memory totalJson = string(totalResult);
        uint256 totalAddresses = vm.parseJsonUint(totalJson, ".totalAddresses");
        
        // Calculate actual batch size and end index
        uint256 endIndex = startIndex + batchSize;
        if (endIndex > totalAddresses) {
            endIndex = totalAddresses;
        }
        uint256 actualBatchSize = endIndex - startIndex;
        
        // Extract only the batch we need using jq to avoid loading entire 11MB file
        // jq command: extract records[startIndex:endIndex] and wrap in a valid JSON structure
        string[] memory batchReadInputs = new string[](3);
        batchReadInputs[0] = "sh";
        batchReadInputs[1] = "-c";
        // Use jq to extract only the records we need: .records[startIndex:endIndex]
        // This creates a smaller JSON with just the batch data
        string memory jqCmd = string.concat(
            "jq '{totalAddresses: .totalAddresses, records: .records[",
            vm.toString(startIndex),
            ":",
            vm.toString(endIndex),
            "]}' ",
            DATA_FILE
        );
        batchReadInputs[2] = jqCmd;
        bytes memory batchResult = vm.ffi(batchReadInputs);
        string memory json = string(batchResult);
        
        console.log("Total addresses in file:", totalAddresses);
        console.log("Start index:", startIndex);
        console.log("Batch size:", actualBatchSize);
        console.log("End index:", endIndex);
        console.log("Progress:", startIndex, "/", totalAddresses);
        console.log("First vesting start time:", FIRST_VESTING_START_TIME, "(Nov 30, 2025 00:00 UTC)");
        console.log("Second vesting start time:", SECOND_VESTING_START_TIME, "(Dec 30, 2025 00:00 UTC)");
        console.log("Current block timestamp:", block.timestamp);
        console.log("");
        
        // Start broadcast - this will send transactions on-chain when using --broadcast flag
        // Each call to vault.createAllocation() and vesting.createVestingSchedule() will
        // be broadcast as a separate on-chain transaction
        vm.startBroadcast();
        
        console.log("=== Creating Allocations and Vesting Schedules ===");
        console.log("Processing addresses", startIndex, "to", endIndex - 1);
        console.log("NOTE: Each address will create 3 on-chain transactions");
        console.log("  - Transaction 1: createAllocation");
        console.log("  - Transaction 2: createVestingSchedule (first half - Nov 30, 2025)");
        console.log("  - Transaction 3: createVestingSchedule (second half - Dec 30, 2025)");
        console.log("");
        
        uint256 successCount = 0;
        uint256 failCount = 0;
        
        // Process batch - each iteration sends 2 transactions on-chain
        // Note: i is the global index, but we need to use local index for JSON array access
        for (uint256 i = startIndex; i < endIndex; i++) {
            uint256 localIndex = i - startIndex; // Local index within the batch (0-based)
            string memory basePath = string.concat(".records[", vm.toString(localIndex), "]");
            
            address beneficiary = vm.parseJsonAddress(json, string.concat(basePath, ".address"));
            uint256 amount = vm.parseJsonUint(json, string.concat(basePath, ".amount"));
            
            // Log the amount being processed for verification
            console.log("Processing index", i);
            console.log("  Address:", beneficiary);
            console.log("  Amount (wei):", amount);
            
            // Step 1: Create allocation (sends on-chain transaction)
            uint256 allocationId;
            bool allocationSuccess = false;
            
            try vault.createAllocation(beneficiary, amount) returns (uint256 id) {
                allocationId = id;
                allocationSuccess = true;
            } catch Error(string memory reason) {
                console.log("  FAILED to create allocation for address", i);
                console.log("  Error:", reason);
                failCount++;
                saveProgress(i);
                continue;
            } catch (bytes memory) {
                console.log("  FAILED to create allocation for address", i);
                console.log("  Error: Custom error or revert");
                failCount++;
                saveProgress(i);
                continue;
            }
            
            if (!allocationSuccess) {
                saveProgress(i);
                continue;
            }
            
            // Step 2: Split amount into two halves
            uint256 halfAmount = amount / 2;
            uint256 remainder = amount - halfAmount; // Handle odd amounts
            
            // Step 3: Create first vesting schedule (half amount - Nov 30, 2025)
            uint256 scheduleId1;
            bool vestingSuccess1 = false;
            
            try vesting.createVestingSchedule(
                beneficiary,
                halfAmount,
                FIRST_VESTING_START_TIME,
                0,              // No cliff
                1,              // 1 second duration (immediate unlock)
                allocationId
            ) returns (uint256 id) {
                scheduleId1 = id;
                vestingSuccess1 = true;
            } catch Error(string memory reason) {
                console.log("  FAILED to create first vesting schedule for address", i);
                console.log("  Error:", reason);
                failCount++;
                saveProgress(i);
                continue;
            } catch (bytes memory) {
                console.log("  FAILED to create first vesting schedule for address", i);
                console.log("  Error: Custom error or revert");
                failCount++;
                saveProgress(i);
                continue;
            }
            
            // Step 4: Create second vesting schedule (remainder - Dec 30, 2025)
            uint256 scheduleId2;
            bool vestingSuccess2 = false;
            
            try vesting.createVestingSchedule(
                beneficiary,
                remainder,
                SECOND_VESTING_START_TIME,
                0,              // No cliff
                1,              // 1 second duration (immediate unlock)
                allocationId
            ) returns (uint256 id) {
                scheduleId2 = id;
                vestingSuccess2 = true;
            } catch Error(string memory reason) {
                console.log("  FAILED to create second vesting schedule for address", i);
                console.log("  Error:", reason);
                failCount++;
                // Save progress even if second vesting fails (allocation and first vesting were created)
                saveProgress(i);
                continue;
            } catch (bytes memory) {
                console.log("  FAILED to create second vesting schedule for address", i);
                console.log("  Error: Custom error or revert");
                failCount++;
                saveProgress(i);
                continue;
            }
            
            if (allocationSuccess && vestingSuccess1 && vestingSuccess2) {
                successCount++;
                // Save progress after each successful set (allocation + 2 vesting schedules)
                // Save i+1 (next index to process) so we continue from the next index
                saveProgress(i + 1);
            }
            
            // Log progress every 10 addresses
            if ((i - startIndex + 1) % 10 == 0 || i == startIndex || i == endIndex - 1) {
                uint256 batchProgress = i - startIndex + 1;
                uint256 globalProgress = i + 1;
                console.log("Progress:", batchProgress, "/", actualBatchSize);
                console.log("Global progress:", globalProgress, "/", totalAddresses);
                if (allocationSuccess && vestingSuccess1 && vestingSuccess2) {
                    console.log("Allocation ID:", allocationId);
                    console.log("Schedule ID 1 (Nov 30, 2025):", scheduleId1);
                    console.log("Schedule ID 2 (Dec 30, 2025):", scheduleId2);
                }
            }
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Batch Complete ===");
        console.log("Successfully processed:", successCount);
        console.log("Failed:", failCount);
        console.log("Last processed index:", endIndex - 1);
        console.log("First vesting start time:", FIRST_VESTING_START_TIME, "(Nov 30, 2025 00:00 UTC)");
        console.log("Second vesting start time:", SECOND_VESTING_START_TIME, "(Dec 30, 2025 00:00 UTC)");
        console.log("");
        console.log("To continue, run:");
        console.log("  forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched --sig \"run(uint256)\"", actualBatchSize, "--rpc-url <rpc> --private-key <key> --broadcast --ffi");
    }
    
    /**
     * @dev Load progress from file, returns next index to process
     *      Progress file semantics:
     *      - On success: saves i+1 (next index to process)
     *      - On failure: saves i (failed index to retry)
     *      - On load: returns lastIndex directly (not +1) to handle both cases:
     *        * If lastIndex was saved after success, it's the next index to process (correct)
     *        * If lastIndex was saved after failure, it's the failed index to retry (correct)
     */
    function loadProgress() internal returns (uint256) {
        string[] memory readInputs = new string[](2);
        readInputs[0] = "cat";
        readInputs[1] = PROGRESS_FILE;
        
        try vm.ffi(readInputs) returns (bytes memory result) {
            string memory json = string(result);
            
            // Try to parse lastProcessedIndex, but handle negative values or invalid data
            try vm.parseJsonUint(json, ".lastProcessedIndex") returns (uint256 lastIndex) {
                // Return lastIndex directly:
                // - If saved after success: lastIndex = i+1 (next index to process) ✓
                // - If saved after failure: lastIndex = i (failed index to retry) ✓
                console.log("Resuming from index:", lastIndex);
                return lastIndex;
            } catch {
                // If parsing fails (e.g., -1 or invalid), start from 0
                console.log("Invalid progress data, starting from index 0");
                return 0;
            }
        } catch {
            console.log("No progress file found, starting from index 0");
            return 0;
        }
    }
    
    /**
     * @dev Save progress to file using FFI
     */
    function saveProgress(uint256 lastProcessedIndex) internal {
        string memory indexStr = vm.toString(lastProcessedIndex);
        string memory timestampStr = vm.toString(block.timestamp);
        
        // Create JSON content - escape quotes properly
        string memory json = string.concat(
            "{\"lastProcessedIndex\":",
            indexStr,
            ",\"timestamp\":",
            timestampStr,
            "}"
        );
        
        // Write to file using FFI with printf to handle JSON properly
        string[] memory writeInputs = new string[](3);
        writeInputs[0] = "sh";
        writeInputs[1] = "-c";
        writeInputs[2] = string.concat("printf '%s\\n' '", json, "' > ", PROGRESS_FILE);
        
        vm.ffi(writeInputs);
    }
}

