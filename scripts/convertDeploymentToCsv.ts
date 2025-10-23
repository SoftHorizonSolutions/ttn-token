import * as fs from 'fs';
import * as path from 'path';

interface Transaction {
  hash: string;
  function: string;
  arguments: string[];
}

interface DeploymentLog {
  transactions: Transaction[];
  chain: number;
  timestamp: number;
}

interface VestingRecord {
  address: string;
  amount: string;
  label?: string;
}

interface VestingData {
  totalAddresses: number;
  totalAllocation: string;
  records: VestingRecord[];
}

async function convertDeploymentToCsv() {
  try {
    // Read the deployment log
    const deploymentLogPath = path.join(
      __dirname,
      '../broadcast/DeployTGEFromJSON.s.sol/84532/run-latest.json'
    );
    
    if (!fs.existsSync(deploymentLogPath)) {
      console.error('❌ Deployment log not found at:', deploymentLogPath);
      process.exit(1);
    }

    const deploymentLog: DeploymentLog = JSON.parse(
      fs.readFileSync(deploymentLogPath, 'utf-8')
    );

    // Read the original vesting data to get labels
    const vestingDataPath = path.join(__dirname, '../script/data/vesting-data.json');
    let vestingData: VestingData | null = null;
    
    if (fs.existsSync(vestingDataPath)) {
      vestingData = JSON.parse(fs.readFileSync(vestingDataPath, 'utf-8'));
    }

    // Create a map of addresses to labels
    const addressToLabel = new Map<string, string>();
    if (vestingData) {
      vestingData.records.forEach(record => {
        addressToLabel.set(record.address.toLowerCase(), record.label || '');
      });
    }

    // Filter transactions that are createVestingSchedule calls
    const vestingTransactions = deploymentLog.transactions.filter(
      tx => tx.function && tx.function.includes('createVestingSchedule')
    );

    console.log(`📊 Found ${vestingTransactions.length} vesting schedule transactions`);

    // Prepare CSV data
    const csvRows: string[] = [];
    
    // Add header
    csvRows.push('Transaction Hash,Beneficiary Address,Label,Amount (WEI),Amount (Tokens),Unlock Time,Cliff Duration,Duration,Allocation ID,Block Timestamp');

    // Process each transaction
    vestingTransactions.forEach((tx, index) => {
      const [
        beneficiary,
        totalAmount,
        unlockTime,
        cliffDuration,
        duration,
        allocationId
      ] = tx.arguments;

      // Convert amount from WEI to tokens (divide by 10^18)
      const amountInTokens = (BigInt(totalAmount) / BigInt(10 ** 16)) / BigInt(100);
      const amountDecimals = Number(BigInt(totalAmount) % BigInt(10 ** 18)) / (10 ** 18);
      const formattedAmount = Number(amountInTokens) + amountDecimals;

      // Get label for this address
      const label = addressToLabel.get(beneficiary.toLowerCase()) || '';

      // Format unlock time as readable date
      const unlockDate = new Date(Number(unlockTime) * 1000).toISOString();

      csvRows.push([
        tx.hash,
        beneficiary,
        `"${label}"`, // Quote the label in case it contains commas
        totalAmount,
        formattedAmount.toFixed(2),
        unlockDate,
        cliffDuration,
        duration,
        allocationId,
        new Date(deploymentLog.timestamp * 1000).toISOString()
      ].join(','));
    });

    // Write CSV file
    const outputPath = path.join(__dirname, '../script/data/deployment-results.csv');
    fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');

    console.log('\n✅ CSV file created successfully!');
    console.log('📄 Output file:', outputPath);
    console.log('📊 Total records:', vestingTransactions.length);
    
    // Calculate total amount
    const totalAmount = vestingTransactions.reduce((sum, tx) => {
      return sum + BigInt(tx.arguments[1]);
    }, BigInt(0));
    
    const totalTokens = Number(totalAmount / BigInt(10 ** 16)) / 100;
    console.log('💰 Total amount allocated:', totalTokens.toLocaleString(), 'tokens');
    console.log('🔗 Chain ID:', deploymentLog.chain);
    console.log('⏰ Deployment timestamp:', new Date(deploymentLog.timestamp * 1000).toLocaleString());

  } catch (error) {
    console.error('❌ Error converting deployment to CSV:', error);
    process.exit(1);
  }
}

// Run the conversion
convertDeploymentToCsv();

