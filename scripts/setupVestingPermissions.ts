import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Script to check and grant all necessary permissions for VestingManager to work properly
 * 
 * Required environment variables in .env:
 * - PRIVATE_KEY: Your wallet private key
 * - ABC_TOKEN_ADDRESS: Address of the ABCToken proxy contract
 * - ABC_VESTING_MANAGER_ADDRESS: Address of the ABCVestingManager proxy contract
 * - ABC_TOKEN_VAULT_ADDRESS: Address of the ABCTokenVault proxy contract
 */

async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("🔐 VESTING MANAGER PERMISSION SETUP SCRIPT");
    console.log("=".repeat(70) + "\n");

    // Hardcoded contract addresses (Base Sepolia)
    const ABC_TOKEN_ADDRESS = "0x794110602aCab007732EDA2F3AEe7DcE78bD6256";
    const VESTING_MANAGER_ADDRESS = "0x2df41d6e79a76bd4e913ab6dc8b954581ee8e67f";
    const TOKEN_VAULT_ADDRESS = "0xe72dcaea94829025391ace9cff3053c06731f46b";

    // Get signer (your wallet)
    const [signer] = await ethers.getSigners();
    const YOUR_WALLET = await signer.getAddress();

    console.log("📋 Configuration:");
    console.log("   Your Wallet:", YOUR_WALLET);
    console.log("   ABCToken:", ABC_TOKEN_ADDRESS);
    console.log("   VestingManager:", VESTING_MANAGER_ADDRESS);
    console.log("   TokenVault:", TOKEN_VAULT_ADDRESS);
    console.log("");

    // Get contract instances
    const abcToken = await ethers.getContractAt("ABCToken", ABC_TOKEN_ADDRESS);
    const vestingManager = await ethers.getContractAt("VestingManager", VESTING_MANAGER_ADDRESS);
    const tokenVault = await ethers.getContractAt("TokenVault", TOKEN_VAULT_ADDRESS);

    const DEFAULT_ADMIN_ROLE = await abcToken.DEFAULT_ADMIN_ROLE();

    // Track if we need to fix anything
    let needsFixes = false;

    console.log("🔍 CHECKING PERMISSIONS...\n");

    // ========== CHECK 1: Can VestingManager mint tokens? ==========
    console.log("📝 CHECK 1: Can VestingManager contract mint tokens on ABCToken?");
    const vestingCanMint = await abcToken.hasRole(DEFAULT_ADMIN_ROLE, VESTING_MANAGER_ADDRESS);
    
    if (vestingCanMint) {
        console.log("   ✅ YES - VestingManager can mint tokens");
    } else {
        console.log("   ❌ NO - VestingManager CANNOT mint tokens");
        needsFixes = true;
        
        console.log("   🔧 FIXING: Granting DEFAULT_ADMIN_ROLE to VestingManager...");
        try {
            const tx1 = await abcToken.grantRole(DEFAULT_ADMIN_ROLE, VESTING_MANAGER_ADDRESS);
            console.log("   ⏳ Transaction sent:", tx1.hash);
            await tx1.wait();
            console.log("   ✅ FIXED! VestingManager can now mint tokens");
        } catch (error) {
            console.error("   ❌ FAILED:", error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    // ========== CHECK 2: Does your wallet have admin role on VestingManager? ==========
    console.log("\n📝 CHECK 2: Does your wallet have admin role on VestingManager?");
    const youHaveAdmin = await vestingManager.hasRole(DEFAULT_ADMIN_ROLE, YOUR_WALLET);
    
    if (youHaveAdmin) {
        console.log("   ✅ YES - Your wallet has admin permissions");
    } else {
        console.log("   ❌ NO - Your wallet does NOT have admin permissions");
        needsFixes = true;
        
        console.log("   🔧 FIXING: Granting DEFAULT_ADMIN_ROLE on VestingManager to your wallet...");
        try {
            const tx2 = await vestingManager.grantRole(DEFAULT_ADMIN_ROLE, YOUR_WALLET);
            console.log("   ⏳ Transaction sent:", tx2.hash);
            await tx2.wait();
            console.log("   ✅ FIXED! Your wallet now has admin permissions");
        } catch (error) {
            console.error("   ❌ FAILED:", error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    // ========== CHECK 3: Is your wallet a manager on TokenVault? ==========
    console.log("\n📝 CHECK 3: Is your wallet a manager on TokenVault?");
    const youAreManager = await tokenVault.isManager(YOUR_WALLET);
    
    if (youAreManager) {
        console.log("   ✅ YES - Your wallet is a manager on TokenVault");
    } else {
        console.log("   ℹ️  NO - Your wallet is not a manager (optional if you have admin role)");
        console.log("   💡 Note: This is optional. Admin role is sufficient for manualUnlock.");
    }

    // ========== CHECK 4: Is VestingManager paused? ==========
    console.log("\n📝 CHECK 4: Is VestingManager paused?");
    const isPaused = await vestingManager.paused();
    
    if (isPaused) {
        console.log("   ❌ YES - VestingManager is PAUSED");
        needsFixes = true;
        
        console.log("   🔧 FIXING: Unpausing VestingManager...");
        try {
            const tx3 = await vestingManager.unpause();
            console.log("   ⏳ Transaction sent:", tx3.hash);
            await tx3.wait();
            console.log("   ✅ FIXED! VestingManager is now active");
        } catch (error) {
            console.error("   ❌ FAILED:", error instanceof Error ? error.message : String(error));
            throw error;
        }
    } else {
        console.log("   ✅ NO - VestingManager is active");
    }

    // ========== CHECK 5: Is ABCToken paused? ==========
    console.log("\n📝 CHECK 5: Is ABCToken paused?");
    const isTokenPaused = await abcToken.paused();
    
    if (isTokenPaused) {
        console.log("   ❌ YES - ABCToken is PAUSED");
        needsFixes = true;
        
        console.log("   🔧 FIXING: Unpausing ABCToken...");
        try {
            const tx4 = await abcToken.unpause();
            console.log("   ⏳ Transaction sent:", tx4.hash);
            await tx4.wait();
            console.log("   ✅ FIXED! ABCToken is now active");
        } catch (error) {
            console.error("   ❌ FAILED:", error instanceof Error ? error.message : String(error));
            throw error;
        }
    } else {
        console.log("   ✅ NO - ABCToken is active");
    }

    // ========== FINAL VERIFICATION ==========
    console.log("\n" + "=".repeat(70));
    console.log("📊 FINAL STATUS:");
    console.log("=".repeat(70));
    
    const finalVestingCanMint = await abcToken.hasRole(DEFAULT_ADMIN_ROLE, VESTING_MANAGER_ADDRESS);
    const finalYouHaveAdmin = await vestingManager.hasRole(DEFAULT_ADMIN_ROLE, YOUR_WALLET);
    const finalIsActive = !(await vestingManager.paused());
    const finalTokenActive = !(await abcToken.paused());
    
    console.log(`${finalVestingCanMint ? "✅" : "❌"} VestingManager can mint tokens: ${finalVestingCanMint}`);
    console.log(`${finalYouHaveAdmin ? "✅" : "❌"} Your wallet has admin role: ${finalYouHaveAdmin}`);
    console.log(`${finalIsActive ? "✅" : "❌"} VestingManager is active: ${finalIsActive}`);
    console.log(`${finalTokenActive ? "✅" : "❌"} ABCToken is active: ${finalTokenActive}`);
    
    console.log("=".repeat(70));
    
    if (!needsFixes) {
        console.log("\n🎉 All permissions were already configured correctly!");
    } else {
        console.log("\n🎉 All permissions have been fixed!");
    }
    
    console.log("\n✅ You can now call manualUnlock() from your frontend!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    });

