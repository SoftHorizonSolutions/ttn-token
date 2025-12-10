import * as fs from 'fs';
import * as path from 'path';

/**
 * Converts November claimed wallets with balance JSON to CSV format
 * 
 * Usage:
 *   npx ts-node scripts/convertNovemberClaimedToCsv.ts
 * 
 * Or with custom input/output paths:
 *   INPUT_FILE=path/to/input.json OUTPUT_FILE=path/to/output.csv npx ts-node scripts/convertNovemberClaimedToCsv.ts
 */

interface NovemberClaimedWalletData {
    wallet: string;
    scheduleId: string;
    totalAmount: string;
    releasedAmount: string;
    claimedAmount: string;
    currentBalance: string;
    transferredAmount: string;
    revoked: boolean;
    startTime: number;
    cliffEndTime: number;
    vestingEndTime: number;
}

interface NovemberClaimedData {
    queryDate: string;
    contractAddress: string;
    tokenAddress: string;
    novemberStartTime: number;
    fromBlock: number;
    toBlock: number;
    totalNovemberSchedules: number;
    totalClaimedWallets: number;
    totalClaimedTokens: string;
    totalTransferredTokens: string;
    walletsWithBalance?: {
        count: number;
        totalClaimedTokens: string;
        totalCurrentBalances: string;
        totalTransferredTokens: string;
        wallets: NovemberClaimedWalletData[];
    };
    walletsNoBalance?: {
        count: number;
        totalClaimedTokens: string;
        totalTransferredTokens: string;
        wallets: NovemberClaimedWalletData[];
    };
    // Legacy format support
    wallets?: NovemberClaimedWalletData[];
    totalCurrentBalances?: string;
}

function escapeCsvField(field: string): string {
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
}

function convertNovemberClaimedToCsv() {
    try {
        // Default paths
        const defaultInputFile = path.join(__dirname, 'data/november-claimed-with-balance.json');
        const defaultOutputFile = path.join(__dirname, 'data/november-claimed-with-balance.csv');
        
        const inputFile = process.env.INPUT_FILE || defaultInputFile;
        const outputFile = process.env.OUTPUT_FILE || defaultOutputFile;
        
        console.log('📄 Reading JSON file...');
        console.log('   Input:', inputFile);
        
        if (!fs.existsSync(inputFile)) {
            console.error('❌ JSON file not found at:', inputFile);
            console.error('   Please run the query script first:');
            console.error('   npx hardhat run scripts/query-november-claimed-with-balance.ts --network base');
            process.exit(1);
        }

        const jsonData: NovemberClaimedData = JSON.parse(
            fs.readFileSync(inputFile, 'utf-8')
        );

        // Collect all wallets from both groups (new format) or single array (legacy format)
        let allWallets: Array<{ wallet: NovemberClaimedWalletData; status: string }> = [];
        
        if (jsonData.walletsWithBalance || jsonData.walletsNoBalance) {
            // New format with separate groups
            const withBalance = jsonData.walletsWithBalance?.wallets || [];
            const noBalance = jsonData.walletsNoBalance?.wallets || [];
            
            allWallets = [
                ...withBalance.map(w => ({ wallet: w, status: 'Still Holding' })),
                ...noBalance.map(w => ({ wallet: w, status: 'No Longer Holding' }))
            ];
            
            console.log(`✅ Loaded ${withBalance.length} wallets still holding tokens`);
            console.log(`✅ Loaded ${noBalance.length} wallets no longer holding tokens`);
            console.log(`📊 Total claimed tokens: ${parseFloat(jsonData.totalClaimedTokens).toLocaleString()} TTN`);
            if (jsonData.walletsWithBalance) {
                console.log(`💰 Total current balances: ${parseFloat(jsonData.walletsWithBalance.totalCurrentBalances).toLocaleString()} TTN`);
            }
            console.log(`📤 Total transferred tokens: ${parseFloat(jsonData.totalTransferredTokens).toLocaleString()} TTN\n`);
        } else if (jsonData.wallets) {
            // Legacy format - all wallets have balance
            allWallets = jsonData.wallets.map(w => ({ wallet: w, status: 'Still Holding' }));
            
            console.log(`✅ Loaded ${jsonData.wallets.length} claimed wallets with balances`);
            console.log(`📊 Total claimed tokens: ${parseFloat(jsonData.totalClaimedTokens).toLocaleString()} TTN`);
            if (jsonData.totalCurrentBalances) {
                console.log(`💰 Total current balances: ${parseFloat(jsonData.totalCurrentBalances).toLocaleString()} TTN`);
            }
            console.log(`📤 Total transferred tokens: ${parseFloat(jsonData.totalTransferredTokens).toLocaleString()} TTN\n`);
        } else {
            throw new Error('Invalid JSON structure: no wallets found');
        }

        // Prepare CSV data
        const csvRows: string[] = [];
        
        // Add header row
        csvRows.push([
            'Status',
            'Wallet Address',
            'Schedule ID',
            'Total Amount (TTN)',
            'Released/Claimed Amount (TTN)',
            'Current Balance (TTN)',
            'Transferred Amount (TTN)',
            'Revoked',
            'Start Time',
            'Cliff End Time',
            'Vesting End Time'
        ].join(','));

        // Process each wallet
        allWallets.forEach(({ wallet, status }) => {
            const startTimeDate = new Date(wallet.startTime * 1000).toISOString();
            const cliffEndTimeDate = new Date(wallet.cliffEndTime * 1000).toISOString();
            const vestingEndTimeDate = new Date(wallet.vestingEndTime * 1000).toISOString();

            csvRows.push([
                escapeCsvField(status),
                escapeCsvField(wallet.wallet),
                escapeCsvField(wallet.scheduleId),
                parseFloat(wallet.totalAmount).toFixed(18),
                parseFloat(wallet.claimedAmount).toFixed(18),
                parseFloat(wallet.currentBalance).toFixed(18),
                parseFloat(wallet.transferredAmount).toFixed(18),
                wallet.revoked ? 'Yes' : 'No',
                startTimeDate,
                cliffEndTimeDate,
                vestingEndTimeDate
            ].join(','));
        });

        // Ensure output directory exists
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write CSV file
        fs.writeFileSync(outputFile, csvRows.join('\n'), 'utf-8');

        console.log('✅ CSV file created successfully!');
        console.log('📄 Output file:', outputFile);
        console.log('📊 Total records:', allWallets.length);
        if (jsonData.walletsWithBalance && jsonData.walletsNoBalance) {
            console.log(`   - ${jsonData.walletsWithBalance.count} wallets still holding tokens`);
            console.log(`   - ${jsonData.walletsNoBalance.count} wallets no longer holding tokens`);
        }
        console.log('\n📋 CSV Columns:');
        console.log('   - Status (Still Holding / No Longer Holding)');
        console.log('   - Wallet Address');
        console.log('   - Schedule ID');
        console.log('   - Total Amount (TTN)');
        console.log('   - Released/Claimed Amount (TTN)');
        console.log('   - Current Balance (TTN)');
        console.log('   - Transferred Amount (TTN)');
        console.log('   - Revoked');
        console.log('   - Start Time');
        console.log('   - Cliff End Time');
        console.log('   - Vesting End Time');

    } catch (error: any) {
        console.error('❌ Error converting November claimed data to CSV:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run the conversion
convertNovemberClaimedToCsv();

