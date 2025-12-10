import { ethers } from "hardhat";
import { EventLog } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

/**
 * Script to find wallets that have November vesting schedules but haven't claimed their tokens
 * 
 * Usage: 
 *   # For Ethereum mainnet (where schedules were created):
 *   npx hardhat run scripts/query-november-unclaimed.ts --network mainnet
 * 
 *   # For Base mainnet:
 *   npx hardhat run scripts/query-november-unclaimed.ts --network base
 * 
 * Environment variables:
 *   VESTING_MANAGER_ADDRESS - Contract address (default: 0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51)
 *   DEPLOYMENT_BLOCK - Starting block number (optional, defaults to last 2M blocks)
 *   OUTPUT_FILE - Output JSON file path (default: scripts/data/november-unclaimed-wallets.json)
 *   ETHEREUM_MAINNET_URL - Ethereum mainnet RPC URL (optional, defaults to public RPC)
 *   CONCURRENT_REQUESTS - Number of parallel requests in Step 3 (default: 50, increase for faster processing)
 *   MAX_RETRIES - Number of retry attempts for failed requests (default: 3)
 *   BLOCK_BATCH_SIZE - Number of blocks to fetch concurrently in Step 2 (default: 50, reduce if getting timeouts)
 *   BATCH_DELAY_MS - Delay in milliseconds between batches in Step 2 (default: 100, increase if getting rate limited)
 * 
 * Performance optimizations:
 *   - Parallel processing: Processes multiple schedules concurrently (configurable via CONCURRENT_REQUESTS)
 *   - Retry logic: Automatically retries failed requests with exponential backoff
 *   - Better error handling: Continues processing even if some requests fail
 *   - Progress tracking: Shows real-time progress with processing rate
 */

const VESTING_MANAGER_ADDRESS_RAW = process.env.VESTING_MANAGER_ADDRESS || "0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51";
const CHUNK_SIZE = 1000; // RPC limit for most providers
const NOVEMBER_START_TIME = 1764460800; // Nov 30, 2025 00:00 UTC
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, "data/november-unclaimed-wallets.json");
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || "50"); // Parallel requests for Step 3
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "3"); // Retry attempts for failed requests

interface NovemberScheduleData {
    scheduleId: string;
    beneficiary: string;
    totalAmount: string;
    startTime: number;
    cliffDuration: number;
    duration: number;
    allocationId: string;
    createdAt: number;
}

