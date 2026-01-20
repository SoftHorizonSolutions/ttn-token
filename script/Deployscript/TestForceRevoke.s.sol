// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../../contracts/upgrades/TTNVestingManagerV2.sol";
import "../../contracts/TTNVestingManager.sol";

/**
 * @title TestForceRevokeScript
 * @dev Test script for forceRevokeSchedule and batchForceRevokeSchedules functions
 * 
 * Usage:
 *   forge script script/Deployscript/TestForceRevoke.s.sol:TestForceRevokeScript \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast \
 *     --private-key $YOUR_PRIVATE_KEY
 * 
 * Environment Variables:
 *   VESTING_MANAGER_PROXY - Proxy address of the V2 contract (required)
 *   PRIVATE_KEY - Private key for the account with DEFAULT_ADMIN_ROLE (optional, can use --private-key flag instead)
 */

contract TestForceRevokeScript is Script {
    // Schedule IDs to test
    uint256[] private scheduleIds = [1197, 1196, 1195, 1194, 1193, 1192, 1191, 1190];

    function run() external {
        // Get proxy address from environment
        address proxyAddress = vm.envAddress("VESTING_MANAGER_PROXY");
        
        console.log("\n=== Testing Force Revoke Functions ===");
        console.log("Proxy Address:", proxyAddress);

        // Check if PRIVATE_KEY is provided via environment variable
        try vm.envUint("PRIVATE_KEY") returns (uint256 privateKey) {
            console.log("Using private key from PRIVATE_KEY environment variable");
            vm.startBroadcast(privateKey);
        } catch {
            // No PRIVATE_KEY env var, use default (--private-key flag or foundry.toml)
            console.log("Using private key from --private-key flag or foundry.toml");
            vm.startBroadcast();
        }

        TTNVestingManagerV2 vestingManager = TTNVestingManagerV2(proxyAddress);
        
        // Verify we're on V2
        uint256 version = vestingManager.getVersion();
        console.log("\nContract Version:", version);
        require(version == 2, "Contract must be V2 to use forceRevokeSchedule functions");

        // Display schedule information before revoking
        console.log("\n=== Schedule Information Before Revoking ===");
        for (uint256 i = 0; i < scheduleIds.length; i++) {
            _displayScheduleInfo(vestingManager, scheduleIds[i]);
        }

        // Test 1: Force revoke a single schedule (first one)
        console.log("\n=== Test 1: Force Revoke Single Schedule ===");
        if (scheduleIds.length > 0) {
            uint256 testScheduleId = scheduleIds[0];
            console.log("Testing forceRevokeSchedule for Schedule ID:", testScheduleId);
            
            // Check if already revoked
            (address beneficiary, uint256 totalAmount, uint256 releasedAmount, bool revoked) = 
                _getScheduleInfo(vestingManager, testScheduleId);
            
            if (beneficiary == address(0)) {
                console.log("  Schedule does not exist, skipping...");
            } else if (revoked) {
                console.log("  Schedule is already revoked, skipping...");
            } else {
                try vestingManager.forceRevokeSchedule(testScheduleId) returns (uint256 unvestedAmount) {
                    console.log("  [SUCCESS] Successfully revoked schedule");
                    console.log("  Unvested amount revoked:", unvestedAmount);
                    console.log("  Total amount:", totalAmount);
                    console.log("  Released amount:", releasedAmount);
                } catch Error(string memory reason) {
                    console.log("  [ERROR] Failed with reason:", reason);
                } catch (bytes memory lowLevelData) {
                    console.log("  [ERROR] Failed with error data:");
                    console.logBytes(lowLevelData);
                }
            }
        }

        // Test 2: Batch force revoke remaining schedules
        console.log("\n=== Test 2: Batch Force Revoke Schedules ===");
        
        // Filter out already revoked or non-existent schedules
        uint256[] memory schedulesToRevoke = new uint256[](scheduleIds.length);
        uint256 validCount = 0;
        
        for (uint256 i = 0; i < scheduleIds.length; i++) {
            (address beneficiary, , , bool revoked) = _getScheduleInfo(vestingManager, scheduleIds[i]);
            if (beneficiary != address(0) && !revoked) {
                schedulesToRevoke[validCount] = scheduleIds[i];
                validCount++;
            }
        }
        
        if (validCount == 0) {
            console.log("  No valid schedules to revoke in batch");
        } else {
            // Resize array to valid count
            uint256[] memory finalSchedules = new uint256[](validCount);
            for (uint256 i = 0; i < validCount; i++) {
                finalSchedules[i] = schedulesToRevoke[i];
            }
            
            console.log("  Attempting to revoke", validCount, "schedules:");
            for (uint256 i = 0; i < validCount; i++) {
                console.log("    - Schedule ID:", finalSchedules[i]);
            }
            
            try vestingManager.batchForceRevokeSchedules(finalSchedules) returns (uint256 successCount) {
                console.log("  [SUCCESS] Batch revoke completed");
                console.log("  Successfully revoked:", successCount, "schedules");
            } catch Error(string memory reason) {
                console.log("  [ERROR] Batch revoke failed with reason:", reason);
            } catch (bytes memory lowLevelData) {
                console.log("  [ERROR] Batch revoke failed with error data:");
                console.logBytes(lowLevelData);
            }
        }

        // Display schedule information after revoking
        console.log("\n=== Schedule Information After Revoking ===");
        for (uint256 i = 0; i < scheduleIds.length; i++) {
            _displayScheduleInfo(vestingManager, scheduleIds[i]);
        }

        vm.stopBroadcast();
        
        console.log("\n=== Test Complete ===");
    }

    /**
     * @dev Helper function to get schedule information
     */
    function _getScheduleInfo(
        TTNVestingManagerV2 vestingManager,
        uint256 scheduleId
    ) internal view returns (
        address beneficiary,
        uint256 totalAmount,
        uint256 releasedAmount,
        bool revoked
    ) {
        try vestingManager.getVestingSchedule(scheduleId) returns (VestingManager.VestingSchedule memory schedule) {
            return (
                schedule.beneficiary,
                schedule.totalAmount,
                schedule.releasedAmount,
                schedule.revoked
            );
        } catch {
            // Schedule doesn't exist or invalid
            return (address(0), 0, 0, false);
        }
    }

    /**
     * @dev Helper function to display schedule information
     */
    function _displayScheduleInfo(
        TTNVestingManagerV2 vestingManager,
        uint256 scheduleId
    ) internal view {
        (address beneficiary, uint256 totalAmount, uint256 releasedAmount, bool revoked) = 
            _getScheduleInfo(vestingManager, scheduleId);
        
        console.log("\n  Schedule ID:", scheduleId);
        if (beneficiary == address(0)) {
            console.log("    Status: Does not exist");
        } else {
            console.log("    Beneficiary:", beneficiary);
            console.log("    Total Amount:", totalAmount);
            console.log("    Released Amount:", releasedAmount);
            console.log("    Unvested Amount:", totalAmount - releasedAmount);
            console.log("    Revoked:", revoked ? "Yes" : "No");
        }
    }
}

