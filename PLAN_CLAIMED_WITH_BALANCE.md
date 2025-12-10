# Plan: Query November Claimed Wallets with Token Balances

## Overview
This plan outlines the steps to find wallets that have **claimed** tokens from November vesting schedules and **still have tokens** in their wallet (haven't moved/transferred them).

## Goal
Find all wallets that:
1. Have November vesting schedules (startTime == 1764460800)
2. Have claimed tokens (releasedAmount > 0)
3. Still have tokens in their wallet (token balance > 0)

## Implementation Steps

### Step 1: Query November Schedules with Claims
**File**: `scripts/query-november-claimed-with-balance.ts`

**Functionality**:
1. Connect to Base mainnet via Hardhat
2. Query all `VestingScheduleCreated` events for November schedules (startTime == 1764460800)
3. For each November schedule:
   - Get current vesting info using `getVestingSchedule(scheduleId)`
   - Check if `releasedAmount > 0` (has claimed tokens)
   - If claimed, fetch the wallet's token balance using ERC20 `balanceOf()`
   - Only include wallets where `balance > 0`
4. Aggregate results by wallet address
5. Save to JSON file: `scripts/data/november-claimed-with-balance.json`

**Output JSON Structure**:
```json
{
  "queryDate": "2024-XX-XXT...",
  "contractAddress": "0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51",
  "tokenAddress": "0x...",
  "novemberStartTime": 1764460800,
  "totalClaimedWallets": 1234,
  "totalClaimedTokens": "123456.78",
  "totalCurrentBalances": "98765.43",
  "wallets": [
    {
      "wallet": "0x...",
      "scheduleId": "123",
      "totalAmount": "1000.00",
      "releasedAmount": "500.00",
      "claimedAmount": "500.00",
      "currentBalance": "450.00",
      "transferredAmount": "50.00",
      "revoked": false,
      "startTime": 1764460800,
      "cliffEndTime": 1764460800,
      "vestingEndTime": 1764460801
    }
  ]
}
```

### Step 2: Create CSV Conversion Script
**File**: `scripts/convertNovemberClaimedToCsv.ts`

**Functionality**:
1. Read the JSON file from Step 1
2. Convert to CSV format with columns:
   - Wallet Address
   - Schedule ID
   - Total Amount (TTN)
   - Released/Claimed Amount (TTN)
   - Current Balance (TTN)
   - Transferred Amount (TTN) - calculated as claimedAmount - currentBalance
   - Revoked
   - Start Time
   - Cliff End Time
   - Vesting End Time
3. Save to: `scripts/data/november-claimed-with-balance.csv`

## Technical Details

### Token Contract
- Need to identify the TTN token contract address on Base mainnet
- Use standard ERC20 `balanceOf(address)` function to check balances
- Token has 18 decimals

### Vesting Manager Contract
- Address: `0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51`
- Network: Base Mainnet (Chain ID: 8453)
- November Start Time: `1764460800` (Nov 30, 2025 00:00 UTC)

### Performance Considerations
- Use concurrent requests for balance checks (similar to unclaimed query)
- Add retry logic for failed requests
- Cache schedule data to avoid duplicate queries
- Batch balance checks to optimize RPC calls

## Environment Variables

```bash
# Required
VESTING_MANAGER_ADDRESS=0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51
TTN_TOKEN_ADDRESS=0x...  # Token contract address on Base

# Optional
DEPLOYMENT_BLOCK=37267565  # Starting block for event queries
OUTPUT_FILE=scripts/data/november-claimed-with-balance.json
CONCURRENT_REQUESTS=50  # Parallel balance checks
MAX_RETRIES=3  # Retry attempts for failed requests
```

## Usage

### Step 1: Query Claimed Wallets with Balances
```bash
npx hardhat run scripts/query-november-claimed-with-balance.ts --network base
```

### Step 2: Convert to CSV
```bash
npx ts-node scripts/convertNovemberClaimedToCsv.ts
```

## Output Files

### JSON Output (`november-claimed-with-balance.json`)
Contains detailed information about each wallet that has claimed and still holds tokens:
- Wallet address
- Schedule ID
- Total, released, and current balance amounts
- Transferred amount (if any)
- Timestamps and revocation status

### CSV Output (`november-claimed-with-balance.csv`)
Spreadsheet-friendly format with all relevant columns for analysis.