interface NovemberWalletData {
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

async function main() {
    console.log("🚀 Starting November unclaimed wallets query...\n");
    const startTimeDate = new Date(NOVEMBER_START_TIME * 1000).toISOString();
    console.log(`📅 November Start Time: ${NOVEMBER_START_TIME} (${startTimeDate})\n`);
    
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
        
        // Determine starting block - default to last 2M blocks to find all schedules
        // (November schedules were likely created recently, but we want to be thorough)
        const deploymentBlock = process.env.DEPLOYMENT_BLOCK ? parseInt(process.env.DEPLOYMENT_BLOCK) : null;
        const fromBlock = deploymentBlock ?? Math.max(0, currentBlock - 2000000);
        
        if (deploymentBlock !== null) {
            console.log(`📅 Using deployment block from env: ${deploymentBlock}`);
        } else {
            console.log(`📅 Querying from last 2M blocks (use DEPLOYMENT_BLOCK env var to set specific block or 0 for all blocks)`);
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
        
        // Debug: Show all start times found
        if (allScheduleEvents.length > 0) {
            console.log("🔍 Debug: Analyzing start times of found schedules...");
            const startTimesFound = new Map<number, number>(); // startTime -> count
            
            for (const event of allScheduleEvents) {
                if (!("args" in event)) continue;
                const args = event.args as any[];
                const startTime = Number(args[3]);
                startTimesFound.set(startTime, (startTimesFound.get(startTime) || 0) + 1);
            }
            
            console.log(`\n📊 Found ${startTimesFound.size} unique start time(s):`);
            for (const [startTime, count] of startTimesFound.entries()) {
                const date = new Date(startTime * 1000).toISOString();
                console.log(`   - ${startTime} (${date}) - ${count} schedule(s)`);
            }
            const targetDate = new Date(NOVEMBER_START_TIME * 1000).toISOString();
            console.log(`\n🎯 Looking for start time: ${NOVEMBER_START_TIME} (${targetDate})\n`);
        }
        
        // Step 2: Filter for November schedules
        console.log("=".repeat(80));
        console.log(`STEP 2: Filtering for November schedules (startTime == ${NOVEMBER_START_TIME})...`);
        console.log("=".repeat(80));
        
        const novemberSchedules: NovemberScheduleData[] = [];
        const blockCache = new Map<number, number>(); // blockNumber -> timestamp
        let processedStep2 = 0;
        const step2StartTime = Date.now();
        
        // First pass: collect all unique block numbers for November schedules
        const uniqueBlockNumbers = new Set<number>();
        for (const event of allScheduleEvents) {
            if (!("args" in event)) continue;
            const args = event.args as any[];
            const startTime = Number(args[3]);
            if (startTime === NOVEMBER_START_TIME) {
                uniqueBlockNumbers.add(event.blockNumber);
            }
        }
        
        console.log(`📦 Found ${uniqueBlockNumbers.size} unique blocks to fetch (out of ${allScheduleEvents.length} total events)\n`);
        console.log(`🔄 Fetching block timestamps in batches...`);
        
        // Helper function to fetch a block with retry logic
        async function fetchBlockWithRetry(blockNum: number, maxRetries: number = 3): Promise<{ block: any; success: boolean }> {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const block = await provider.getBlock(blockNum);
                    return { block, success: true };
                } catch (error: any) {
                    if (attempt === maxRetries) {
                        console.error(`   ⚠️  Failed to fetch block ${blockNum} after ${maxRetries} attempts: ${error.message}`);
                        return { block: null, success: false };
                    }
                    // Exponential backoff: wait 1s, 2s, 4s
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            return { block: null, success: false };
        }
        
        // Batch fetch all unique blocks with retry logic and smaller batches
        const blockNumbersArray = Array.from(uniqueBlockNumbers);
        const BATCH_SIZE = parseInt(process.env.BLOCK_BATCH_SIZE || "50"); // Reduced from 100 to 50, configurable
        const BATCH_DELAY = parseInt(process.env.BATCH_DELAY_MS || "100"); // Delay between batches in ms
        
        console.log(`   Using batch size: ${BATCH_SIZE}, delay: ${BATCH_DELAY}ms between batches\n`);
        
        for (let i = 0; i < blockNumbersArray.length; i += BATCH_SIZE) {
            const batch = blockNumbersArray.slice(i, i + BATCH_SIZE);
            
            try {
                // Fetch blocks with retry logic
                const blockResults = await Promise.all(
                    batch.map(blockNum => fetchBlockWithRetry(blockNum))
                );
                
                blockResults.forEach((result, idx) => {
                    if (result.success && result.block) {
                        blockCache.set(batch[idx], result.block.timestamp);
                    }
                });
                
                // Add delay between batches to avoid overwhelming the RPC
                if (i + BATCH_SIZE < blockNumbersArray.length) {
                    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                }
                
                if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= blockNumbersArray.length) {
                    const progress = Math.min(100, ((i + BATCH_SIZE) / blockNumbersArray.length * 100)).toFixed(1);
                    const cached = blockCache.size;
                    console.log(`   📊 Progress: ${progress}% (${Math.min(i + BATCH_SIZE, blockNumbersArray.length)}/${blockNumbersArray.length} blocks) - ${cached} cached`);
                }
            } catch (error: any) {
                console.error(`   ❌ Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
                // Continue with next batch instead of failing completely
            }
        }
        
        console.log(`✅ Cached ${blockCache.size} block timestamps\n`);
        console.log(`🔄 Processing November schedules...`);
        
        // Second pass: filter and process November schedules using cached block data
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
            
            // Filter for November schedules only
            if (startTime !== NOVEMBER_START_TIME) {
                continue;
            }
            
            processedStep2++;
            const blockTimestamp = blockCache.get(event.blockNumber) || 0;
            
            const schedule: NovemberScheduleData = {
                scheduleId,
                beneficiary,
                totalAmount,
                startTime,
                cliffDuration,
                duration,
                allocationId,
                createdAt: blockTimestamp,
            };
            
            novemberSchedules.push(schedule);
            
            if (processedStep2 % 10000 === 0) {
                const elapsed = ((Date.now() - step2StartTime) / 1000).toFixed(1);
                console.log(`   📊 Processed ${processedStep2} November schedules - ${elapsed}s elapsed`);
            }
        }
        
        const step2Elapsed = ((Date.now() - step2StartTime) / 1000).toFixed(1);
        console.log(`✅ Found ${novemberSchedules.length} November vesting schedules (${step2Elapsed}s elapsed)\n`);
        
        // Step 3: Fetch current schedule state from contract and identify unclaimed wallets
        console.log("=".repeat(80));
        console.log("STEP 3: Fetching current schedule state and identifying unclaimed wallets...");
        console.log("=".repeat(80));
        
        const unclaimedWallets: NovemberWalletData[] = [];
        const RETRY_DELAY = 1000; // 1 second base delay
        
        console.log(`⚙️  Configuration:`);
        console.log(`   - Concurrent requests: ${CONCURRENT_REQUESTS}`);
        console.log(`   - Max retries per request: ${MAX_RETRIES}`);
        console.log(`   - Retry delay: ${RETRY_DELAY}ms (exponential backoff)\n`);
        
        // Retry helper with exponential backoff
        async function retryWithBackoff<T>(
            fn: () => Promise<T>,
            maxRetries: number = MAX_RETRIES,
            delay: number = RETRY_DELAY
        ): Promise<T> {
            let lastError: any;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    return await fn();
                } catch (error: any) {
                    lastError = error;
                    if (attempt < maxRetries - 1) {
                        const backoffDelay = delay * Math.pow(2, attempt);
                        await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    }
                }
            }
            throw lastError;
        }
        
        // Process a single schedule
        async function processSchedule(schedule: NovemberScheduleData): Promise<NovemberWalletData | null> {
            try {
                // Fetch current schedule state from contract with retry
                const scheduleData = await retryWithBackoff(
                    () => (contract as any).getVestingSchedule(schedule.scheduleId)
                ) as any;
                const vestingInfo = await retryWithBackoff(
                    () => (contract as any).getVestingInfo(schedule.scheduleId)
                ) as any;
                
                const totalAmount = parseFloat(ethers.formatEther(scheduleData.totalAmount));
                const releasedAmount = parseFloat(ethers.formatEther(scheduleData.releasedAmount));
                const unclaimedAmount = totalAmount - releasedAmount;
                const claimableAmount = parseFloat(ethers.formatEther(vestingInfo.releasableAmount));
                
                // Only include schedules that have unclaimed tokens
                if (unclaimedAmount > 0 && !scheduleData.revoked) {
                    return {
                        wallet: schedule.beneficiary,
                        scheduleId: schedule.scheduleId,
                        totalAmount: ethers.formatEther(scheduleData.totalAmount),
                        releasedAmount: ethers.formatEther(scheduleData.releasedAmount),
                        unclaimedAmount: unclaimedAmount.toFixed(18),
                        claimableAmount: ethers.formatEther(vestingInfo.releasableAmount),
                        revoked: scheduleData.revoked,
                        startTime: Number(scheduleData.startTime),
                        cliffEndTime: Number(scheduleData.startTime) + Number(scheduleData.cliffDuration),
                        vestingEndTime: Number(scheduleData.startTime) + Number(scheduleData.duration),
                    };
                }
                return null;
            } catch (error: any) {
                // Only log if all retries failed
                console.error(`   ⚠️  Error fetching schedule ${schedule.scheduleId} for ${schedule.beneficiary}:`, error.message);
                return null;
            }
        }
        
        // Process schedules in batches with concurrency control
        let processed = 0;
        let errors = 0;
        const step3StartTime = Date.now();
        
        for (let i = 0; i < novemberSchedules.length; i += CONCURRENT_REQUESTS) {
            const batch = novemberSchedules.slice(i, i + CONCURRENT_REQUESTS);
            const batchPromises = batch.map(schedule => processSchedule(schedule));
            const batchResults = await Promise.all(batchPromises);
            
            // Filter out null results and add to unclaimedWallets
            const validResults = batchResults.filter((result): result is NovemberWalletData => result !== null);
            unclaimedWallets.push(...validResults);
            
            processed += batch.length;
            errors += batchResults.filter(r => r === null).length;
            
            // Progress update every 1000 schedules or at the end
            if (processed % 1000 === 0 || processed === novemberSchedules.length) {
                const elapsed = ((Date.now() - step3StartTime) / 1000).toFixed(1);
                const progress = ((processed / novemberSchedules.length) * 100).toFixed(1);
                const rate = (processed / ((Date.now() - step3StartTime) / 1000)).toFixed(1);
                console.log(`   📊 Processing schedule ${processed}/${novemberSchedules.length} (${progress}%) - ${rate} schedules/sec - ${errors} errors - ${elapsed}s elapsed`);
            }
        }
        
        console.log(`\n✅ Processed ${novemberSchedules.length} November schedules`);
        console.log(`✅ Found ${unclaimedWallets.length} wallets with unclaimed November tokens\n`);
        
        // Step 4: Generate summary and save results
        console.log("=".repeat(80));
        console.log("📊 SUMMARY");
        console.log("=".repeat(80));
        console.log(`Total November Schedules: ${novemberSchedules.length}`);
        console.log(`Wallets with Unclaimed November Tokens: ${unclaimedWallets.length}`);
        
        const totalUnclaimed = unclaimedWallets.reduce(
            (sum, w) => sum + parseFloat(w.unclaimedAmount),
            0
        );
        const totalClaimable = unclaimedWallets.reduce(
            (sum, w) => sum + parseFloat(w.claimableAmount),
            0
        );
        
        console.log(`Total Unclaimed November Tokens: ${totalUnclaimed.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} TTN`);
        console.log(`Total Claimable Now: ${totalClaimable.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} TTN\n`);
        
        // Sort by unclaimed amount (descending)
        unclaimedWallets.sort((a, b) => parseFloat(b.unclaimedAmount) - parseFloat(a.unclaimedAmount));
        
        // Display top 10
        console.log("🏆 Top 10 Wallets by Unclaimed November Amount:");
        console.log("-".repeat(80));
        unclaimedWallets.slice(0, 10).forEach((wallet, index) => {
            console.log(
                `${(index + 1).toString().padStart(2)}. ${wallet.wallet.slice(0, 10)}...${wallet.wallet.slice(-8)} | ` +
                `Unclaimed: ${parseFloat(wallet.unclaimedAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TTN | ` +
                `Claimable: ${parseFloat(wallet.claimableAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TTN | ` +
                `Schedule ID: ${wallet.scheduleId}`
            );
        });
        
        // Ensure output directory exists
        const outputDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Save to file
        const output = {
            queryDate: new Date().toISOString(),
            contractAddress: VESTING_MANAGER_ADDRESS,
            novemberStartTime: NOVEMBER_START_TIME,
            fromBlock,
            toBlock: currentBlock,
            totalNovemberSchedules: novemberSchedules.length,
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

