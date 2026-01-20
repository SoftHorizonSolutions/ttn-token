import { ethers } from "hardhat";
import { EventLog } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

/**
 * Script to find wallets that have claimed tokens from December vesting schedules
 * and still have tokens in their wallet (haven't moved/transferred them)
 * 
 * Usage: 
 *   npx hardhat run scripts/query-december-claimed-with-balance.ts --network base
 * 
 * Environment variables:
 *   VESTING_MANAGER_ADDRESS - Contract address (default: 0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51)
 *   TTN_TOKEN_ADDRESS - Token contract address (optional, will be fetched from VestingManager if not provided)
 *   DEPLOYMENT_BLOCK - Starting block number (optional, defaults to last 2M blocks)
 *   OUTPUT_FILE - Output JSON file path (default: scripts/data/december-claimed-with-balance.json)
 *   CONCURRENT_REQUESTS - Number of parallel requests (default: 100, increased for speed)
 *   MAX_RETRIES - Number of retry attempts for failed requests (default: 3)
 *   BLOCK_BATCH_SIZE - Number of blocks to fetch concurrently in Step 2 (default: 100)
 *   BATCH_DELAY_MS - Delay in milliseconds between batches (default: 50)
 *   BALANCE_BATCH_SIZE - Number of balance checks to batch together (default: 200)
 */

const VESTING_MANAGER_ADDRESS_RAW = process.env.VESTING_MANAGER_ADDRESS || "0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51";
const CHUNK_SIZE = 1000; // RPC limit for most providers
const DECEMBER_START_TIME = 1767052800; // Dec 30, 2025 00:00 UTC
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, "data/december-claimed-with-balance.json");
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || "100"); // Increased from 50 to 100
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "3");
const BLOCK_BATCH_SIZE = parseInt(process.env.BLOCK_BATCH_SIZE || "100"); // Increased from 50 to 100
const BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || "50"); // Reduced from 100 to 50
const BALANCE_BATCH_SIZE = parseInt(process.env.BALANCE_BATCH_SIZE || "200"); // New: batch balance checks

interface DecemberScheduleData {
    scheduleId: string;
    beneficiary: string;
    totalAmount: string;
    startTime: number;
    cliffDuration: number;
    duration: number;
    allocationId: string;
    createdAt: number;
}

interface DecemberClaimedWalletData {
    wallet: string;
    scheduleId: string;
    totalAmount: string;
    releasedAmount: string;
    claimedAmount: string;
    currentBalance: string;
    transferredAmount: string; // claimedAmount - currentBalance
    revoked: boolean;
    startTime: number;
    cliffEndTime: number;
    vestingEndTime: number;
}

