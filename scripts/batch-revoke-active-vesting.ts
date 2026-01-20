import { ethers } from "hardhat";
import { EventLog } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Batch revoke active vesting schedules using batchForceRevokeSchedules
 * This script finds all active (non-revoked) schedules and revokes them in batches
 * 
 * Usage:
 *   npx hardhat run scripts/batch-revoke-active-vesting.ts --network baseSepolia
 * 
 * Environment variables:
 *   VESTING_MANAGER_ADDRESS - Contract address (default: 0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f)
 *   DEPLOYMENT_BLOCK - Starting block number for event queries (optional)
 *   BATCH_SIZE - Number of schedules per batch (default: 50, max recommended: 100)
 *   DRY_RUN - Set to "true" to only find schedules without revoking (default: false)
 */

const VESTING_MANAGER_ADDRESS_RAW = process.env.VESTING_MANAGER_ADDRESS || "0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f";
const CHUNK_SIZE = 1000; // For event querying
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "50"); // Schedules per revoke batch
const DRY_RUN = process.env.DRY_RUN === "true";

interface ActiveSchedule {
    scheduleId: number;
    beneficiary: string;
    totalAmount: bigint;
    releasedAmount: bigint;
    unvestedAmount: bigint;
}

async function main() {
    console.log("🚀 Batch Revoke Active Vesting Schedules\n");
    
    if (DRY_RUN) {
        console.log("⚠️  DRY RUN MODE - No schedules will be revoked\n");
    } else {
        console.log("⚠️  WARNING: This will revoke active vesting schedules!\n");
    }
    
    const provider = ethers.provider;
    const VESTING_MANAGER_ADDRESS = ethers.getAddress(VESTING_MANAGER_ADDRESS_RAW.toLowerCase());
    
    const network = await provider.getNetwork();
    console.log(`🌐 Network: Chain ID ${network.chainId} (${network.name})`);
    console.log(`📄 Contract Address: ${VESTING_MANAGER_ADDRESS}\n`);
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block number: ${currentBlock}\n`);
    
    // Get signer to check if we have permission
    const [signer] = await ethers.getSigners();
    console.log(`👤 Signer: ${signer.address}\n`);
    
    // Try to get contract as V2 first, fall back to V1
    let VestingManager: any;
    let contract: any;
    let isV2 = false;
    
    try {
        VestingManager = await ethers.getContractFactory("TTNVestingManagerV2");
        contract = VestingManager.attach(VESTING_MANAGER_ADDRESS);
        
        // Check if it's V2 by trying to call getVersion
        try {
            const version = await contract.getVersion();
            if (version === 2n) {
                isV2 = true;
                console.log(`✅ Contract Version: ${version} (V2 with batch revoke support)\n`);
            }
        } catch {
            // Not V2 or doesn't have getVersion
        }
    } catch {
        // Fall back to V1
        VestingManager = await ethers.getContractFactory("VestingManager");
        contract = VestingManager.attach(VESTING_MANAGER_ADDRESS);
    }
    
    if (!isV2) {
        console.error("❌ Contract must be V2 (TTNVestingManagerV2) to use batchForceRevokeSchedules!");
        console.error("   Current contract does not support batch revoke operations.");
        process.exit(1);
    }
    
    // Check if contract is paused
    try {
        const paused = await contract.paused();
        if (paused) {
            console.error("❌ Contract is PAUSED! Cannot revoke schedules.");
            process.exit(1);
        }
    } catch {
        // Paused function might not exist or be accessible, continue
    }
    
    // Check if signer has admin role
    try {
        const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
        const hasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
        if (!hasAdminRole) {
            console.error(`❌ Signer ${signer.address} does NOT have DEFAULT_ADMIN_ROLE!`);
            console.error("   Cannot revoke schedules without admin role.");
            process.exit(1);
        }
        console.log(`✅ Signer has DEFAULT_ADMIN_ROLE\n`);
    } catch (error: any) {
        console.log(`⚠️  Could not verify admin role: ${error.message}\n`);
    }
    
    // Step 1: Find all active schedules (same logic as find-active-vesting-fast.ts)
    console.log("=".repeat(80));
    console.log("STEP 1: Finding active vesting schedules...");
    console.log("=".repeat(80));
    
    const fromBlock = process.env.DEPLOYMENT_BLOCK 
        ? parseInt(process.env.DEPLOYMENT_BLOCK) 
        : Math.max(0, currentBlock - 2_000_000); // Last 2M blocks
    
    console.log(`📦 Querying VestingScheduleCreated events from block ${fromBlock} to ${currentBlock}\n`);
    
    const allScheduleEvents: EventLog[] = [];
    const totalChunks = Math.ceil((currentBlock - fromBlock) / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
        const chunkFrom = fromBlock + (i * CHUNK_SIZE);
        const chunkTo = Math.min(chunkFrom + CHUNK_SIZE - 1, currentBlock);
        
        try {
            const chunkEvents = await contract.queryFilter("VestingScheduleCreated", chunkFrom, chunkTo);
            allScheduleEvents.push(...(chunkEvents as EventLog[]));
            
            if (chunkEvents.length > 0) {
                console.log(`   ✅ Chunk ${i + 1}/${totalChunks} (blocks ${chunkFrom}-${chunkTo}) - Found ${chunkEvents.length} schedules`);
            }
            
            if ((i + 1) % 100 === 0 || i === totalChunks - 1) {
                console.log(`   📊 Progress: ${((i + 1) / totalChunks * 100).toFixed(1)}% - ${allScheduleEvents.length} total schedules`);
            }
        } catch (error: any) {
            console.error(`   ❌ Error querying chunk ${i + 1}:`, error.message);
        }
    }
    
    console.log(`\n✅ Found ${allScheduleEvents.length} total vesting schedules\n`);
    
    // Extract unique schedule IDs
    const scheduleIds = new Set<number>();
    for (const event of allScheduleEvents) {
        const scheduleId = Number(event.args[0]);
        scheduleIds.add(scheduleId);
    }
    
    const sortedScheduleIds = Array.from(scheduleIds).sort((a, b) => a - b);
    console.log(`📋 Unique schedule IDs found: ${sortedScheduleIds.length}`);
    console.log(`   Range: ${sortedScheduleIds[0]} to ${sortedScheduleIds[sortedScheduleIds.length - 1]}\n`);
    
    // Step 2: Check which schedules are active
    console.log("=".repeat(80));
    console.log("STEP 2: Checking which schedules are active (not revoked)...");
    console.log("=".repeat(80));
    console.log("");
    
    const activeSchedules: ActiveSchedule[] = [];
    let activeCount = 0;
    let revokedCount = 0;
    
    // Process in batches for progress tracking
    const CHECK_BATCH_SIZE = 10;
    for (let i = 0; i < sortedScheduleIds.length; i += CHECK_BATCH_SIZE) {
        const batch = sortedScheduleIds.slice(i, Math.min(i + CHECK_BATCH_SIZE, sortedScheduleIds.length));
        
        const batchPromises = batch.map(async (scheduleId) => {
            try {
                const schedule = await contract.getVestingSchedule(scheduleId);
                
                if (schedule.revoked) {
                    revokedCount++;
                    return null;
                }
                
                activeCount++;
                const unvestedAmount = schedule.totalAmount - schedule.releasedAmount;
                
                return {
                    scheduleId,
                    beneficiary: schedule.beneficiary,
                    totalAmount: schedule.totalAmount,
                    releasedAmount: schedule.releasedAmount,
                    unvestedAmount: BigInt(unvestedAmount.toString())
                };
            } catch (error: any) {
                console.error(`   ❌ Error checking schedule ${scheduleId}:`, error.message);
                return null;
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        for (const result of batchResults) {
            if (result) {
                activeSchedules.push(result);
            }
        }
        
        // Show progress
        if ((i + CHECK_BATCH_SIZE) % 50 === 0 || i + CHECK_BATCH_SIZE >= sortedScheduleIds.length) {
            console.log(`   📊 Progress: ${Math.min(i + CHECK_BATCH_SIZE, sortedScheduleIds.length)}/${sortedScheduleIds.length} checked - ${activeCount} active, ${revokedCount} revoked`);
        }
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("RESULTS");
    console.log("=".repeat(80));
    console.log(`Total schedules found: ${sortedScheduleIds.length}`);
    console.log(`Active schedules: ${activeCount}`);
    console.log(`Revoked schedules: ${revokedCount}\n`);
    
    if (activeSchedules.length === 0) {
        console.log("✅ No active schedules to revoke. Exiting.");
        return;
    }
    
    // Calculate totals
    let totalUnvested = 0n;
    for (const schedule of activeSchedules) {
        totalUnvested += schedule.unvestedAmount;
    }
    
    console.log(`📊 Total unvested amount across all active schedules: ${ethers.formatEther(totalUnvested)} TTN\n`);
    
    if (DRY_RUN) {
        console.log("=".repeat(80));
        console.log("DRY RUN - No schedules were revoked");
        console.log("=".repeat(80));
        console.log(`Would revoke ${activeSchedules.length} schedules in ${Math.ceil(activeSchedules.length / BATCH_SIZE)} batches`);
        console.log(`Batch size: ${BATCH_SIZE} schedules per batch`);
        return;
    }
    
    // Step 3: Diagnostic - Check a sample schedule to understand why revocation might fail
    console.log("=".repeat(80));
    console.log("STEP 2.5: Diagnostic check on sample schedules...");
    console.log("=".repeat(80));
    
    if (activeSchedules.length > 0) {
        const sampleScheduleId = activeSchedules[0].scheduleId;
        console.log(`\n🔍 Checking sample schedule ID: ${sampleScheduleId}`);
        
        try {
            const sampleSchedule = await contract.getVestingSchedule(sampleScheduleId);
            console.log(`   ✅ Schedule exists`);
            console.log(`   - Beneficiary: ${sampleSchedule.beneficiary}`);
            console.log(`   - Revoked: ${sampleSchedule.revoked}`);
            console.log(`   - Total Amount: ${ethers.formatEther(sampleSchedule.totalAmount)} TTN`);
            console.log(`   - Released Amount: ${ethers.formatEther(sampleSchedule.releasedAmount)} TTN`);
            console.log(`   - Unvested: ${ethers.formatEther(sampleSchedule.totalAmount - sampleSchedule.releasedAmount)} TTN`);
            
            // Check if beneficiary is zero address
            if (sampleSchedule.beneficiary === ethers.ZeroAddress) {
                console.log(`   ❌ PROBLEM: Beneficiary is zero address - contract will skip this!`);
            }
            
            // Check if already revoked
            if (sampleSchedule.revoked) {
                console.log(`   ❌ PROBLEM: Schedule is already revoked - contract will skip this!`);
            }
            
            // Check if scheduleId is 0
            if (sampleScheduleId === 0) {
                console.log(`   ❌ PROBLEM: Schedule ID is 0 - contract will skip this!`);
            }
            
            // Test static call with just this one schedule
            try {
                const testStaticResult = await contract.batchForceRevokeSchedules.staticCall([sampleScheduleId]);
                console.log(`   ✅ Static call result: Would revoke ${Number(testStaticResult)} schedule(s)`);
                if (Number(testStaticResult) === 0) {
                    console.log(`   ❌ PROBLEM: Contract static call says it won't revoke this schedule!`);
                }
            } catch (staticErr: any) {
                console.log(`   ❌ Static call failed: ${staticErr.message}`);
            }
        } catch (error: any) {
            console.log(`   ❌ Error checking sample schedule: ${error.message}`);
        }
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("STEP 3: Batch revoking active schedules...");
    console.log("=".repeat(80));
    console.log(`📦 Batch size: ${BATCH_SIZE} schedules per batch\n`);
    
    const activeScheduleIds = activeSchedules.map(s => s.scheduleId);
    const totalBatches = Math.ceil(activeScheduleIds.length / BATCH_SIZE);
    
    let totalRevoked = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < activeScheduleIds.length; i += BATCH_SIZE) {
        const batch = activeScheduleIds.slice(i, Math.min(i + BATCH_SIZE, activeScheduleIds.length));
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        
        console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} schedules)`);
        console.log(`   Schedule IDs: ${batch.slice(0, 5).join(", ")}${batch.length > 5 ? ` ... (+${batch.length - 5} more)` : ""}`);
        
        try {
            // First, check expected result with staticCall
            let expectedSuccessCount = 0;
            try {
                const staticResult = await contract.batchForceRevokeSchedules.staticCall(batch);
                expectedSuccessCount = Number(staticResult);
                console.log(`   📊 Expected to revoke: ${expectedSuccessCount}/${batch.length} schedules (based on static call)`);
                
                if (expectedSuccessCount === 0) {
                    console.log(`   ⚠️  WARNING: Static call indicates NO schedules will be revoked!`);
                    console.log(`      This means all schedules are either:`);
                    console.log(`      - Already revoked`);
                    console.log(`      - Non-existent (beneficiary is zero address)`);
                    console.log(`      - Invalid schedule IDs`);
                }
            } catch (staticError: any) {
                console.log(`   ⚠️  Could not determine expected count: ${staticError.message}`);
            }
            
            // Now send the actual transaction
            const txResponse = await contract.batchForceRevokeSchedules(batch);
            console.log(`   ⏳ Transaction sent: ${txResponse.hash}`);
            
            const receipt = await txResponse.wait();
            if (receipt && receipt.status === 1) {
                console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);
                
                // Parse ScheduleRevoked events from the transaction logs
                const ScheduleRevokedTopic = ethers.id("ScheduleRevoked(uint256,address,uint256)");
                let eventsFromLogs = 0;
                const revokedScheduleIds: number[] = [];
                
                if (receipt.logs) {
                    for (const log of receipt.logs) {
                        // Check if this is a ScheduleRevoked event
                        if (log.topics && log.topics[0] === ScheduleRevokedTopic) {
                            eventsFromLogs++;
                            // Extract schedule ID from topic[1] (first indexed parameter)
                            // topics[1] is a hex string, need to convert properly
                            const scheduleId = Number(BigInt(log.topics[1]));
                            revokedScheduleIds.push(scheduleId);
                        }
                    }
                }
                
                console.log(`   📋 Events emitted: ${eventsFromLogs} ScheduleRevoked events found in logs`);
                if (revokedScheduleIds.length > 0 && revokedScheduleIds.length <= 5) {
                    console.log(`   📋 Revoked schedule IDs: ${revokedScheduleIds.join(", ")}`);
                } else if (revokedScheduleIds.length > 5) {
                    console.log(`   📋 Revoked schedule IDs: ${revokedScheduleIds.slice(0, 5).join(", ")} ... (+${revokedScheduleIds.length - 5} more)`);
                }
                
                // Also verify by checking the schedules state (should match events)
                let verifiedRevoked = 0;
                let verifiedActive = 0;
                let verifiedNotFound = 0;
                for (const scheduleId of batch) {
                    try {
                        const schedule = await contract.getVestingSchedule(scheduleId);
                        if (schedule.revoked) {
                            verifiedRevoked++;
                        } else {
                            verifiedActive++;
                            // Log why it might have been skipped
                            if (schedule.beneficiary === ethers.ZeroAddress) {
                                verifiedNotFound++;
                            }
                        }
                    } catch {
                        // Schedule might not exist
                        verifiedNotFound++;
                    }
                }
                
                console.log(`   ✅ State verification: ${verifiedRevoked}/${batch.length} schedules show as revoked`);
                if (verifiedActive > 0) {
                    console.log(`   ⚠️  Still active: ${verifiedActive} schedules (not revoked)`);
                }
                if (verifiedNotFound > 0) {
                    console.log(`   ⚠️  Not found: ${verifiedNotFound} schedules (don't exist or invalid)`);
                }
                
                // Use events count as the authoritative source (events are what actually happened)
                if (eventsFromLogs > 0 && verifiedRevoked !== eventsFromLogs) {
                    console.log(`   ⚠️  WARNING: Mismatch! Events show ${eventsFromLogs} revoked, but state check shows ${verifiedRevoked} revoked`);
                }
                
                // Prefer events count (authoritative), then static call result, then state check
                let revokedCount = eventsFromLogs;
                if (revokedCount === 0 && expectedSuccessCount > 0) {
                    revokedCount = expectedSuccessCount;
                }
                if (revokedCount === 0) {
                    revokedCount = verifiedRevoked;
                }
                
                console.log(`   ✅ Verified: ${revokedCount}/${batch.length} schedules revoked in this batch`);
                totalRevoked += revokedCount;
                
                // Warn if nothing was revoked
                if (revokedCount === 0 && expectedSuccessCount === 0) {
                    console.log(`   ⚠️  WARNING: No schedules were revoked. All schedules may be:`);
                    console.log(`      - Already revoked`);
                    console.log(`      - Non-existent (beneficiary is zero address)`);
                    console.log(`      - Invalid schedule IDs`);
                    
                    // Debug: Check first schedule in detail
                    if (batch.length > 0) {
                        const debugScheduleId = batch[0];
                        console.log(`\n   🔍 DEBUG: Checking schedule ${debugScheduleId} in detail...`);
                        try {
                            const beforeSchedule = await contract.getVestingSchedule(debugScheduleId);
                            console.log(`      Before: revoked=${beforeSchedule.revoked}, beneficiary=${beforeSchedule.beneficiary}`);
                            
                            // Check all conditions that would cause skip
                            if (debugScheduleId === 0) {
                                console.log(`      ❌ Schedule ID is 0 (will be skipped)`);
                            }
                            if (beforeSchedule.beneficiary === ethers.ZeroAddress) {
                                console.log(`      ❌ Beneficiary is zero address (will be skipped)`);
                            }
                            if (beforeSchedule.revoked) {
                                console.log(`      ❌ Already revoked (will be skipped)`);
                            }
                            
                            // Check what the contract sees
                            const testSingleResult = await contract.batchForceRevokeSchedules.staticCall([debugScheduleId]);
                            console.log(`      Static call result: ${Number(testSingleResult)} schedule would be revoked`);
                        } catch (debugError: any) {
                            console.log(`      Error checking schedule: ${debugError.message}`);
                        }
                    }
                }
            } else {
                console.log(`   ❌ Transaction failed`);
                totalFailed += batch.length;
            }
        } catch (error: any) {
            console.error(`   ❌ Error revoking batch ${batchNumber}:`, error.message);
            totalFailed += batch.length;
        }
        
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < activeScheduleIds.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Final summary
    console.log("\n" + "=".repeat(80));
    console.log("FINAL SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total active schedules found: ${activeSchedules.length}`);
    console.log(`Successfully revoked: ${totalRevoked}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Batches processed: ${totalBatches}\n`);
    
    if (totalRevoked > 0) {
        console.log("✅ Batch revoke operation completed!");
    } else {
        console.log("⚠️  No schedules were revoked. Please check the errors above.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

