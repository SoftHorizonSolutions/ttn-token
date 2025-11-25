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
 * 
 * Behavior:
 *   - If output JSON already exists, new records will be merged/appended
 *   - Duplicate addresses will have their amounts combined
 *   - All records are saved to the same JSON file
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
  
  console.log(`✅ Parsed ${records.length} valid addresses from CSV`);
  if (skippedCount > 0) {
    console.log(`⏭️  Skipped ${skippedCount} invalid rows (missing address or amount)`);
  }
  
  // Check if output JSON file already exists and load existing records
  let existingRecords: ClaimingRecord[] = [];
  let existingTotalAllocation = BigInt(0);
  
  if (fs.existsSync(jsonOutputPath)) {
    try {
      const existingContent = fs.readFileSync(jsonOutputPath, 'utf-8');
      const existingData = JSON.parse(existingContent);
      existingRecords = existingData.records || [];
      existingTotalAllocation = BigInt(existingData.totalAllocation || '0');
      console.log(`📂 Found existing JSON with ${existingRecords.length} addresses`);
      console.log(`   Existing total: ${(Number(existingTotalAllocation) / 1e18).toLocaleString()} tokens`);
    } catch (error) {
      console.warn(`⚠️  Could not read existing JSON file, starting fresh: ${error}`);
    }
  }
  
  // Merge new records with existing records
  // If same address exists, merge amounts (add them together)
  const addressMap = new Map<string, ClaimingRecord>();
  
  // Add existing records to map
  for (const record of existingRecords) {
    const address = record.address.toLowerCase();
    if (addressMap.has(address)) {
      // Merge amounts if address already exists
      const existing = addressMap.get(address)!;
      const existingAmount = BigInt(existing.amount);
      const newAmount = BigInt(record.amount);
      existing.amount = (existingAmount + newAmount).toString();
      // Keep the first label or combine them
      if (record.label && existing.label !== record.label) {
        existing.label = `${existing.label} | ${record.label}`;
      }
    } else {
      addressMap.set(address, { ...record });
    }
  }
  
  // Add new records to map (merge if address exists, otherwise add new)
  for (const record of records) {
    const address = record.address.toLowerCase();
    if (addressMap.has(address)) {
      // Merge amounts for existing address
      const existing = addressMap.get(address)!;
      const existingAmount = BigInt(existing.amount);
      const newAmount = BigInt(record.amount);
      existing.amount = (existingAmount + newAmount).toString();
      // Update label if different
      if (record.label && existing.label !== record.label) {
        existing.label = `${existing.label} | ${record.label}`;
      }
      console.log(`   ⚠️  Merged duplicate address: ${record.address} (amounts combined)`);
    } else {
      addressMap.set(address, { ...record });
    }
  }
  
  // Convert map back to array
  const mergedRecords = Array.from(addressMap.values());
  
  // Calculate new totals
  const newRecordsAllocation = records.reduce((sum, r) => sum + BigInt(r.amount), BigInt(0));
  const totalAllocation = existingTotalAllocation + newRecordsAllocation;
  const totalInTokens = Number(totalAllocation) / 1e18;
  const newRecordsTokens = Number(newRecordsAllocation) / 1e18;
  
  console.log(`\n📊 New records: ${newRecordsTokens.toLocaleString()} tokens`);
  console.log(`📊 Total (merged): ${totalInTokens.toLocaleString()} tokens`);
  console.log(`💰 Total in WEI: ${totalAllocation.toString()}`);
  
  // Write merged JSON
  const output = {
    totalAddresses: mergedRecords.length,
    totalAllocation: totalAllocation.toString(),
    description: "Addresses eligible for claiming on November 30, 2024 12:00:00 UTC+1",
    records: mergedRecords
  };
  
  // Ensure output directory exists
  const outputDir = path.dirname(jsonOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(jsonOutputPath, JSON.stringify(output, null, 2));
  console.log(`✅ JSON written to: ${jsonOutputPath}`);
  
  // Final summary - highlight total addresses
  console.log('\n' + '='.repeat(60));
  console.log(`📊 TOTAL ADDRESSES IN JSON: ${mergedRecords.length.toLocaleString()}`);
  console.log('='.repeat(60));
  
  // Validation summary
  console.log('\n📋 Validation Summary:');
  console.log(`   New addresses from CSV: ${records.length}`);
  console.log(`   Total addresses (merged): ${mergedRecords.length}`);
  console.log(`   Total allocation: ${totalAllocation.toString()} wei`);
  console.log(`   Total tokens: ${totalInTokens.toLocaleString()}`);
  console.log(`   Average per address: ${(totalInTokens / mergedRecords.length).toFixed(2)} tokens`);
  
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

