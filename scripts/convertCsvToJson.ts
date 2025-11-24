import * as fs from 'fs';
import * as path from 'path';

/**
 * Converts CSV to JSON with amounts in WEI (18 decimals)
 * Simple, clean conversion
 */

interface VestingRecord {
  address: string;
  amount: string; // WEI (18 decimals)
  label: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/["',\s]/g, '');
  return parseFloat(cleaned) || 0;
}

function convertCsvToJson(): void {
  const csvPath = path.join(__dirname, '../script/data/MINT EXECUTION(AIRDROP VESTING - KOLS).csv');
  const jsonOutputPath = path.join(__dirname, '../script/data/vesting-data.json');
  
  console.log('📄 Reading CSV file...');
  console.log('🔍 Filtering for addresses with TGE unlock only...');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
  const records: VestingRecord[] = [];
  let skippedCount = 0;
  
  // Skip header rows (first 2 lines)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = parseCSVLine(line);
    
    const name = columns[0] || '';
    const allocationStr = columns[1] || '0';
    const label = columns[3] || '';
    const walletAddress = columns[5] || '';
    const tgeAmountStr = columns[7] || ''; // TGE AMOUNT column
    
    // Skip if no valid wallet address
    if (!walletAddress || walletAddress.length < 10) continue;
    
    // FILTER: Only include if there's a TGE unlock amount
    const tgeAmount = parseNumber(tgeAmountStr);
    if (tgeAmount === 0) {
      skippedCount++;
      continue;
    }
    
    // Parse allocation amount
    const allocation = parseNumber(allocationStr);
    if (allocation === 0) continue;
    
    // Convert TGE amount to WEI (multiply by 10^18), preserving decimals
    // Multiply by 100 first to preserve 2 decimal places, then by 10^16
    const amountWithCents = Math.floor(tgeAmount * 100);
    const amountInWei = BigInt(amountWithCents) * BigInt(10 ** 16);
    
    records.push({
      address: walletAddress.trim(),
      amount: amountInWei.toString(),
      label: name || label || 'Unknown'
    });
  }
  
  console.log(`✅ Parsed ${records.length} addresses with TGE unlock`);
  console.log(`⏭️  Skipped ${skippedCount} addresses (no TGE unlock)`);
  
  // Calculate total
  const totalAllocation = records.reduce((sum, r) => sum + BigInt(r.amount), BigInt(0));
  const totalInTokens = Number(totalAllocation) / 1e18;
  console.log(`📊 Total TGE Allocation: ${totalInTokens.toLocaleString()} tokens`);
  
  // Write JSON
  const output = {
    totalAddresses: records.length,
    totalAllocation: totalAllocation.toString(),
    description: "TGE unlock amounts only",
    records: records
  };
  
  fs.writeFileSync(jsonOutputPath, JSON.stringify(output, null, 2));
  console.log(`✅ JSON written to: ${jsonOutputPath}`);
  
  
  console.log('\n✨ Conversion complete! Ready to deploy.');
}


// Run
convertCsvToJson();

