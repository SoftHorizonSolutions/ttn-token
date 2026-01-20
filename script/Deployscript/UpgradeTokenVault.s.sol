// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../../contracts/upgrades/TTNTokenVaultV2.sol";
import "../../contracts/TTNTokenVault.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

/**
 * @title UpgradeTokenVaultScript
 * @dev Upgrades the TokenVault proxy to the new V2 implementation
 * 
 * Usage:
 *   # Option 1: Use --private-key flag (recommended)
 *   forge script script/Deployscript/UpgradeTokenVault.s.sol:UpgradeTokenVaultScript \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast \
 *     --verify \
 *     --private-key $YOUR_PRIVATE_KEY
 * 
 *   # Option 2: Use PRIVATE_KEY environment variable
 *   export PRIVATE_KEY=your_private_key_here
 *   forge script script/Deployscript/UpgradeTokenVault.s.sol:UpgradeTokenVaultScript \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast \
 *     --verify
 * 
 * Environment Variables:
 *   TOKEN_VAULT_PROXY - Proxy address to upgrade (required)
 *   PRIVATE_KEY - Private key for the account with DEFAULT_ADMIN_ROLE (optional, can use --private-key flag instead)
 */

contract UpgradeTokenVaultScript is Script {
    /**
     * @dev Upgrades an existing proxy to V2 implementation
     */
    function run() external {
        // Get proxy address from environment
        address proxyAddress = vm.envAddress("TOKEN_VAULT_PROXY");
        
        console.log("\n=== TokenVault Upgrade ===");
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

        // Pre-upgrade validation: Check for existing allocations
        TokenVault tokenVaultPre = TokenVault(proxyAddress);
        console.log("\n[Pre-upgrade Validation] Checking for existing allocations...");
        try tokenVaultPre.getAllocationById(1) returns (
            uint256 amount,
            address beneficiary,
            bool /* revoked */
        ) {
            if (beneficiary != address(0)) {
                console.log("[OK] Found existing allocations - storage will be preserved");
                console.log("     Sample allocation 1 beneficiary:", beneficiary);
                console.log("     Sample allocation 1 amount:", amount);
            } else {
                console.log("[INFO] No existing allocations found");
            }
        } catch {
            console.log("[INFO] Could not check for existing allocations (may be expected)");
        }

        // Use Upgrades library to upgrade the proxy
        // The library handles validation and deployment automatically
        console.log("\n[Upgrading] Upgrading proxy to TTNTokenVaultV2...");
        Upgrades.upgradeProxy(
            proxyAddress,
            "TTNTokenVaultV2.sol",
            abi.encodeCall(
                TTNTokenVaultV2.initializeV2,
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
        console.log("  - getVersion() -> returns 2");
    }
}

