import * as fs from 'fs';
import * as path from 'path';

/**
 * Converts November unclaimed wallets JSON to CSV format
 * 
 * Usage:
 *   npx ts-node scripts/convertNovemberUnclaimedToCsv.ts
 * 
 * Or with custom input/output paths:
 *   INPUT_FILE=path/to/input.json OUTPUT_FILE=path/to/output.csv npx ts-node scripts/convertNovemberUnclaimedToCsv.ts
 */

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
    wallets: NovemberWalletData[];
}

function escapeCsvField(field: string): string {
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
}

function convertNovemberUnclaimedToCsv() {
    try {
        // Default paths
        const defaultInputFile = path.join(__dirname, 'data/november-unclaimed-wallets.json');
        const defaultOutputFile = path.join(__dirname, 'data/november-unclaimed-wallets.csv');
        
        const inputFile = process.env.INPUT_FILE || defaultInputFile;
        const outputFile = process.env.OUTPUT_FILE || defaultOutputFile;
        
        console.log('📄 Reading JSON file...');
        console.log('   Input:', inputFile);
        
        if (!fs.existsSync(inputFile)) {
            console.error('❌ JSON file not found at:', inputFile);
            console.error('   Please run the query script first:');
            console.error('   npx hardhat run scripts/query-november-unclaimed.ts --network base');
            process.exit(1);
        }

        const jsonData: NovemberUnclaimedData = JSON.parse(
            fs.readFileSync(inputFile, 'utf-8')
        );

        console.log(`✅ Loaded ${jsonData.wallets.length} unclaimed wallets`);
        console.log(`📊 Total unclaimed tokens: ${parseFloat(jsonData.totalUnclaimedTokens).toLocaleString()} TTN`);
        console.log(`💰 Total claimable tokens: ${parseFloat(jsonData.totalClaimableTokens).toLocaleString()} TTN\n`);

        // Prepare CSV data
        const csvRows: string[] = [];
        
        // Add header row
        csvRows.push([
            'Wallet Address',
            'Schedule ID',
            'Total Amount (TTN)',
            'Released Amount (TTN)',
            'Unclaimed Amount (TTN)',
            'Claimable Amount (TTN)',
            'Revoked',
            'Start Time',
            'Cliff End Time',
            'Vesting End Time'
        ].join(','));

        // Process each wallet
        jsonData.wallets.forEach((wallet) => {
            const startTimeDate = new Date(wallet.startTime * 1000).toISOString();
            const cliffEndTimeDate = new Date(wallet.cliffEndTime * 1000).toISOString();
            const vestingEndTimeDate = new Date(wallet.vestingEndTime * 1000).toISOString();

            csvRows.push([
                escapeCsvField(wallet.wallet),
                escapeCsvField(wallet.scheduleId),
                parseFloat(wallet.totalAmount).toFixed(18),
                parseFloat(wallet.releasedAmount).toFixed(18),
                parseFloat(wallet.unclaimedAmount).toFixed(18),
                parseFloat(wallet.claimableAmount).toFixed(18),
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
        console.log('📊 Total records:', jsonData.wallets.length);
        console.log('\n📋 CSV Columns:');
        console.log('   - Wallet Address');
        console.log('   - Schedule ID');
        console.log('   - Total Amount (TTN)');
        console.log('   - Released Amount (TTN)');
        console.log('   - Unclaimed Amount (TTN)');
        console.log('   - Claimable Amount (TTN)');
        console.log('   - Revoked');
        console.log('   - Start Time');
        console.log('   - Cliff End Time');
        console.log('   - Vesting End Time');

    } catch (error: any) {
        console.error('❌ Error converting November unclaimed data to CSV:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run the conversion
convertNovemberUnclaimedToCsv();

