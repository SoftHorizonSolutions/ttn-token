// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNTokenVault.sol";
import "../contracts/TTNToken.sol";

contract InteractVaultScript is Script {
    // Contract addresses from deployment
    address constant VAULT_PROXY = 0xE72dCAeA94829025391ace9cff3053c06731f46b;
    address constant TOKEN_PROXY = 0x794110602aCab007732EDA2F3AEe7DcE78bD6256;
    
    TokenVault public vault;
    TTNToken public token;
    
    function setUp() public {
        vault = TokenVault(VAULT_PROXY);
        token = TTNToken(TOKEN_PROXY);
    }
    
    function run() external {
        
        console.log("=== TokenVault Interaction Script ===");
        console.log("Vault Address:", VAULT_PROXY);
        console.log("Token Address:", TOKEN_PROXY);
        console.log("");
        
        vm.startBroadcast();
        
        // 2. Create some test allocations
        address[] memory beneficiaries = new address[](3);
        beneficiaries[0] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Test address 1
        beneficiaries[1] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // Test address 2
        beneficiaries[2] = 0x90F79bf6EB2c4f870365E785982E1f101E93b906; // Test address 3
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1000 * 10**18; // 1000 tokens
        amounts[1] = 2000 * 10**18; // 2000 tokens
        amounts[2] = 1500 * 10**18; // 1500 tokens
        
        console.log("=== Creating Allocations ===");
        for (uint i = 0; i < beneficiaries.length; i++) {
            uint256 allocationId = vault.createAllocation(beneficiaries[i], amounts[i]);
            console.log("Created allocation", allocationId);
        }
        
        // 3. Execute an airdrop
        console.log("=== Executing Airdrop ===");
        address[] memory airdropBeneficiaries = new address[](2);
        airdropBeneficiaries[0] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        airdropBeneficiaries[1] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        
        uint256[] memory airdropAmounts = new uint256[](2);
        airdropAmounts[0] = 500 * 10**18; // 500 tokens
        airdropAmounts[1] = 750 * 10**18; // 750 tokens
        
        vault.executeAirdrop(airdropBeneficiaries, airdropAmounts);
        console.log("Airdrop executed successfully");
        
        // 4. Get allocation details
        console.log("=== Allocation Details ===");
        for (uint i = 1; i <= 3; i++) {
            (uint256 amount, address beneficiary, bool revoked) = vault.getAllocationById(i);
            console.log("Allocation", i, "Amount:", amount);
            console.log("Beneficiary:", beneficiary);
            console.log("Revoked:", revoked);
        }
        
        // 5. Get beneficiary allocations
        console.log("=== Beneficiary Allocations ===");
        address testBeneficiary = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        uint256[] memory beneficiaryAllocs = vault.getAllocationsForBeneficiary(testBeneficiary);
        console.log("Allocations for beneficiary:", beneficiaryAllocs.length);
        
        // 6. Check token balances
        console.log("=== Token Balances ===");
        for (uint i = 0; i < beneficiaries.length; i++) {
            uint256 balance = token.balanceOf(beneficiaries[i]);
            console.log("Balance of beneficiary", i, ":", balance);
        }
        
        vm.stopBroadcast();
        
        console.log("=== Script Completed Successfully ===");
    }
} 