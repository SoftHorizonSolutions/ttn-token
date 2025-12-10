import { ethers } from "hardhat";
import { EventLog } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

/**
 * Script to find wallets that have vesting schedules but haven't claimed their tokens
 * 
 * Usage: 
 *   npx hardhat run scripts/query-unclaimed-wallets.ts --network base
 * 
 * Environment variables:
 *   VESTING_MANAGER_ADDRESS - Contract address (default: 0x70ca23c7f2b72ddF40e909b72ab9b43a9b5eef51)
 *   DEPLOYMENT_BLOCK - Starting block number (optional, defaults to last 500k blocks)
 *   OUTPUT_FILE - Output JSON file path (default: unclaimed-wallets.json)
 */

const VESTING_MANAGER_ADDRESS_RAW = process.env.VESTING_MANAGER_ADDRESS || "0x70ca23c7f2b72ddF40e909b72ab9b43a9b5eef51";
const CHUNK_SIZE = 1000; // RPC limit for most providers
const OUTPUT_FILE = process.env.OUTPUT_FILE || "unclaimed-wallets.json";

interface VestingScheduleData {
    scheduleId: string;
    beneficiary: string;
    totalAmount: string;
    startTime: number;
    cliffDuration: number;
    duration: number;
    allocationId: string;
    createdAt: number;
}

interface ClaimData {
    scheduleId: string;
    beneficiary: string;
    amount: string;
}

interface WalletData {
    wallet: string;
    schedules: VestingScheduleData[];
    totalAllocated: string;
    totalClaimed: string;
    totalUnclaimed: string;
    claimableAmount: string;
    hasUnclaimed: boolean;
    scheduleDetails: Array<{
        scheduleId: string;
        totalAmount: string;
        releasedAmount: string;
        remainingAmount: string;
        claimableAmount: string;
        revoked: boolean;
        startTime: number;
        cliffEndTime: number;
        vestingEndTime: number;
    }>;
}

