# Plan: Query November Unclaimed Wallets

## ✅ Implementation Status: COMPLETED

Both scripts have been implemented and are ready to use!

## Overview
This plan outlines the steps to query and export unclaimed wallets and TTN balances for November vesting schedules from the VestingManager contract deployed on Base mainnet.

## Contract Details
- **Contract Address**: `0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51`
- **Network**: Base Mainnet (Chain ID: 8453)
- **November Start Time**: `1764460800` (Nov 30, 2025 00:00 UTC)

## Implementation Steps

### Step 1: Create Query Script for November Unclaimed Wallets
**File**: `scripts/query-november-unclaimed.ts`

**Functionality**:
1. Connect to Base mainnet via Hardhat
2. Query all `VestingScheduleCreated` events from the contract
3. Filter schedules where `startTime == 1764460800` (November schedules)
4. For each November schedule:
   - Get current vesting info using `getVestingInfo(scheduleId)`
   - Check if `releasedAmount < totalAmount` (has unclaimed tokens)
   - Calculate unclaimed amount: `totalAmount - releasedAmount`
5. Aggregate results by wallet address
6. Save to JSON file: `scripts/data/november-unclaimed-wallets.json`

**Output JSON Structure**:
```json
{
  "queryDate": "2024-XX-XXT...",
  "contractAddress": "0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51",
  "novemberStartTime": 1764460800,
  "totalWallets": 1234,
  "totalUnclaimedTokens": "123456.78",
  "wallets": [
    {
      "wallet": "0x...",
      "scheduleId": "123",
      "totalAmount": "1000.00",
      "releasedAmount": "0.00",
      "unclaimedAmount": "1000.00",
      "claimableAmount": "1000.00"
    }
  ]
}
```

### Step 2: Create CSV Conversion Script
**File**: `scripts/convertNovemberUnclaimedToCsv.ts`

**Functionality**:
1. Read the JSON file from Step 1
2. Convert to CSV format with columns:
   - Wallet Address
   - Schedule ID
   - Total Amount (TTN)
   - Released Amount (TTN)
   - Unclaimed Amount (TTN)
   - Claimable Amount (TTN)
3. Save to: `scripts/data/november-unclaimed-wallets.csv`

**CSV Format**:
```csv
Wallet Address,Schedule ID,Total Amount (TTN),Released Amount (TTN),Unclaimed Amount (TTN),Claimable Amount (TTN)
0x1234...,123,1000.00,0.00,1000.00,1000.00
0x5678...,124,500.00,250.00,250.00,250.00
```

## Usage

### Step 1: Query November Unclaimed Wallets
```bash
# Set environment variables (optional, defaults are provided)
export VESTING_MANAGER_ADDRESS=0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51
export BASE_RPC_URL=<your-base-mainnet-rpc-url>
export DEPLOYMENT_BLOCK=<optional-starting-block>

# Run the query script
npx hardhat run scripts/query-november-unclaimed.ts --network base
```

**Output**: `scripts/data/november-unclaimed-wallets.json`

### Step 2: Convert to CSV
```bash
# Using default paths (reads from scripts/data/november-unclaimed-wallets.json)
npx ts-node scripts/convertNovemberUnclaimedToCsv.ts

# Or with custom paths
INPUT_FILE=path/to/input.json OUTPUT_FILE=path/to/output.csv npx ts-node scripts/convertNovemberUnclaimedToCsv.ts
```

**Output**: `scripts/data/november-unclaimed-wallets.csv`

### Quick Start (All-in-One)
```bash
# 1. Query November unclaimed wallets
npx hardhat run scripts/query-november-unclaimed.ts --network base

# 2. Convert to CSV
npx ts-node scripts/convertNovemberUnclaimedToCsv.ts
```

## Technical Details

### Key Functions from VestingManager Contract:
- `getVestingSchedule(uint256 scheduleId)` - Returns schedule details including `startTime`
- `getVestingInfo(uint256 scheduleId)` - Returns:
  - `totalAmount`
  - `releasedAmount`
  - `releasableAmount`
  - `remainingAmount`

### Filtering Logic:
- November schedules: `startTime == 1764460800`
- Unclaimed condition: `releasedAmount < totalAmount`
- Unclaimed amount: `totalAmount - releasedAmount`

### Performance Considerations:
- Query events in chunks (1000 blocks per chunk) to avoid RPC limits
- Use parallel processing for fetching vesting info
- Cache results to avoid redundant queries

## Files to Create

1. `scripts/query-november-unclaimed.ts` - Main query script
2. `scripts/convertNovemberUnclaimedToCsv.ts` - CSV conversion script
3. `scripts/data/november-unclaimed-wallets.json` - Output JSON (gitignored)
4. `scripts/data/november-unclaimed-wallets.csv` - Output CSV (gitignored)

## Dependencies
- `ethers` (from hardhat)
- `fs` (Node.js built-in)
- `path` (Node.js built-in)
- `dotenv` (for environment variables)

## Error Handling
- Handle RPC rate limits with retries
- Handle missing contract code
- Handle invalid schedule IDs
- Log errors but continue processing other schedules

## Expected Output
- JSON file with all November unclaimed wallets
- CSV file for easy analysis in Excel/Google Sheets
- Console summary with:
  - Total wallets with November schedules
  - Total unclaimed tokens
  - Top 10 wallets by unclaimed amount

