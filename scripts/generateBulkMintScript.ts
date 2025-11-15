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

async function generateBulkMintScript() {
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

    console.log(`📊 Generating Foundry script for ${vestingData.records.length} addresses...`);

    // Generate the Solidity script
    const solidityScript = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";

interface ITTNTokenVault {
    function executeAirdrop(
        address[] calldata beneficiaries,
        uint256[] calldata amounts
    ) external returns (uint256);
}

contract BulkMintTGE is Script {
    
    function run() external {
        // Update this with your deployed TokenVault address
        address tokenVaultAddress = 0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f;
        
        console.log("=== Bulk TGE Minting ===");
        console.log("TokenVault:", tokenVaultAddress);
        console.log("Total addresses:", ${vestingData.records.length});
        
        // All ${vestingData.records.length} addresses and amounts
        address[] memory beneficiaries = new address[](${vestingData.records.length});
        uint256[] memory amounts = new uint256[](${vestingData.records.length});
        
        ${vestingData.records.map((record, i) => 
          `beneficiaries[${i}] = ${record.address};`
        ).join('\n        ')}
        
        ${vestingData.records.map((record, i) => 
          `amounts[${i}] = ${record.amount};`
        ).join('\n        ')}
        
        console.log("Total amount:", _calculateTotal(amounts));
        
        vm.startBroadcast();
        
        // Execute bulk airdrop
        ITTNTokenVault tokenVault = ITTNTokenVault(tokenVaultAddress);
        uint256 airdropId = tokenVault.executeAirdrop(beneficiaries, amounts);
        
        vm.stopBroadcast();
        
        console.log("✅ Airdrop executed!");
        console.log("Airdrop ID:", airdropId);
        console.log("Recipients:", beneficiaries.length);
        console.log("Total tokens:", _calculateTotal(amounts) / 1e18);
    }
    
    function _calculateTotal(uint256[] memory amounts) internal pure returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        return total;
    }
}`;

    // Save the script
    const scriptPath = path.join(__dirname, '../script/BulkMintTGE.s.sol');
    fs.writeFileSync(scriptPath, solidityScript, 'utf-8');

    console.log('\n✅ Foundry script generated!');
    console.log('📄 File:', scriptPath);
    
    console.log('\n🚀 Usage:');
    console.log('1. Update the tokenVaultAddress in the script');
    console.log('2. Run the script:');
    console.log('   forge script script/BulkMintTGE.s.sol:BulkMintTGE \\');
    console.log('     --rpc-url https://sepolia.base.org \\');
    console.log('     --private-key $PRIVATE_KEY \\');
    console.log('     --broadcast');
    
    console.log('\n📊 Summary:');
    console.log(`   - Addresses: ${vestingData.records.length}`);
    console.log(`   - Total amount: ${(BigInt(vestingData.totalAllocation) / BigInt(10**16)) / BigInt(100)} tokens`);
    console.log(`   - Gas estimate: High (${vestingData.records.length} transactions in one call)`);

  } catch (error) {
    console.error('❌ Error generating script:', error);
    process.exit(1);
  }
}

// Run the generation
generateBulkMintScript();
