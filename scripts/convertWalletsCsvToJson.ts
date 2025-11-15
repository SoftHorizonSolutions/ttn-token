import * as fs from 'fs';
import * as path from 'path';

interface WalletRecord {
  address: string;
  amount: string;
  label: string;
}

interface WalletData {
  totalAddresses: number;
  totalAllocation: string;
  description: string;
  records: WalletRecord[];
}

async function convertWalletsCsvToJson() {
  try {
    const csvPath = path.join(__dirname, '../script/data/Toyow Foundation - Airdrop Final Wallets - Wallets.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found:', csvPath);
      process.exit(1);
    }

    console.log('📄 Reading CSV file...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    console.log('🔍 Processing addresses...');
    
    const records: WalletRecord[] = [];
    let totalAllocation = BigInt(0);
    // Calculate amount per address to get exactly 200,000 total tokens
    const totalTokens = 200000;
    const hardcodedAmount = totalTokens / lines.length; // Equal distribution
    
    // Convert to WEI (same conversion as previous script)
    // Multiply by 100 first to preserve 2 decimal places, then by 10^16
    const amountWithCents = Math.floor(hardcodedAmount * 100);
    let amountInWei = BigInt(amountWithCents) * BigInt(10 ** 16);
    
    // Adjust to get exactly 200,000 tokens total
    const targetTotalWei = BigInt(200000) * BigInt(10 ** 18);
    const remainder = targetTotalWei % BigInt(lines.length);
    amountInWei = (targetTotalWei - remainder) / BigInt(lines.length);
    
    // Calculate the exact total we'll get with this amount
    const exactTotal = Number(amountInWei) * lines.length / 1e18;
    console.log(`💰 Exact total with this amount: ${exactTotal.toFixed(2)} tokens`);
    
    console.log(`💰 Hardcoded amount per address: ${hardcodedAmount} tokens`);
    console.log(`💰 Amount in WEI: ${amountInWei.toString()}`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Extract address (assuming it's in the first column)
      const columns = line.split(',');
      const address = columns[0]?.trim();
      
      if (address && address.startsWith('0x') && address.length === 42) {
        records.push({
          address: address,
          amount: amountInWei.toString(),
          label: `Wallet_${i + 1}`
        });
        
        totalAllocation += amountInWei;
      }
    }

    console.log(`✅ Processed ${records.length} addresses`);
    console.log(`💰 Total allocation: ${(Number(totalAllocation) / 1e18).toFixed(4)} tokens`);

    // Create JSON data
    const walletData: WalletData = {
      totalAddresses: records.length,
      totalAllocation: totalAllocation.toString(),
      description: `Hardcoded amount of ${hardcodedAmount} tokens per address`,
      records: records
    };

    // Save to JSON file
    const outputPath = path.join(__dirname, '../script/data/wallets-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(walletData, null, 2), 'utf-8');

    console.log('\n✅ JSON file created successfully!');
    console.log('📄 Output file:', outputPath);
    console.log('📊 Total addresses:', records.length);
    console.log('💰 Amount per address:', hardcodedAmount, 'tokens');
    console.log('💰 Total allocation:', (Number(totalAllocation) / 1e18).toFixed(4), 'tokens');

  } catch (error) {
    console.error('❌ Error converting CSV to JSON:', error);
    process.exit(1);
  }
}

// Run the conversion
convertWalletsCsvToJson();
