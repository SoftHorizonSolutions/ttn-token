import { ethers } from "hardhat";
import { EventLog } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Script to query TokensReleased events from the VestingManager contract
 * 
 * Usage: 
 *   npx hardhat run scripts/query-claim-history.ts --network base
 * 
 * Environment variables:
 *   VESTING_MANAGER_ADDRESS - Contract address (default: 0x70ca23c7f2b72ddF40e909b72ab9b43a9b5eef51)
 *   DEPLOYMENT_BLOCK - Starting block number (optional, defaults to last 500k blocks)
 */

const VESTING_MANAGER_ADDRESS_RAW = process.env.VESTING_MANAGER_ADDRESS || "0x70ca23c7f2b72ddF40e909b72ab9b43a9b5eef51";
const CHUNK_SIZE = 1000; // RPC limit for most providers

async function main() {
    console.log("🚀 Starting claim history query...\n");
    
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
        
        // Create contract instance using the contract factory
        console.log(`📄 Contract address: ${VESTING_MANAGER_ADDRESS}`);
        const VestingManager = await ethers.getContractFactory("VestingManager");
        const contract = VestingManager.attach(VESTING_MANAGER_ADDRESS);
        
        // Verify contract has code
        const contractCode = await provider.getCode(VESTING_MANAGER_ADDRESS);
        if (contractCode === "0x") {
            console.error(`❌ CRITICAL: No contract code found at address ${VESTING_MANAGER_ADDRESS}`);
            console.error(`   This means the contract doesn't exist at this address!`);
            process.exit(1);
        }
        console.log(`✅ Contract code verified\n`);
        
        // Verify event exists in ABI
        const contractInterface = contract.interface;
        let eventFragment;
        try {
            eventFragment = contractInterface.getEvent("TokensReleased");
            if (!eventFragment) {
                console.error(`❌ Event fragment not found`);
                process.exit(1);
            }
            console.log(`📋 Event fragment found: Yes`);
            console.log(`📋 Event signature: ${eventFragment.format()}\n`);
        } catch (e) {
            console.error(`❌ Error getting event fragment:`, e);
            process.exit(1);
        }
        
        // Determine starting block
        const deploymentBlock = process.env.DEPLOYMENT_BLOCK ? parseInt(process.env.DEPLOYMENT_BLOCK) : null;
        const fromBlock = deploymentBlock || Math.max(0, currentBlock - 500000); // Default: last 500k blocks
        
        if (deploymentBlock) {
            console.log(`📅 Using deployment block from env: ${deploymentBlock}`);
        } else {
            console.log(`📅 Starting from last 500k blocks (use DEPLOYMENT_BLOCK env var to change)`);
        }
        
        console.log(`🔍 Querying TokensReleased events from block ${fromBlock} to block ${currentBlock}...`);
        console.log(`📦 Querying in chunks of ${CHUNK_SIZE} blocks (RPC limit)`);
        const totalChunks = Math.ceil((currentBlock - fromBlock) / CHUNK_SIZE);
        console.log(`📊 Total chunks to process: ${totalChunks.toLocaleString()}`);
        console.log(`⏳ This may take a while...\n`);
        
        const startTime = Date.now();
        const allEvents = [];
        
        // Query in chunks
        for (let i = 0; i < totalChunks; i++) {
            const chunkFrom = fromBlock + (i * CHUNK_SIZE);
            const chunkTo = Math.min(chunkFrom + CHUNK_SIZE - 1, currentBlock);
            
            try {
                const chunkEvents = await contract.queryFilter("TokensReleased", chunkFrom, chunkTo);
                allEvents.push(...chunkEvents);
                
                if (chunkEvents.length > 0) {
                    console.log(`   ✅ Chunk ${i + 1}/${totalChunks} (blocks ${chunkFrom}-${chunkTo}) - Found ${chunkEvents.length} events!`);
                }
                
                if ((i + 1) % 500 === 0 || i === totalChunks - 1) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const progress = (((i + 1) / totalChunks) * 100).toFixed(1);
                    console.log(`   📊 Progress: ${progress}% (${i + 1}/${totalChunks} chunks) - ${allEvents.length} total events found - ${elapsed}s elapsed`);
                }
            } catch (error: any) {
                console.error(`❌ Error querying chunk ${i + 1} (blocks ${chunkFrom}-${chunkTo}):`, error.message);
                // Continue with next chunk
            }
        }
        
        const queryTime = Date.now() - startTime;
        console.log(`\n⏱️ Query completed in ${(queryTime / 1000).toFixed(1)}s`);
        console.log(`✅ Found ${allEvents.length} TokensReleased events\n`);
        
        if (allEvents.length === 0) {
            console.warn("⚠️ No events found. This could mean:");
            console.warn("  1. No claims have been made yet");
            console.warn("  2. The contract address is incorrect");
            console.warn("  3. The query range is too narrow");
            console.warn("  4. The event name doesn't match the ABI");
            process.exit(0);
        }
        
        // Process events
        console.log("📝 Processing events...\n");
        const claimRecords: any[] = [];
        const userClaimsMap = new Map<string, { beneficiary: string; totalClaimed: string; claimCount: number }>();
        
        for (let i = 0; i < allEvents.length; i++) {
            const event = allEvents[i];
            try {
                // Type guard: check if event is EventLog (has args property)
                if (!("args" in event)) {
                    console.warn(`⚠️ Event ${i} is not an EventLog, skipping`);
                    continue;
                }

                const eventLog = event as EventLog;
                const args = eventLog.args as any[];
                const block = await provider.getBlock(eventLog.blockNumber);
                
                const scheduleId = args[0].toString();
                const beneficiary = args[1].toString();
                const amount = ethers.formatEther(args[2]);
                
                // Get transaction hash - EventLog has transactionHash property
                const txHash = eventLog.transactionHash || "";
                
                const record = {
                    scheduleId,
                    beneficiary,
                    amount,
                    blockNumber: eventLog.blockNumber,
                    transactionHash: txHash,
                    timestamp: Number(block?.timestamp || 0),
                    date: new Date(Number(block?.timestamp || 0) * 1000).toLocaleString(),
                };
                
                claimRecords.push(record);
                
                // Aggregate by user
                const existing = userClaimsMap.get(beneficiary);
                if (existing) {
                    existing.totalClaimed = (parseFloat(existing.totalClaimed) + parseFloat(amount)).toFixed(6);
                    existing.claimCount += 1;
                } else {
                    userClaimsMap.set(beneficiary, {
                        beneficiary,
                        totalClaimed: amount,
                        claimCount: 1,
                    });
                }
                
                if ((i + 1) % 10 === 0) {
                    console.log(`   Processed ${i + 1}/${allEvents.length} events...`);
                }
            } catch (error: any) {
                console.error(`❌ Error processing event ${i}:`, error.message);
            }
        }
        
        console.log(`\n✅ Processed ${claimRecords.length} claim records\n`);
        
        // Display summary
        console.log("=".repeat(80));
        console.log("📊 SUMMARY");
        console.log("=".repeat(80));
        console.log(`Total Claims: ${claimRecords.length}`);
        console.log(`Total Users: ${userClaimsMap.size}`);
        
        const totalTokensClaimed = Array.from(userClaimsMap.values()).reduce(
            (sum, user) => sum + parseFloat(user.totalClaimed),
            0
        );
        console.log(`Total Tokens Claimed: ${totalTokensClaimed.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} TTN\n`);
        
        // Display top 10 users
        const topUsers = Array.from(userClaimsMap.values())
            .sort((a, b) => parseFloat(b.totalClaimed) - parseFloat(a.totalClaimed))
            .slice(0, 10);
        
        console.log("🏆 Top 10 Users by Total Claimed:");
        console.log("-".repeat(80));
        topUsers.forEach((user, index) => {
            console.log(
                `${(index + 1).toString().padStart(2)}. ${user.beneficiary.slice(0, 10)}...${user.beneficiary.slice(-8)} | ` +
                `${parseFloat(user.totalClaimed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TTN | ` +
                `${user.claimCount} claim(s)`
            );
        });
        
        console.log("\n" + "=".repeat(80));
        console.log("✅ Query completed successfully!");
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

