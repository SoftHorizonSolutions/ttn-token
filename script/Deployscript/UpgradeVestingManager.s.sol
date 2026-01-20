// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../../contracts/upgrades/TTNVestingManagerV2.sol";
import "../../contracts/TTNVestingManager.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

/**
 * @title UpgradeVestingManagerScript
 * @dev Upgrades the VestingManager proxy to the new V2 implementation with forceRevokeSchedule functions
 * 
 * Usage:
 *   # Option 1: Use --private-key flag (recommended)
 *   forge script script/Deployscript/UpgradeVestingManager.s.sol:UpgradeVestingManagerScript \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast \
 *     --verify \
 *     --private-key $YOUR_PRIVATE_KEY
 * 
 *   # Option 2: Use PRIVATE_KEY environment variable
 *   export PRIVATE_KEY=your_private_key_here
 *   forge script script/Deployscript/UpgradeVestingManager.s.sol:UpgradeVestingManagerScript \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast \
 *     --verify
 * 
 * Environment Variables:
 *   VESTING_MANAGER_PROXY - Proxy address to upgrade (required)
 *   PRIVATE_KEY - Private key for the account with DEFAULT_ADMIN_ROLE (optional, can use --private-key flag instead)
 */

contract UpgradeVestingManagerScript is Script {
    /**
     * @dev Upgrades an existing proxy to V2 implementation
     */
    function run() external {
        // Get proxy address from environment
        address proxyAddress = vm.envAddress("VESTING_MANAGER_PROXY");
        
        console.log("\n=== VestingManager Upgrade ===");
        console.log("Proxy Address:", proxyAddress);

        // Check if PRIVATE_KEY is provided via environment variable
        // If not, use default behavior (--private-key flag or foundry.toml config)
        try vm.envUint("PRIVATE_KEY") returns (uint256 privateKey) {
            console.log("Using private key from PRIVATE_KEY environment variable");
            vm.startBroadcast(privateKey);
        } catch {
            // No PRIVATE_KEY env var, use default (--private-key flag or foundry.toml)
            console.log("Using private key from --private-key flag or foundry.toml");
            vm.startBroadcast();
        }

        // Pre-upgrade validation: Check for existing schedules
        VestingManager vestingManagerPre = VestingManager(proxyAddress);
        console.log("\n[Pre-upgrade Validation] Checking for existing schedules...");
        try vestingManagerPre.getVestingSchedule(1) returns (
            VestingManager.VestingSchedule memory schedule
        ) {
            if (schedule.beneficiary != address(0)) {
                console.log("[OK] Found existing schedules - storage will be preserved");
                console.log("     Sample schedule 1 beneficiary:", schedule.beneficiary);
            } else {
                console.log("[INFO] No existing schedules found");
            }
        } catch {
            console.log("[INFO] Could not check for existing schedules (may be expected)");
        }

        // Use Upgrades library to upgrade the proxy
        // The library handles validation and deployment automatically
        console.log("\n[Upgrading] Upgrading proxy to TTNVestingManagerV2...");
        Upgrades.upgradeProxy(
            proxyAddress,
            "TTNVestingManagerV2.sol",
            abi.encodeCall(
                TTNVestingManagerV2.initializeV2,
                ()
            )
        );
        
        console.log("[OK] Upgrade transaction sent!");

        vm.stopBroadcast();
        
        // Get the implementation address after upgrade
        address newImplementation = Upgrades.getImplementationAddress(proxyAddress);
        
        console.log("\n=== Upgrade Summary ===");
        console.log("Proxy Address (unchanged):", proxyAddress);
        console.log("New Implementation Address:", newImplementation);
        console.log("[OK] Upgrade Complete!");
        console.log("[OK] V2 Initialization Complete!");
        console.log("\nNew functions available:");
        console.log("  - forceRevokeSchedule(uint256 scheduleId)");
        console.log("  - batchForceRevokeSchedules(uint256[] calldata scheduleIds)");
        console.log("  - getVersion() -> returns 2");
    }
    
}
