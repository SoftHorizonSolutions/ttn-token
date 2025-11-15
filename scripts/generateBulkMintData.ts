import * as fs from 'fs';
import * as path from 'path';

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

async function generateBulkMintData() {
  try {
    // Read the vesting data
    const vestingDataPath = path.join(__dirname, '../script/data/vesting-data.json');
    
    if (!fs.existsSync(vestingDataPath)) {
      console.error('❌ Vesting data not found. Run convertCsvToJson.ts first!');
      process.exit(1);
    }

    const vestingData: VestingData = JSON.parse(
      fs.readFileSync(vestingDataPath, 'utf-8')
    );

    console.log(`📊 Processing ${vestingData.records.length} addresses...`);

    // Generate Solidity arrays
    const addresses: string[] = [];
    const amounts: string[] = [];
    const labels: string[] = [];

    vestingData.records.forEach((record, index) => {
      addresses.push(record.address);
      amounts.push(record.amount);
      labels.push(record.label || `Address_${index + 1}`);
    });

    // Create the Solidity code
    const solidityCode = `// Bulk Mint Data for ${vestingData.records.length} addresses
// Generated: ${new Date().toISOString()}
// Total Amount: ${(BigInt(vestingData.totalAllocation) / BigInt(10**16)) / BigInt(100)} tokens

// Copy this into your contract or script:

address[] memory beneficiaries = new address[](${addresses.length});
uint256[] memory amounts = new uint256[](${amounts.length});

${addresses.map((addr, i) => `beneficiaries[${i}] = ${addr};`).join('\n')}

${amounts.map((amount, i) => `amounts[${i}] = ${amount};`).join('\n')}

// Execute the airdrop
uint256 airdropId = tokenVault.executeAirdrop(beneficiaries, amounts);

// Alternative: One-liner format (for smaller datasets)
address[] memory beneficiaries = [${addresses.join(', ')}];
uint256[] memory amounts = [${amounts.join(', ')}];
uint256 airdropId = tokenVault.executeAirdrop(beneficiaries, amounts);
`;

    // Create detailed mapping
    const mappingCode = `// Address to Label Mapping (for reference)
${vestingData.records.map((record, i) => 
  `// ${record.address} -> ${record.label || `Address_${i+1}`} (${(BigInt(record.amount) / BigInt(10**16)) / BigInt(100)} tokens)`
).join('\n')}
`;

    // Save to files
    const outputDir = path.join(__dirname, '../script/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save Solidity code
    const solidityPath = path.join(outputDir, 'bulk-mint-solidity.txt');
    fs.writeFileSync(solidityPath, solidityCode, 'utf-8');

    // Save mapping
    const mappingPath = path.join(outputDir, 'address-mapping.txt');
    fs.writeFileSync(mappingPath, mappingCode, 'utf-8');

    // Create a simple array format for easy copy-paste
    const simpleFormat = `// Simple Copy-Paste Format
// Addresses (${addresses.length} total):
${addresses.map((addr, i) => `"${addr}"`).join(',\n')}

// Amounts (${amounts.length} total):
${amounts.map((amount, i) => `"${amount}"`).join(',\n')}

// Labels (${labels.length} total):
${labels.map((label, i) => `"${label}"`).join(',\n')}
`;

    const simplePath = path.join(outputDir, 'simple-arrays.txt');
    fs.writeFileSync(simplePath, simpleFormat, 'utf-8');

    console.log('\n✅ Bulk mint data generated!');
    console.log('📄 Files created:');
    console.log(`   - ${solidityPath}`);
    console.log(`   - ${mappingPath}`);
    console.log(`   - ${simplePath}`);
    
    console.log('\n📊 Summary:');
    console.log(`   - Total addresses: ${addresses.length}`);
    console.log(`   - Total amount: ${(BigInt(vestingData.totalAllocation) / BigInt(10**16)) / BigInt(100)} tokens`);
    console.log(`   - Total WEI: ${vestingData.totalAllocation}`);
    
    console.log('\n🚀 Usage:');
    console.log('1. Open the generated files');
    console.log('2. Copy the Solidity code');
    console.log('3. Paste into your contract/script');
    console.log('4. Call: tokenVault.executeAirdrop(beneficiaries, amounts)');

  } catch (error) {
    console.error('❌ Error generating bulk mint data:', error);
    process.exit(1);
  }
}

// Run the generation
generateBulkMintData();
