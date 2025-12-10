# November Unclaimed Wallets Query

Quick reference guide for querying November unclaimed wallets and converting to CSV.

## Prerequisites

1. Node.js and npm installed
2. Hardhat configured with Base mainnet RPC URL
3. `.env` file with `BASE_RPC_URL` (or use default in hardhat.config.ts)

## Quick Start

### Step 1: Query November Unclaimed Wallets

```bash
npx hardhat run scripts/query-november-unclaimed.ts --network base
```

This will:
- Query all vesting schedules from the contract
- Filter for November schedules (startTime = 1764460800)
- Check which ones have unclaimed tokens
- Save results to `scripts/data/november-unclaimed-wallets.json`

### Step 2: Convert to CSV

```bash
npx ts-node scripts/convertNovemberUnclaimedToCsv.ts
```

This will:
- Read the JSON file from Step 1
- Convert to CSV format
- Save to `scripts/data/november-unclaimed-wallets.csv`

## Environment Variables

Optional environment variables:

```bash
# Contract address (default: 0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51)
export VESTING_MANAGER_ADDRESS=0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51

# Starting block for event queries (default: last 500k blocks)
export DEPLOYMENT_BLOCK=12345678

# Custom output file path (default: scripts/data/november-unclaimed-wallets.json)
export OUTPUT_FILE=path/to/custom-output.json
```

## Output Files

### JSON Output (`november-unclaimed-wallets.json`)
Contains detailed information about each unclaimed wallet:
- Wallet address
- Schedule ID
- Total, released, unclaimed, and claimable amounts
- Timestamps and revocation status

### CSV Output (`november-unclaimed-wallets.csv`)
Spreadsheet-friendly format with columns:
- Wallet Address
- Schedule ID
- Total Amount (TTN)
- Released Amount (TTN)
- Unclaimed Amount (TTN)
- Claimable Amount (TTN)
- Revoked status
- Start Time, Cliff End Time, Vesting End Time

## Troubleshooting

### "No contract code found"
- Verify the contract address is correct
- Check you're connected to Base mainnet (chain ID 8453)

### "JSON file not found"
- Run the query script first before converting to CSV
- Check the file path in the error message

### RPC Rate Limits
- The script queries events in chunks to avoid rate limits
- If you encounter rate limit errors, add delays between chunks or use a premium RPC provider

## Notes

- November schedules are identified by `startTime == 1764460800` (Nov 30, 2025 00:00 UTC)
- Only schedules with `releasedAmount < totalAmount` are included
- Results are sorted by unclaimed amount (descending)

