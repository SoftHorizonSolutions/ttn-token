// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNVestingManager.sol";
import "../contracts/TTNToken.sol";
import "../contracts/TTNTokenVault.sol";

contract InteractVestingScript is Script {
    // Contract addresses from deployment
    address constant VESTING_PROXY = 0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f;
    address constant TOKEN_PROXY = 0x794110602aCab007732EDA2F3AEe7DcE78bD6256;
    address constant VAULT_PROXY = 0xE72dCAeA94829025391ace9cff3053c06731f46b;
    
    VestingManager public vesting;
    TTNToken public token;
    TokenVault public vault;
    
    function setUp() public {
        vesting = VestingManager(VESTING_PROXY);
        token = TTNToken(TOKEN_PROXY);
        vault = TokenVault(VAULT_PROXY);
    }
    
    function run() external {
        
        console.log("=== VestingManager Interaction Script ===");
        console.log("Vesting Address:", VESTING_PROXY);
        console.log("Token Address:", TOKEN_PROXY);
        console.log("Vault Address:", VAULT_PROXY);
        console.log("");
        
        vm.startBroadcast();
        
        // 2. Create vesting schedules
        console.log("=== Creating Vesting Schedules ===");
        
        address[] memory beneficiaries = new address[](3);
        beneficiaries[0] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Test address 1
        beneficiaries[1] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // Test address 2
        beneficiaries[2] = 0x90F79bf6EB2c4f870365E785982E1f101E93b906; // Test address 3
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1000 * 10**18; // 1000 tokens (matches allocation 1)
        amounts[1] = 2000 * 10**18; // 2000 tokens (matches allocation 2)
        amounts[2] = 1500 * 10**18; // 1500 tokens (matches allocation 3)
        
        uint256[] memory startTimes = new uint256[](3);
        startTimes[0] = block.timestamp + 300; // Start in 5 minutes
        startTimes[1] = block.timestamp + 86400; // Start in 1 day
        startTimes[2] = block.timestamp + 172800; // Start in 2 days
        
        uint256[] memory cliffDurations = new uint256[](3);
        cliffDurations[0] = 30 days; // 30 day cliff
        cliffDurations[1] = 60 days; // 60 day cliff
        cliffDurations[2] = 90 days; // 90 day cliff
        
        uint256[] memory durations = new uint256[](3);
        durations[0] = 365 days; // 1 year vesting
        durations[1] = 730 days; // 2 year vesting
        durations[2] = 1095 days; // 3 year vesting
        
        uint256[] memory allocationIds = new uint256[](3);
        allocationIds[0] = 1; // Use allocation ID 1
        allocationIds[1] = 2; // Use allocation ID 2
        allocationIds[2] = 3; // Use allocation ID 3
        
        for (uint i = 0; i < beneficiaries.length; i++) {
            uint256 scheduleId = vesting.createVestingSchedule(
                beneficiaries[i],
                amounts[i],
                startTimes[i],
                cliffDurations[i],
                durations[i],
                allocationIds[i]
            );
            console.log("Created vesting schedule", scheduleId);
        }
        
        // 3. Get vesting schedule details
        console.log("=== Vesting Schedule Details ===");
        for (uint i = 1; i <= 3; i++) {
            VestingManager.VestingSchedule memory schedule = vesting.getVestingSchedule(i);
            console.log("Schedule", i, "Total Amount:", schedule.totalAmount);
        }
        
        
    
        
        // 6. Get beneficiary schedules
        console.log("=== Beneficiary Schedules ===");
        address testBeneficiary = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        uint256[] memory beneficiarySchedules = vesting.getSchedulesForBeneficiary(testBeneficiary);
        console.log("Schedules for beneficiary:", beneficiarySchedules.length);
        
        // 7. Check total vested and claimed tokens
        console.log("=== Vesting Statistics ===");
        uint256 totalVested = vesting.getVestedToken();
        uint256 totalClaimed = vesting.getClaimedTokens();
        console.log("Total Vested Tokens:", totalVested);
        console.log("Total Claimed Tokens:", totalClaimed);
        
        vm.stopBroadcast();
        
        console.log("=== Script Completed Successfully ===");
    }
} 