import * as fs from "fs";
import * as path from "path";

/**
 * Script to verify that the November unclaimed wallets JSON file contains:
 * 1. Unique wallet+scheduleId combinations (no duplicates)
 * 2. All entries are indeed unclaimed (releasedAmount < totalAmount, unclaimedAmount > 0, revoked = false)
 * 3. Data integrity checks
 * 
 * Usage:
 *   npx ts-node scripts/verify-november-unclaimed.ts
 * 
 * Environment variables:
 *   INPUT_FILE - Path to JSON file (default: scripts/data/november-unclaimed-wallets.json)
 */

const INPUT_FILE = process.env.INPUT_FILE || path.join(__dirname, "data/november-unclaimed-wallets.json");

interface WalletEntry {
    wallet: string;
    scheduleId: string;
    totalAmount: string;
    releasedAmount: string;
    unclaimedAmount: string;
    claimableAmount: string;
    revoked: boolean;
    startTime: number;
    cliffEndTime: number;
    vestingEndTime: number;
}

interface NovemberUnclaimedData {
    queryDate: string;
    contractAddress: string;
    novemberStartTime: number;
    fromBlock: number;
    toBlock: number;
    totalNovemberSchedules: number;
    totalUnclaimedWallets: number;
    totalUnclaimedTokens: string;
    totalClaimableTokens: string;
    wallets: WalletEntry[];
}

