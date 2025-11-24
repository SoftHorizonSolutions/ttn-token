import * as fs from 'fs';
import * as path from 'path';

/**
 * Converts CSV to JSON format for bulk allocation and vesting creation
 * 
 * Expected CSV format:
 * - Column 0: Address (required)
 * - Column 1: Amount in tokens (required, will be converted to wei)
 * - Column 2: Label (optional)
 * 
 * Or with header row:
 * - address,amount,label
 * 
 * Usage:
 *   npx ts-node scripts/convertClaimingCsvToJson.ts [input.csv] [output.json]
 * 
 * Defaults:
 *   input: scripts/bulk-claiming/data/claiming-addresses.csv
 *   output: scripts/bulk-claiming/data/claiming-addresses.json
 */

interface ClaimingRecord {
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

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function convertCsvToJson(): void {
  // Get command line arguments
  const args = process.argv.slice(2);
  const csvPath = args[0] || path.join(__dirname, 'data/claiming-addresses.csv');
  const jsonOutputPath = args[1] || path.join(__dirname, 'data/claiming-addresses.json');
  
  console.log('📄 Reading CSV file:', csvPath);
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    console.error('\nPlease provide a CSV file with the following format:');
    console.error('  address,amount,label');
    console.error('  0x1234...,1000.5,Label 1');
    console.error('  0xabcd...,2000,Label 2');
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) {
    console.error('❌ CSV file is empty');
    process.exit(1);
  }
  
  const records: ClaimingRecord[] = [];
  let skippedCount = 0;
  let startIndex = 0;
  
  // Check if first line is a header (contains common address/amount column names)
  const firstLine = lines[0].toLowerCase();
  const addressKeywords = ['address', 'wallet', 'beneficiary', 'eth_address', 'ethereum_address'];
  const amountKeywords = ['amount', 'token', 'allocation', 'value', 'quantity', 'tokens'];
  const hasAddressColumn = addressKeywords.some(keyword => firstLine.includes(keyword));
  const hasAmountColumn = amountKeywords.some(keyword => firstLine.includes(keyword));
  
  if (hasAddressColumn || hasAmountColumn) {
    console.log('📋 Detected header row, skipping...');
    console.log(`   Header: ${lines[0]}`);
    startIndex = 1;
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    const columns = parseCSVLine(line);
    
    // Try to auto-detect column positions
    // Format 1: address,amount,label (standard)
    // Format 2: UserName,address,Task Points,amount,... (TaskOn format)
    // Format 3: Ranking,address,Point,amount,... (Galxe format)
    let address = '';
    let amountStr = '';
    let label = '';
    
    // Check if this looks like the TaskOn format (has "UserName" in header or address in column 1)
    const isTaskOnFormat = firstLine.includes('username') || firstLine.includes('task points');
    // Check if this looks like the Galxe format (has "Ranking" in header and "Point" in header)
    const isGalxeFormat = firstLine.includes('ranking') && firstLine.includes('point');
    
    if (isGalxeFormat && startIndex === 1) {
      // Galxe format: Ranking,address,Point,amount,...
      address = columns[1] || '';  // Column 1 = address
      amountStr = columns[3] || ''; // Column 3 = amount
      label = `Ranking ${columns[0] || ''}`; // Column 0 = Ranking (as label)
    } else if (isTaskOnFormat && startIndex === 1) {
      // TaskOn format: UserName,address,Task Points,amount,...
      address = columns[1] || '';  // Column 1 = address
      amountStr = columns[3] || ''; // Column 3 = amount
      label = columns[0] || '';    // Column 0 = UserName (as label)
    } else {
      // Standard format: address,amount,label
      address = columns[0] || '';
      amountStr = columns[1] || '';
      label = columns[2] || columns[3] || '';
    }
    
    // Skip if address is missing or empty
    if (!address || address.trim() === '') {
      console.warn(`⚠️  Skipping row ${i + 1}: Missing address`);
      skippedCount++;
      continue;
    }
    
    // Skip if amount is missing or empty
    if (!amountStr || amountStr.trim() === '') {
      console.warn(`⚠️  Skipping row ${i + 1}: Missing amount (address: ${address})`);
      skippedCount++;
      continue;
    }
    
    // Validate address format
    if (!isValidAddress(address)) {
      console.warn(`⚠️  Skipping row ${i + 1}: Invalid address format "${address}"`);
      skippedCount++;
      continue;
    }
    
    // Parse and validate amount
    const amount = parseNumber(amountStr);
    if (amount <= 0 || isNaN(amount)) {
      console.warn(`⚠️  Skipping row ${i + 1}: Invalid amount "${amountStr}" (address: ${address})`);
      skippedCount++;
      continue;
    }
    
    // Convert amount to WEI (multiply by 10^18)
    // Use string-based conversion to avoid floating point precision issues
    const amountStrClean = amountStr.replace(/["',\s]/g, '');
    const parts = amountStrClean.split('.');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1] || '';
    
    // Pad decimal part to 18 digits and truncate if longer
    const decimalPadded = decimalPart.padEnd(18, '0').substring(0, 18);
    
    // Combine integer and decimal parts
    const amountInWei = BigInt(integerPart) * BigInt(10 ** 18) + BigInt(decimalPadded);
    
    records.push({
      address: address.trim(),
      amount: amountInWei.toString(),
      label: label || `Address ${records.length + 1}`
    });
  }
  
  console.log(`✅ Parsed ${records.length} valid addresses`);
  if (skippedCount > 0) {
    console.log(`⏭️  Skipped ${skippedCount} invalid rows (missing address or amount)`);
  }
  
  // Calculate total
  const totalAllocation = records.reduce((sum, r) => sum + BigInt(r.amount), BigInt(0));
  const totalInTokens = Number(totalAllocation) / 1e18;
  console.log(`📊 Total Allocation: ${totalInTokens.toLocaleString()} tokens`);
  console.log(`💰 Total in WEI: ${totalAllocation.toString()}`);
  
  // Write JSON
  const output = {
    totalAddresses: records.length,
    totalAllocation: totalAllocation.toString(),
    description: "Addresses eligible for claiming on November 30, 2024 12:00:00 UTC+1",
    records: records
  };
  
  // Ensure output directory exists
  const outputDir = path.dirname(jsonOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(jsonOutputPath, JSON.stringify(output, null, 2));
  console.log(`✅ JSON written to: ${jsonOutputPath}`);
  
  // Validation summary
  console.log('\n📋 Validation Summary:');
  console.log(`   Total addresses: ${records.length}`);
  console.log(`   Total allocation: ${totalAllocation.toString()} wei`);
  console.log(`   Total tokens: ${totalInTokens.toLocaleString()}`);
  console.log(`   Average per address: ${(totalInTokens / records.length).toFixed(2)} tokens`);
  
  console.log('\n✨ Conversion complete! Ready to run bulk claiming deployment');
  console.log('\nNext steps:');
  console.log('1. Review the generated JSON file');
  console.log('2. Run the Forge script:');
  console.log('   forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \\');
  console.log('     --sig "run(uint256)" 50 --rpc-url <RPC> --private-key <KEY> --broadcast --ffi');
  console.log('\n   See BULK_CLAIMING_GUIDE.md for detailed instructions');
}

// Run
convertCsvToJson();

