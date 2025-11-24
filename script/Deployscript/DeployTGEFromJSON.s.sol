// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../../contracts/TTNVestingManager.sol";

/**
 * @title DeployTGEFromJSON
 * @dev Reads from JSON file using FFI workaround
 */
contract DeployTGEFromJSON is Script {
    address constant VESTING_PROXY = 0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f;
    
    function run() external {
        VestingManager vesting = VestingManager(VESTING_PROXY);
        
        console.log("=== Deploy TGE Vesting ===");
        
        // Use FFI to read file (workaround for fs_permissions)
        string[] memory inputs = new string[](2);
        inputs[0] = "cat";
        inputs[1] = "script/data/vesting-data.json";
        
        bytes memory result = vm.ffi(inputs);
        string memory json = string(result);
        
        uint256 totalAddresses = vm.parseJsonUint(json, ".totalAddresses");
        uint256 totalAllocation = vm.parseJsonUint(json, ".totalAllocation");
        
        console.log("Total addresses:", totalAddresses);
        console.log("Total allocation:", totalAllocation);
        
        // Hardcoded unlock time: Thursday, 23 October 2025 13:00:00 GMT+01:00 (12:00:00 UTC)
        uint256 unlockTime = 1761220800;
        console.log("Unlock time:", unlockTime);
        console.log("Unlock date: Thursday, 23 October 2025 12:00:00 UTC");
        console.log("");
        
        // Arrays to store schedule data
        uint256[] memory scheduleIds = new uint256[](totalAddresses);
        address[] memory beneficiaries = new address[](totalAddresses);
        uint256[] memory amounts = new uint256[](totalAddresses);
        string[] memory labels = new string[](totalAddresses);
        
        vm.startBroadcast();
        
        for (uint256 i = 0; i < totalAddresses; i++) {
            string memory basePath = string.concat(".records[", vm.toString(i), "]");
            
            address beneficiary = vm.parseJsonAddress(json, string.concat(basePath, ".address"));
            uint256 amount = vm.parseJsonUint(json, string.concat(basePath, ".amount"));
            string memory label = vm.parseJsonString(json, string.concat(basePath, ".label"));
            
            // Create vesting schedule and capture the returned schedule ID
            uint256 scheduleId = vesting.createVestingSchedule(
                beneficiary,
                amount,
                unlockTime,
                0,  // No cliff
                1,  // 1 second duration
                0   // No allocation ID
            );
            
            // Store the data
            scheduleIds[i] = scheduleId;
            beneficiaries[i] = beneficiary;
            amounts[i] = amount;
            labels[i] = label;
            
            console.log("Created Schedule ID:", scheduleId, "for:", label);
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== Complete ===");
        console.log("Total schedules created:", totalAddresses);
        console.log("Unlock: Thursday, 23 October 2025 12:00:00 UTC");
    }
}