async function main() {
    console.log("🚀 Starting December claimed wallets with balance query...\n");
    
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
        console.log(`📄 VestingManager address: ${VESTING_MANAGER_ADDRESS}`);
        const VestingManager = await ethers.getContractFactory("VestingManager");
        const contract = VestingManager.attach(VESTING_MANAGER_ADDRESS);
        
        // Verify contract has code
        const contractCode = await provider.getCode(VESTING_MANAGER_ADDRESS);
        if (contractCode === "0x") {
            console.error(`❌ CRITICAL: No contract code found at address ${VESTING_MANAGER_ADDRESS}`);
            process.exit(1);
        }
        console.log(`✅ Contract code verified\n`);
        
        // Get token address from VestingManager contract
        let TOKEN_ADDRESS: string;
        if (process.env.TTN_TOKEN_ADDRESS) {
            TOKEN_ADDRESS = ethers.getAddress(process.env.TTN_TOKEN_ADDRESS.toLowerCase());
            console.log(`📄 Using token address from env: ${TOKEN_ADDRESS}`);
        } else {
            console.log(`📄 Fetching token address from VestingManager contract...`);
            try {
                TOKEN_ADDRESS = await (contract as any).ttnToken();
                TOKEN_ADDRESS = ethers.getAddress(TOKEN_ADDRESS.toLowerCase());
                console.log(`✅ Token address: ${TOKEN_ADDRESS}\n`);
            } catch (error: any) {
                console.error(`❌ Failed to get token address from contract: ${error.message}`);
                console.error(`   Please provide TTN_TOKEN_ADDRESS environment variable`);
                process.exit(1);
            }
        }
        
        // Create ERC20 token contract instance for balance checks
        const ERC20_ABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];
        const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
        
        // Determine starting block
        const deploymentBlock = process.env.DEPLOYMENT_BLOCK ? parseInt(process.env.DEPLOYMENT_BLOCK) : null;
        const fromBlock = deploymentBlock ?? Math.max(0, currentBlock - 2000000);
        
        if (deploymentBlock !== null) {
            console.log(`📅 Using deployment block from env: ${deploymentBlock}`);
        } else {
            console.log(`📅 Querying from last 2M blocks (use DEPLOYMENT_BLOCK env var to set specific block)`);
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
        
        // Step 2: Filter for December schedules
        console.log("=".repeat(80));
        console.log(`STEP 2: Filtering for December schedules (startTime == ${DECEMBER_START_TIME})...`);
        console.log("=".repeat(80));
        
        const decemberSchedules: DecemberScheduleData[] = [];
        const blockCache = new Map<number, number>();
        let processedStep2 = 0;
        const step2StartTime = Date.now();
        
        // First pass: collect all unique block numbers for December schedules
        const uniqueBlockNumbers = new Set<number>();
        for (const event of allScheduleEvents) {
            if (!("args" in event)) continue;
            const args = event.args as any[];
            const startTime = Number(args[3]);
            if (startTime === DECEMBER_START_TIME) {
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
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            return { block: null, success: false };
        }
        
        // Batch fetch all unique blocks
        const blockNumbersArray = Array.from(uniqueBlockNumbers);
        for (let i = 0; i < blockNumbersArray.length; i += BLOCK_BATCH_SIZE) {
            const batch = blockNumbersArray.slice(i, i + BLOCK_BATCH_SIZE);
            
            try {
                const blockResults = await Promise.all(
                    batch.map(blockNum => fetchBlockWithRetry(blockNum))
                );
                
                blockResults.forEach((result, idx) => {
                    if (result.success && result.block) {
                        blockCache.set(batch[idx], result.block.timestamp);
                    }
                });
                
                if (i + BLOCK_BATCH_SIZE < blockNumbersArray.length) {
                    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
                }
                
                if ((i + BLOCK_BATCH_SIZE) % 500 === 0 || i + BLOCK_BATCH_SIZE >= blockNumbersArray.length) {
                    const progress = Math.min(100, ((i + BLOCK_BATCH_SIZE) / blockNumbersArray.length * 100)).toFixed(1);
                    const cached = blockCache.size;
                    console.log(`   📊 Progress: ${progress}% (${Math.min(i + BLOCK_BATCH_SIZE, blockNumbersArray.length)}/${blockNumbersArray.length} blocks) - ${cached} cached`);
                }
            } catch (error: any) {
                console.error(`   ❌ Error processing batch ${Math.floor(i / BLOCK_BATCH_SIZE) + 1}: ${error.message}`);
            }
        }
        
        console.log(`✅ Cached ${blockCache.size} block timestamps\n`);
        console.log(`🔄 Processing December schedules...`);
        
        // Second pass: filter and process December schedules
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
            
            if (startTime !== DECEMBER_START_TIME) {
                continue;
            }
            
            processedStep2++;
            const blockTimestamp = blockCache.get(event.blockNumber) || 0;
            
            const schedule: DecemberScheduleData = {
                scheduleId,
                beneficiary,
                totalAmount,
                startTime,
                cliffDuration,
                duration,
                allocationId,
                createdAt: blockTimestamp,
            };
            
            decemberSchedules.push(schedule);
            
            if (processedStep2 % 10000 === 0) {
                const elapsed = ((Date.now() - step2StartTime) / 1000).toFixed(1);
                console.log(`   📊 Processed ${processedStep2} December schedules - ${elapsed}s elapsed`);
            }
        }
        
        const step2Elapsed = ((Date.now() - step2StartTime) / 1000).toFixed(1);
        console.log(`✅ Found ${decemberSchedules.length} December vesting schedules (${step2Elapsed}s elapsed)\n`);
        
        // Step 2.5: Query TokensReleased events to find actual claims
        console.log("=".repeat(80));
        console.log("STEP 2.5: Querying TokensReleased events to find actual claims...");
        console.log("=".repeat(80));
        
        const claimEvents: EventLog[] = [];
        const claimStartTime = Date.now();
        const claimTotalChunks = Math.ceil((currentBlock - fromBlock) / CHUNK_SIZE);
        console.log(`📦 Querying TokensReleased events in chunks of ${CHUNK_SIZE} blocks (${claimTotalChunks.toLocaleString()} total chunks)\n`);
        
        for (let i = 0; i < claimTotalChunks; i++) {
            const chunkFrom = fromBlock + (i * CHUNK_SIZE);
            const chunkTo = Math.min(chunkFrom + CHUNK_SIZE - 1, currentBlock);
            
            try {
                const chunkEvents = await contract.queryFilter("TokensReleased", chunkFrom, chunkTo);
                claimEvents.push(...(chunkEvents as EventLog[]));
                
                if (chunkEvents.length > 0) {
                    console.log(`   ✅ Chunk ${i + 1}/${claimTotalChunks} (blocks ${chunkFrom}-${chunkTo}) - Found ${chunkEvents.length} claims`);
                }
                
                if ((i + 1) % 500 === 0 || i === claimTotalChunks - 1) {
                    const elapsed = ((Date.now() - claimStartTime) / 1000).toFixed(1);
                    const progress = (((i + 1) / claimTotalChunks) * 100).toFixed(1);
                    console.log(`   📊 Progress: ${progress}% (${i + 1}/${claimTotalChunks} chunks) - ${claimEvents.length} total claims - ${elapsed}s elapsed`);
                }
            } catch (error: any) {
                console.error(`❌ Error querying claim chunk ${i + 1}:`, error.message);
            }
        }
        
        console.log(`\n✅ Found ${claimEvents.length} TokensReleased events\n`);
        
        // Map schedule IDs to December schedules for quick lookup
        const decemberScheduleMap = new Map<string, DecemberScheduleData>();
        for (const schedule of decemberSchedules) {
            decemberScheduleMap.set(schedule.scheduleId, schedule);
        }
        
        // Filter claim events to only December schedules
        const decemberClaimEvents: Array<{ event: EventLog; schedule: DecemberScheduleData }> = [];
        for (const event of claimEvents) {
            if (!("args" in event)) continue;
            const args = event.args as any[];
            const scheduleId = args[0].toString(); // scheduleId is first indexed parameter
            const schedule = decemberScheduleMap.get(scheduleId);
            if (schedule) {
                decemberClaimEvents.push({ event, schedule });
            }
        }
        
        console.log(`✅ Found ${decemberClaimEvents.length} claims from December schedules\n`);
        
        // Step 3: Fetch schedule data and check balances for wallets that actually claimed
        console.log("=".repeat(80));
        console.log("STEP 3: Fetching schedule data and checking token balances...");
        console.log("=".repeat(80));
        
        const RETRY_DELAY = 1000;
        
        console.log(`⚙️  Configuration:`);
        console.log(`   - Concurrent requests: ${CONCURRENT_REQUESTS}`);
        console.log(`   - Max retries per request: ${MAX_RETRIES}`);
        console.log(`   - Balance batch size: ${BALANCE_BATCH_SIZE}`);
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
        
        // Step 3: Fetch schedule data and check balances for wallets that actually claimed
        console.log("=".repeat(80));
        console.log("STEP 3: Fetching schedule data and checking token balances...");
        console.log("=".repeat(80));
        
        const step3StartTime = Date.now();
        
        // Get unique wallet addresses from claim events
        const uniqueWallets = new Map<string, Array<{ event: EventLog; schedule: DecemberScheduleData }>>();
        for (const item of decemberClaimEvents) {
            const wallet = item.schedule.beneficiary.toLowerCase();
            if (!uniqueWallets.has(wallet)) {
                uniqueWallets.set(wallet, []);
            }
            uniqueWallets.get(wallet)!.push(item);
        }
        
        console.log(`📦 Processing ${decemberClaimEvents.length} claims from ${uniqueWallets.size} unique wallets...\n`);
        
        // Step 3a: Batch check balances first
        const walletAddresses = Array.from(uniqueWallets.keys());
        const balanceMap = new Map<string, bigint>();
        
        console.log(`🔄 Step 3a: Checking token balances for ${walletAddresses.length} unique wallets...`);
        
        for (let i = 0; i < walletAddresses.length; i += BALANCE_BATCH_SIZE) {
            const batch = walletAddresses.slice(i, i + BALANCE_BATCH_SIZE);
            
            const balancePromises = batch.map(async (wallet) => {
                try {
                    const balance = await retryWithBackoff(
                        () => tokenContract.balanceOf(wallet)
                    ) as bigint;
                    return { wallet, balance };
                } catch (error: any) {
                    return { wallet, balance: BigInt(0) };
                }
            });
            
            const balanceResults = await Promise.all(balancePromises);
            balanceResults.forEach(({ wallet, balance }) => {
                balanceMap.set(wallet, balance);
            });
            
            if ((i + BALANCE_BATCH_SIZE) % 500 === 0 || i + BALANCE_BATCH_SIZE >= walletAddresses.length) {
                const progress = Math.min(100, ((i + BALANCE_BATCH_SIZE) / walletAddresses.length * 100)).toFixed(1);
                const elapsed = ((Date.now() - step3StartTime) / 1000).toFixed(1);
                console.log(`   📊 Balance check: ${progress}% (${Math.min(i + BALANCE_BATCH_SIZE, walletAddresses.length)}/${walletAddresses.length} wallets) - ${elapsed}s elapsed`);
            }
        }
        
        console.log(`✅ Completed balance checks\n`);
        
        // Step 3b: Fetch schedule data and combine with balances
        console.log(`🔄 Step 3b: Fetching schedule data and combining with balances...`);
        
        // Separate arrays for wallets with balance and without balance
        const claimedWalletsWithBalance: DecemberClaimedWalletData[] = [];
        const claimedWalletsNoBalance: DecemberClaimedWalletData[] = [];
        
        // Process each claim event
        let processed = 0;
        for (let i = 0; i < decemberClaimEvents.length; i += CONCURRENT_REQUESTS) {
            const batch = decemberClaimEvents.slice(i, i + CONCURRENT_REQUESTS);
            
            const batchPromises = batch.map(async (item) => {
                try {
                    const scheduleData = await retryWithBackoff(
                        () => (contract as any).getVestingSchedule(item.schedule.scheduleId)
                    ) as any;
                    
                    const wallet = item.schedule.beneficiary.toLowerCase();
                    const balance = balanceMap.get(wallet) || BigInt(0);
                    const currentBalance = parseFloat(ethers.formatEther(balance));
                    
                    const totalAmount = parseFloat(ethers.formatEther(scheduleData.totalAmount));
                    const releasedAmount = parseFloat(ethers.formatEther(scheduleData.releasedAmount));
                    const claimedAmount = releasedAmount;
                    const transferredAmount = Math.max(0, claimedAmount - currentBalance);
                    
                    const walletData: DecemberClaimedWalletData = {
                        wallet: item.schedule.beneficiary,
                        scheduleId: item.schedule.scheduleId,
                        totalAmount: ethers.formatEther(scheduleData.totalAmount),
                        releasedAmount: ethers.formatEther(scheduleData.releasedAmount),
                        claimedAmount: claimedAmount.toFixed(18),
                        currentBalance: currentBalance.toFixed(18),
                        transferredAmount: transferredAmount.toFixed(18),
                        revoked: scheduleData.revoked,
                        startTime: Number(scheduleData.startTime),
                        cliffEndTime: Number(scheduleData.startTime) + Number(scheduleData.cliffDuration),
                        vestingEndTime: Number(scheduleData.startTime) + Number(scheduleData.duration),
                    };
                    
                    return walletData;
                } catch (error: any) {
                    return null;
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            const validResults = batchResults.filter((result): result is DecemberClaimedWalletData => result !== null);
            
            // Separate wallets with balance from those without
            for (const walletData of validResults) {
                const balance = parseFloat(walletData.currentBalance);
                if (balance > 0) {
                    claimedWalletsWithBalance.push(walletData);
                } else {
                    claimedWalletsNoBalance.push(walletData);
                }
            }
            
            processed += batch.length;
            
            if (processed % 1000 === 0 || processed === decemberClaimEvents.length) {
                const elapsed = ((Date.now() - step3StartTime) / 1000).toFixed(1);
                const progress = ((processed / decemberClaimEvents.length) * 100).toFixed(1);
                console.log(`   📊 Processing ${processed}/${decemberClaimEvents.length} (${progress}%) - Found ${claimedWalletsWithBalance.length} with balance, ${claimedWalletsNoBalance.length} without balance - ${elapsed}s elapsed`);
            }
        }
        
        const step3Elapsed = ((Date.now() - step3StartTime) / 1000).toFixed(1);
        console.log(`✅ Processed ${decemberClaimEvents.length} claims in ${step3Elapsed}s`);
        console.log(`✅ Found ${claimedWalletsWithBalance.length} wallets that have claimed and still hold tokens`);
        console.log(`✅ Found ${claimedWalletsNoBalance.length} wallets that have claimed but no longer hold tokens\n`);
        
        console.log(`\n✅ Processed ${decemberSchedules.length} December schedules`);
        console.log(`✅ Found ${claimedWalletsWithBalance.length} wallets that have claimed and still hold tokens`);
        console.log(`✅ Found ${claimedWalletsNoBalance.length} wallets that have claimed but no longer hold tokens\n`);
        
        // Step 4: Generate summary and save results
        console.log("=".repeat(80));
        console.log("📊 SUMMARY");
        console.log("=".repeat(80));
        
        // Calculate stats for wallets with balance
        const totalClaimedWithBalance = claimedWalletsWithBalance.reduce((sum, w) => sum + parseFloat(w.claimedAmount), 0);
        const totalCurrentBalances = claimedWalletsWithBalance.reduce((sum, w) => sum + parseFloat(w.currentBalance), 0);
        const totalTransferredWithBalance = claimedWalletsWithBalance.reduce((sum, w) => sum + parseFloat(w.transferredAmount), 0);
        
        // Calculate stats for wallets without balance
        const totalClaimedNoBalance = claimedWalletsNoBalance.reduce((sum, w) => sum + parseFloat(w.claimedAmount), 0);
        const totalTransferredNoBalance = claimedWalletsNoBalance.reduce((sum, w) => sum + parseFloat(w.claimedAmount), 0); // All claimed tokens were transferred
        
        // Overall totals
        const totalClaimed = totalClaimedWithBalance + totalClaimedNoBalance;
        const totalTransferred = totalTransferredWithBalance + totalTransferredNoBalance;
        
        console.log(`\n📊 Wallets Still Holding Tokens:`);
        console.log(`   Count: ${claimedWalletsWithBalance.length}`);
        console.log(`   Total Claimed: ${totalClaimedWithBalance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 18
        })} TTN`);
        console.log(`   Total Current Balances: ${totalCurrentBalances.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 18
        })} TTN`);
        console.log(`   Total Transferred/Moved: ${totalTransferredWithBalance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 18
        })} TTN`);
        
        console.log(`\n📊 Wallets No Longer Holding Tokens:`);
        console.log(`   Count: ${claimedWalletsNoBalance.length}`);
        console.log(`   Total Claimed: ${totalClaimedNoBalance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 18
        })} TTN`);
        console.log(`   Total Transferred/Moved: ${totalClaimedNoBalance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 18
        })} TTN (all tokens moved)`);
        
        console.log(`\n📊 Overall Totals:`);
        console.log(`   Total Claimed Wallets: ${claimedWalletsWithBalance.length + claimedWalletsNoBalance.length}`);
        console.log(`   Total Claimed Tokens: ${totalClaimed.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 18
        })} TTN`);
        console.log(`   Total Transferred/Moved: ${totalTransferred.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 18
        })} TTN\n`);
        
        // Ensure output directory exists
        const outputDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Save to file
        const output = {
            queryDate: new Date().toISOString(),
            contractAddress: VESTING_MANAGER_ADDRESS,
            tokenAddress: TOKEN_ADDRESS,
            decemberStartTime: DECEMBER_START_TIME,
            fromBlock,
            toBlock: currentBlock,
            totalDecemberSchedules: decemberSchedules.length,
            totalClaimedWallets: claimedWalletsWithBalance.length + claimedWalletsNoBalance.length,
            totalClaimedTokens: totalClaimed.toFixed(18),
            totalTransferredTokens: totalTransferred.toFixed(18),
            walletsWithBalance: {
                count: claimedWalletsWithBalance.length,
                totalClaimedTokens: totalClaimedWithBalance.toFixed(18),
                totalCurrentBalances: totalCurrentBalances.toFixed(18),
                totalTransferredTokens: totalTransferredWithBalance.toFixed(18),
                wallets: claimedWalletsWithBalance,
            },
            walletsNoBalance: {
                count: claimedWalletsNoBalance.length,
                totalClaimedTokens: totalClaimedNoBalance.toFixed(18),
                totalTransferredTokens: totalClaimedNoBalance.toFixed(18),
                wallets: claimedWalletsNoBalance,
            },
        };
        
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        
        console.log("=".repeat(80));
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