async function main() {
    console.log("🚀 Starting unclaimed wallets query...\n");
    
    // Get provider from Hardhat
    const provider = ethers.provider;
    
    try {
        // Normalize address to proper checksum
        const VESTING_MANAGER_ADDRESS = ethers.getAddress(VESTING_MANAGER_ADDRESS_RAW.toLowerCase());
        
        // Get network info
        const network = await provider.getNetwork();
        console.log(`🌐 Network: Chain ID ${network.chainId} (${network.name})\n`);
        
        // Get current block
        const currentBlock = await provider.getBlockNumber();
        console.log(`📊 Current block number: ${currentBlock}\n`);
        
        // Create contract instance
        console.log(`📄 Contract address: ${VESTING_MANAGER_ADDRESS}`);
        const VestingManager = await ethers.getContractFactory("VestingManager");
        const contract = VestingManager.attach(VESTING_MANAGER_ADDRESS);
        
        // Verify contract has code
        const contractCode = await provider.getCode(VESTING_MANAGER_ADDRESS);
        if (contractCode === "0x") {
            console.error(`❌ CRITICAL: No contract code found at address ${VESTING_MANAGER_ADDRESS}`);
            process.exit(1);
        }
        console.log(`✅ Contract code verified\n`);
        
        // Determine starting block
        const deploymentBlock = process.env.DEPLOYMENT_BLOCK ? parseInt(process.env.DEPLOYMENT_BLOCK) : null;
        const fromBlock = deploymentBlock || Math.max(0, currentBlock - 500000);
        
        if (deploymentBlock) {
            console.log(`📅 Using deployment block from env: ${deploymentBlock}`);
        } else {
            console.log(`📅 Starting from last 500k blocks (use DEPLOYMENT_BLOCK env var to change)`);
        }
        console.log(`🔍 Querying events from block ${fromBlock} to block ${currentBlock}...\n`);
        
        // Step 1: Query all VestingScheduleCreated events
        console.log("=".repeat(80));
        console.log("STEP 1: Querying VestingScheduleCreated events...");
        console.log("=".repeat(80));
        
        const totalChunks = Math.ceil((currentBlock - fromBlock) / CHUNK_SIZE);
        console.log(`📦 Querying in chunks of ${CHUNK_SIZE} blocks (${totalChunks.toLocaleString()} total chunks)\n`);
        
        const startTime = Date.now();
        const allScheduleEvents: EventLog[] = [];
        
        for (let i = 0; i < totalChunks; i++) {
            const chunkFrom = fromBlock + (i * CHUNK_SIZE);
            const chunkTo = Math.min(chunkFrom + CHUNK_SIZE - 1, currentBlock);
            
            try {
                const chunkEvents = await contract.queryFilter("VestingScheduleCreated", chunkFrom, chunkTo);
                allScheduleEvents.push(...(chunkEvents as EventLog[]));
                
                if (chunkEvents.length > 0) {
                    console.log(`   ✅ Chunk ${i + 1}/${totalChunks} (blocks ${chunkFrom}-${chunkTo}) - Found ${chunkEvents.length} schedules`);
                }
                
                if ((i + 1) % 500 === 0 || i === totalChunks - 1) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const progress = (((i + 1) / totalChunks) * 100).toFixed(1);
                    console.log(`   📊 Progress: ${progress}% (${i + 1}/${totalChunks} chunks) - ${allScheduleEvents.length} total schedules - ${elapsed}s elapsed`);
                }
            } catch (error: any) {
                console.error(`❌ Error querying chunk ${i + 1}:`, error.message);
            }
        }
        
        console.log(`\n✅ Found ${allScheduleEvents.length} VestingScheduleCreated events\n`);
        
        // Step 2: Query all TokensReleased events
        console.log("=".repeat(80));
        console.log("STEP 2: Querying TokensReleased events...");
        console.log("=".repeat(80));
        
        const allClaimEvents: EventLog[] = [];
        
        for (let i = 0; i < totalChunks; i++) {
            const chunkFrom = fromBlock + (i * CHUNK_SIZE);
            const chunkTo = Math.min(chunkFrom + CHUNK_SIZE - 1, currentBlock);
            
            try {
                const chunkEvents = await contract.queryFilter("TokensReleased", chunkFrom, chunkTo);
                allClaimEvents.push(...(chunkEvents as EventLog[]));
                
                if (chunkEvents.length > 0) {
                    console.log(`   ✅ Chunk ${i + 1}/${totalChunks} (blocks ${chunkFrom}-${chunkTo}) - Found ${chunkEvents.length} claims`);
                }
                
                if ((i + 1) % 500 === 0 || i === totalChunks - 1) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const progress = (((i + 1) / totalChunks) * 100).toFixed(1);
                    console.log(`   📊 Progress: ${progress}% (${i + 1}/${totalChunks} chunks) - ${allClaimEvents.length} total claims - ${elapsed}s elapsed`);
                }
            } catch (error: any) {
                console.error(`❌ Error querying chunk ${i + 1}:`, error.message);
            }
        }
        
        console.log(`\n✅ Found ${allClaimEvents.length} TokensReleased events\n`);
        
        // Step 3: Process events and build data structures
        console.log("=".repeat(80));
        console.log("STEP 3: Processing events and identifying unclaimed wallets...");
        console.log("=".repeat(80));
        
        // Map of beneficiary -> array of schedules
        const schedulesByWallet = new Map<string, VestingScheduleData[]>();
        
        // Process schedule events
        for (const event of allScheduleEvents) {
            if (!("args" in event)) continue;
            
            const args = event.args as any[];
            const scheduleId = args[0].toString();
            const beneficiary = args[1].toString();
            const totalAmount = ethers.formatEther(args[2]);
            const startTime = Number(args[3]);
            const cliffDuration = Number(args[4]);
            const duration = Number(args[5]);
            const allocationId = args[6].toString();
            
            const block = await provider.getBlock(event.blockNumber);
            
            const schedule: VestingScheduleData = {
                scheduleId,
                beneficiary,
                totalAmount,
                startTime,
                cliffDuration,
                duration,
                allocationId,
                createdAt: Number(block?.timestamp || 0),
            };
            
            if (!schedulesByWallet.has(beneficiary)) {
                schedulesByWallet.set(beneficiary, []);
            }
            schedulesByWallet.get(beneficiary)!.push(schedule);
        }
        
        // Map of scheduleId -> total claimed amount
        const claimsBySchedule = new Map<string, string>();
        
        // Process claim events
        for (const event of allClaimEvents) {
            if (!("args" in event)) continue;
            
            const args = event.args as any[];
            const scheduleId = args[0].toString();
            const amount = ethers.formatEther(args[2]);
            
            const existing = claimsBySchedule.get(scheduleId) || "0";
            const newTotal = (parseFloat(existing) + parseFloat(amount)).toFixed(18);
            claimsBySchedule.set(scheduleId, newTotal);
        }
        
        console.log(`✅ Processed ${schedulesByWallet.size} unique wallets with schedules\n`);
        
        // Step 4: Fetch current schedule state from contract and identify unclaimed wallets
        console.log("=".repeat(80));
        console.log("STEP 4: Fetching current schedule state from contract...");
        console.log("=".repeat(80));
        
        const unclaimedWallets: WalletData[] = [];
        let processed = 0;
        
        for (const [wallet, schedules] of schedulesByWallet.entries()) {
            processed++;
            
            if (processed % 100 === 0) {
                console.log(`   📊 Processing wallet ${processed}/${schedulesByWallet.size}...`);
            }
            
            let totalAllocated = 0;
            let totalClaimed = 0;
            const scheduleDetails: WalletData["scheduleDetails"] = [];
            let hasUnclaimed = false;
            
            for (const schedule of schedules) {
                try {
                    // Fetch current schedule state from contract
                    const scheduleData = await (contract as any).getVestingSchedule(schedule.scheduleId);
                    const vestingInfo = await (contract as any).getVestingInfo(schedule.scheduleId);
                    
                    const totalAmount = parseFloat(ethers.formatEther(scheduleData.totalAmount));
                    const releasedAmount = parseFloat(ethers.formatEther(scheduleData.releasedAmount));
                    const remainingAmount = totalAmount - releasedAmount;
                    const claimableAmount = parseFloat(ethers.formatEther(vestingInfo.releasableAmount));
                    
                    totalAllocated += totalAmount;
                    totalClaimed += releasedAmount;
                    
                    // Check if schedule has unclaimed tokens
                    const hasUnclaimedInSchedule = remainingAmount > 0 && !scheduleData.revoked;
                    if (hasUnclaimedInSchedule) {
                        hasUnclaimed = true;
                    }
                    
                    scheduleDetails.push({
                        scheduleId: schedule.scheduleId,
                        totalAmount: ethers.formatEther(scheduleData.totalAmount),
                        releasedAmount: ethers.formatEther(scheduleData.releasedAmount),
                        remainingAmount: remainingAmount.toFixed(18),
                        claimableAmount: ethers.formatEther(vestingInfo.releasableAmount),
                        revoked: scheduleData.revoked,
                        startTime: Number(scheduleData.startTime),
                        cliffEndTime: Number(scheduleData.startTime) + Number(scheduleData.cliffDuration),
                        vestingEndTime: Number(scheduleData.startTime) + Number(scheduleData.duration),
                    });
                } catch (error: any) {
                    console.error(`   ⚠️  Error fetching schedule ${schedule.scheduleId} for ${wallet}:`, error.message);
                }
            }
            
            // Only include wallets that have unclaimed tokens
            if (hasUnclaimed) {
                const totalUnclaimed = totalAllocated - totalClaimed;
                const totalClaimable = scheduleDetails.reduce(
                    (sum, s) => sum + parseFloat(s.claimableAmount),
                    0
                );
                
                unclaimedWallets.push({
                    wallet,
                    schedules: schedules,
                    totalAllocated: totalAllocated.toFixed(18),
                    totalClaimed: totalClaimed.toFixed(18),
                    totalUnclaimed: totalUnclaimed.toFixed(18),
                    claimableAmount: totalClaimable.toFixed(18),
                    hasUnclaimed: true,
                    scheduleDetails,
                });
            }
        }
        
        console.log(`\n✅ Processed ${schedulesByWallet.size} wallets`);
        console.log(`✅ Found ${unclaimedWallets.length} wallets with unclaimed tokens\n`);
        
        // Step 5: Generate summary and save results
        console.log("=".repeat(80));
        console.log("📊 SUMMARY");
        console.log("=".repeat(80));
        console.log(`Total Wallets with Schedules: ${schedulesByWallet.size}`);
        console.log(`Wallets with Unclaimed Tokens: ${unclaimedWallets.length}`);
        
        const totalUnclaimed = unclaimedWallets.reduce(
            (sum, w) => sum + parseFloat(w.totalUnclaimed),
            0
        );
        const totalClaimable = unclaimedWallets.reduce(
            (sum, w) => sum + parseFloat(w.claimableAmount),
            0
        );
        
        console.log(`Total Unclaimed Tokens: ${totalUnclaimed.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} TTN`);
        console.log(`Total Claimable Now: ${totalClaimable.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} TTN\n`);
        
        // Sort by unclaimed amount (descending)
        unclaimedWallets.sort((a, b) => parseFloat(b.totalUnclaimed) - parseFloat(a.totalUnclaimed));
        
        // Display top 10
        console.log("🏆 Top 10 Wallets by Unclaimed Amount:");
        console.log("-".repeat(80));
        unclaimedWallets.slice(0, 10).forEach((wallet, index) => {
            console.log(
                `${(index + 1).toString().padStart(2)}. ${wallet.wallet.slice(0, 10)}...${wallet.wallet.slice(-8)} | ` +
                `Unclaimed: ${parseFloat(wallet.totalUnclaimed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TTN | ` +
                `Claimable: ${parseFloat(wallet.claimableAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TTN | ` +
                `Schedules: ${wallet.schedules.length}`
            );
        });
        
        // Save to file
        const output = {
            queryDate: new Date().toISOString(),
            contractAddress: VESTING_MANAGER_ADDRESS,
            fromBlock,
            toBlock: currentBlock,
            totalWalletsWithSchedules: schedulesByWallet.size,
            totalUnclaimedWallets: unclaimedWallets.length,
            totalUnclaimedTokens: totalUnclaimed.toFixed(18),
            totalClaimableTokens: totalClaimable.toFixed(18),
            wallets: unclaimedWallets,
        };
        
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        
        console.log("\n" + "=".repeat(80));
        console.log("✅ Query completed successfully!");
        console.log(`📄 Results saved to: ${OUTPUT_FILE}`);
        console.log("=".repeat(80));
        
    } catch (error: any) {
        console.error("\n❌ Fatal error:", error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