function verifyUnclaimedWallets() {
    console.log("🔍 Verifying November Unclaimed Wallets\n");
    console.log("=".repeat(80));
    
    // Check if file exists
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ File not found: ${INPUT_FILE}`);
        process.exit(1);
    }
    
    console.log(`📄 Reading file: ${INPUT_FILE}\n`);
    
    // Read and parse JSON
    let data: NovemberUnclaimedData;
    try {
        const fileContent = fs.readFileSync(INPUT_FILE, "utf-8");
        data = JSON.parse(fileContent);
    } catch (error: any) {
        console.error(`❌ Error reading/parsing JSON file: ${error.message}`);
        process.exit(1);
    }
    
    console.log(`✅ Loaded ${data.wallets.length} wallet entries`);
    console.log(`📊 Metadata:`);
    console.log(`   Query Date: ${data.queryDate}`);
    console.log(`   Contract: ${data.contractAddress}`);
    console.log(`   November Start Time: ${data.novemberStartTime}`);
    console.log(`   Total November Schedules: ${data.totalNovemberSchedules}`);
    console.log(`   Total Unclaimed Wallets: ${data.totalUnclaimedWallets}`);
    console.log(`   Total Unclaimed Tokens: ${data.totalUnclaimedTokens} TTN`);
    console.log(`   Total Claimable Tokens: ${data.totalClaimableTokens} TTN\n`);
    
    // Verification results
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // 1. Check for duplicate wallet+scheduleId combinations
    console.log("🔍 Checking for duplicate wallet+scheduleId combinations...");
    const walletScheduleMap = new Map<string, number>();
    const duplicates: Array<{ wallet: string; scheduleId: string; indices: number[] }> = [];
    
    data.wallets.forEach((entry, index) => {
        const key = `${entry.wallet.toLowerCase()}-${entry.scheduleId}`;
        const count = walletScheduleMap.get(key) || 0;
        walletScheduleMap.set(key, count + 1);
        
        if (count > 0) {
            // Find existing duplicate entry
            const existing = duplicates.find(d => 
                d.wallet.toLowerCase() === entry.wallet.toLowerCase() && 
                d.scheduleId === entry.scheduleId
            );
            if (existing) {
                existing.indices.push(index);
            } else {
                // Find the first occurrence
                const firstIndex = data.wallets.findIndex((e, i) => 
                    i < index &&
                    e.wallet.toLowerCase() === entry.wallet.toLowerCase() &&
                    e.scheduleId === entry.scheduleId
                );
                duplicates.push({
                    wallet: entry.wallet,
                    scheduleId: entry.scheduleId,
                    indices: [firstIndex, index]
                });
            }
        }
    });
    
    if (duplicates.length > 0) {
        issues.push(`❌ Found ${duplicates.length} duplicate wallet+scheduleId combinations:`);
        duplicates.forEach(dup => {
            issues.push(`   Wallet: ${dup.wallet}, Schedule ID: ${dup.scheduleId}, Indices: ${dup.indices.join(", ")}`);
        });
    } else {
        console.log(`✅ No duplicate wallet+scheduleId combinations found\n`);
    }
    
    // 2. Check for duplicate wallet addresses (same wallet with multiple schedules - this is OK but report it)
    console.log("🔍 Checking for wallets with multiple schedules...");
    const walletCountMap = new Map<string, number[]>();
    data.wallets.forEach((entry, index) => {
        const wallet = entry.wallet.toLowerCase();
        if (!walletCountMap.has(wallet)) {
            walletCountMap.set(wallet, []);
        }
        walletCountMap.get(wallet)!.push(index);
    });
    
    const multiScheduleWallets = Array.from(walletCountMap.entries())
        .filter(([_, indices]) => indices.length > 1)
        .map(([wallet, indices]) => ({ wallet, count: indices.length, indices }));
    
    if (multiScheduleWallets.length > 0) {
        warnings.push(`⚠️  Found ${multiScheduleWallets.length} wallets with multiple schedules (this is OK):`);
        multiScheduleWallets.slice(0, 10).forEach(w => {
            warnings.push(`   ${w.wallet}: ${w.count} schedules`);
        });
        if (multiScheduleWallets.length > 10) {
            warnings.push(`   ... and ${multiScheduleWallets.length - 10} more`);
        }
    } else {
        console.log(`✅ All wallets have unique schedules\n`);
    }
    
    // 3. Verify unclaimed status
    console.log("🔍 Verifying unclaimed status...");
    let validUnclaimed = 0;
    let invalidUnclaimed = 0;
    
    data.wallets.forEach((entry, index) => {
        const totalAmount = parseFloat(entry.totalAmount);
        const releasedAmount = parseFloat(entry.releasedAmount);
        const unclaimedAmount = parseFloat(entry.unclaimedAmount);
        const claimableAmount = parseFloat(entry.claimableAmount);
        
        const problems: string[] = [];
        
        // Check if revoked
        if (entry.revoked) {
            problems.push("revoked=true");
        }
        
        // Check if fully claimed
        if (releasedAmount >= totalAmount) {
            problems.push(`releasedAmount (${releasedAmount}) >= totalAmount (${totalAmount})`);
        }
        
        // Check if unclaimedAmount is 0 or negative
        if (unclaimedAmount <= 0) {
            problems.push(`unclaimedAmount (${unclaimedAmount}) <= 0`);
        }
        
        // Check if claimableAmount is 0 or negative
        if (claimableAmount <= 0) {
            problems.push(`claimableAmount (${claimableAmount}) <= 0`);
        }
        
        // Check if unclaimedAmount matches calculation
        const expectedUnclaimed = totalAmount - releasedAmount;
        const tolerance = 0.0000001; // Allow for floating point precision
        if (Math.abs(unclaimedAmount - expectedUnclaimed) > tolerance) {
            problems.push(`unclaimedAmount (${unclaimedAmount}) doesn't match calculation (${expectedUnclaimed})`);
        }
        
        // Check if startTime matches November start time
        if (entry.startTime !== data.novemberStartTime) {
            problems.push(`startTime (${entry.startTime}) doesn't match November start time (${data.novemberStartTime})`);
        }
        
        if (problems.length > 0) {
            invalidUnclaimed++;
            issues.push(`❌ Entry ${index} (Wallet: ${entry.wallet}, Schedule: ${entry.scheduleId}): ${problems.join(", ")}`);
        } else {
            validUnclaimed++;
        }
    });
    
    if (invalidUnclaimed === 0) {
        console.log(`✅ All ${validUnclaimed} entries are valid unclaimed wallets\n`);
    } else {
        console.log(`⚠️  Found ${invalidUnclaimed} invalid entries out of ${data.wallets.length} total\n`);
    }
    
    // 4. Verify totals match
    console.log("🔍 Verifying totals...");
    const calculatedUnclaimed = data.wallets.reduce((sum, entry) => {
        return sum + parseFloat(entry.unclaimedAmount);
    }, 0);
    
    const calculatedClaimable = data.wallets.reduce((sum, entry) => {
        return sum + parseFloat(entry.claimableAmount);
    }, 0);
    
    const reportedUnclaimed = parseFloat(data.totalUnclaimedTokens);
    const reportedClaimable = parseFloat(data.totalClaimableTokens);
    
    const unclaimedDiff = Math.abs(calculatedUnclaimed - reportedUnclaimed);
    const claimableDiff = Math.abs(calculatedClaimable - reportedClaimable);
    const tolerance = 0.0000001;
    
    if (unclaimedDiff > tolerance) {
        issues.push(`❌ Total unclaimed tokens mismatch: Calculated ${calculatedUnclaimed.toFixed(18)} vs Reported ${reportedUnclaimed.toFixed(18)} (diff: ${unclaimedDiff})`);
    } else {
        console.log(`✅ Total unclaimed tokens match: ${calculatedUnclaimed.toFixed(18)} TTN\n`);
    }
    
    if (claimableDiff > tolerance) {
        issues.push(`❌ Total claimable tokens mismatch: Calculated ${calculatedClaimable.toFixed(18)} vs Reported ${reportedClaimable.toFixed(18)} (diff: ${claimableDiff})`);
    } else {
        console.log(`✅ Total claimable tokens match: ${calculatedClaimable.toFixed(18)} TTN\n`);
    }
    
    // 5. Check wallet count matches
    if (data.wallets.length !== data.totalUnclaimedWallets) {
        issues.push(`❌ Wallet count mismatch: File has ${data.wallets.length} entries but metadata says ${data.totalUnclaimedWallets}`);
    } else {
        console.log(`✅ Wallet count matches: ${data.wallets.length}\n`);
    }
    
    // 6. Validate wallet address format
    console.log("🔍 Validating wallet address formats...");
    const invalidAddresses: Array<{ index: number; wallet: string }> = [];
    const walletAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    
    data.wallets.forEach((entry, index) => {
        if (!walletAddressRegex.test(entry.wallet)) {
            invalidAddresses.push({ index, wallet: entry.wallet });
        }
    });
    
    if (invalidAddresses.length > 0) {
        issues.push(`❌ Found ${invalidAddresses.length} invalid wallet addresses:`);
        invalidAddresses.forEach(addr => {
            issues.push(`   Index ${addr.index}: ${addr.wallet}`);
        });
    } else {
        console.log(`✅ All wallet addresses are valid\n`);
    }
    
    // Print summary
    console.log("=".repeat(80));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("=".repeat(80));
    
    if (warnings.length > 0) {
        console.log("\n⚠️  WARNINGS (non-critical):");
        warnings.forEach(warning => console.log(warning));
    }
    
    if (issues.length > 0) {
        console.log("\n❌ ISSUES FOUND:");
        issues.forEach(issue => console.log(issue));
        console.log(`\n❌ Verification FAILED: Found ${issues.length} issue(s)`);
        process.exit(1);
    } else {
        console.log("\n✅ VERIFICATION PASSED!");
        console.log(`   - All entries are unique (no duplicate wallet+scheduleId combinations)`);
        console.log(`   - All entries are valid unclaimed wallets`);
        console.log(`   - All totals match`);
        console.log(`   - All wallet addresses are valid`);
        if (multiScheduleWallets.length > 0) {
            console.log(`   - ${multiScheduleWallets.length} wallets have multiple schedules (expected)`);
        }
        process.exit(0);
    }
}

// Run verification
verifyUnclaimedWallets();

