# Bulk Claiming Deployment Guide

Complete step-by-step guide for deploying allocations and vesting schedules in batches.

## 📋 Overview

This system processes addresses from a CSV file and creates:
1. **Allocations** in the TokenVault contract
2. **Vesting schedules** in the VestingManager contract

Each address requires **2 on-chain transactions** (allocation + vesting schedule).

---

## 🚀 Step-by-Step Guide

### Step 1: Prepare Your CSV File

Your CSV file should be in the `scripts/bulk-claiming/` directory with the following format:

**Galxe Format (with header):**
```csv
Ranking,address,Point,amount,,$ value,Total Points
1,0xb42e624bd93ae8e02894f98b044eab83aaf0b8e6,2955,197.00,, $29.55 ," 3,337,590 "
2,0xa22f44795bfaf576581eabdaee5cdae8ae6fd5ec,2930,195.33,, $29.30 ,
```

**Standard Format:**
```csv
address,amount,label
0x1234...,1000.5,Label 1
0xabcd...,2000,Label 2
```

---

### Step 2: Convert CSV to JSON

Convert your CSV file to the JSON format required by the script:

```bash
npx ts-node scripts/bulk-claiming/convertClaimingCsvToJson.ts "scripts/bulk-claiming/Airdrop Claim(Galxe).csv"
```

**Output:**
- Creates/updates: `scripts/bulk-claiming/data/claiming-addresses.json`
- Shows validation summary with total addresses and tokens

**Example output:**
```
✅ Parsed 4752 valid addresses
📊 Total Allocation: 222,493.55 tokens
💰 Total in WEI: 222493550000000000000000
✅ JSON written to: scripts/bulk-claiming/data/claiming-addresses.json
```

---

### Step 3: Set Environment Variables

Set the contract addresses (or use `.env` file):

```bash
export VESTING_MANAGER_PROXY="0xYourVestingManagerAddress"
export TOKEN_VAULT_PROXY="0xYourTokenVaultAddress"
```

Or create/update `.env` file:
```bash
VESTING_MANAGER_PROXY=0xYourVestingManagerAddress
TOKEN_VAULT_PROXY=0xYourTokenVaultAddress
```

---

### Step 4: Run the Deployment Script

#### Option A: Auto-Resume (Recommended)

Processes the next batch starting from where you left off:

```bash
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256)" 50 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast \
  --ffi
```

**Parameters:**
- `50` = batch size (number of addresses to process)
- `--broadcast` = sends transactions on-chain (remove for dry-run)
- `--ffi` = enables file I/O for progress tracking

#### Option B: Start from Specific Index

Start from a specific index (useful for testing or resuming from a known point):

```bash
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256,uint256)" 0 50 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast \
  --ffi
```

**Parameters:**
- `0` = start index (first address to process)
- `50` = batch size

---

### Step 5: Monitor Progress

The script automatically:
- ✅ Saves progress after each successful address
- ✅ Logs progress every 10 addresses
- ✅ Shows success/failure counts
- ✅ Displays allocation and schedule IDs

**Progress file location:**
```
scripts/bulk-claiming/data/deployment-progress.json
```

**Check current progress:**
```bash
cat scripts/bulk-claiming/data/deployment-progress.json
```

**Example output:**
```json
{"lastProcessedIndex":248,"timestamp":1764018236}
```
This means addresses 0-248 (249 total) have been processed.

---

### Step 6: Resume After Interruption

If the script stops (network error, gas issues, etc.), simply run the same command again:

```bash
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256)" 50 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast \
  --ffi
```

The script automatically resumes from the last processed index.

---

## 🔄 Common Operations

### Reset Progress (Start from Zero)

**Option 1: Delete progress file**
```bash
rm scripts/bulk-claiming/data/deployment-progress.json
```

**Option 2: Use explicit start index**
```bash
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256,uint256)" 0 50 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast \
  --ffi
```

### Check How Many Addresses Remaining

```bash
# Get total addresses
jq '.totalAddresses' scripts/bulk-claiming/data/claiming-addresses.json

# Get last processed index
jq '.lastProcessedIndex' scripts/bulk-claiming/data/deployment-progress.json

# Calculate remaining (manually subtract)
```

### View Sample Data

```bash
# View first 3 records
jq '.records[0:3]' scripts/bulk-claiming/data/claiming-addresses.json

# View specific record
jq '.records[100]' scripts/bulk-claiming/data/claiming-addresses.json
```

---

## ⚙️ Configuration

### Vesting Schedule Parameters

The script uses these hardcoded values (in `BulkCreateAllocationsAndVestingBatched.s.sol`):

```solidity
uint256 constant CLAIM_START_TIME = 1764370800;  // Nov 29, 2025 00:00:00 UTC+1
cliffDuration = 0;  // No cliff period
duration = 1;       // 1 second (immediate unlock)
```

**To change these:**
1. Edit `CLAIM_START_TIME` constant in the script
2. Modify the `createVestingSchedule` call parameters

### Batch Size

Adjust batch size based on:
- **Gas costs**: Smaller batches = lower risk per run
- **Network reliability**: Smaller batches = easier to resume
- **Time**: Larger batches = faster overall (if network is stable)

**Recommended batch sizes:**
- Testnet: 50-100 addresses
- Mainnet: 20-50 addresses (more conservative)

---

## 🛠️ Troubleshooting

### RPC Timeout Errors

**Problem:** `operation timed out` errors

**Solutions:**

1. **Use a better RPC endpoint** (recommended):
   ```bash
   # Alchemy
   --rpc-url https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
   
   # Infura
   --rpc-url https://base-sepolia.infura.io/v3/YOUR_INFURA_API_KEY
   ```

2. **Increase timeout** (already configured in `foundry.toml`):
   ```toml
   [rpc]
   timeout = 300  # 5 minutes
   ```

3. **Retry the command** - network issues are often temporary

### Transaction Failures

**Problem:** Some addresses fail to process

**What happens:**
- Script saves progress even on failures
- Failed addresses are skipped (won't be retried automatically)
- Success count shows how many worked

**To retry failed addresses:**
1. Note which addresses failed from the logs
2. Use explicit start index to retry specific ranges
3. Or manually process failed addresses

### Check Script Logs

The script logs:
- Each address being processed
- Amount being allocated
- Success/failure status
- Progress updates

**Look for:**
```
Processing index 249
  Address: 0x...
  Amount (wei): 197000000000000000000
```

---

## 📊 Example Workflow

### Complete Example: Processing 1000 Addresses

```bash
# 1. Convert CSV to JSON
npx ts-node scripts/bulk-claiming/convertClaimingCsvToJson.ts "scripts/bulk-claiming/Airdrop Claim(Galxe).csv"

# 2. Set environment variables
export VESTING_MANAGER_PROXY="0xE72dCAeA94829025391ace9cff3053c06731f46b"
export TOKEN_VAULT_PROXY="0xYourVaultAddress"

# 3. Process first batch (50 addresses)
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256)" 50 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast \
  --ffi

# 4. Check progress
cat scripts/bulk-claiming/data/deployment-progress.json
# Output: {"lastProcessedIndex":49,"timestamp":...}

# 5. Continue with next batch (auto-resumes from index 50)
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256)" 50 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast \
  --ffi

# 6. Repeat step 5 until all addresses are processed
# (For 1000 addresses, you'd run this 20 times with batch size 50)
```

---

## 🔍 Verification

### Verify Allocations Created

Check on-chain that allocations were created:
- Use a block explorer
- Query the TokenVault contract
- Check allocation IDs match the logs

### Verify Vesting Schedules Created

Check on-chain that vesting schedules were created:
- Use a block explorer
- Query the VestingManager contract
- Verify schedule IDs match the logs

---

## 📝 Important Notes

1. **Gas Costs**: Each address = 2 transactions (allocation + vesting)
   - Estimate: ~100,000-200,000 gas per address
   - Total for 1000 addresses: ~200M gas

2. **Progress Tracking**: 
   - Progress is saved after each successful address
   - Safe to stop and resume anytime
   - Progress file is in `.gitignore` (won't be committed)

3. **Dry Run First**: 
   - Remove `--broadcast` flag to simulate without sending transactions
   - Test with small batch size first

4. **Network Selection**:
   - Base Sepolia (testnet): `https://sepolia.base.org`
   - Base Mainnet: `https://mainnet.base.org`
   - Or use Alchemy/Infura for better reliability

---

## 🎯 Quick Reference Commands

```bash
# Convert CSV to JSON
npx ts-node scripts/bulk-claiming/convertClaimingCsvToJson.ts "path/to/file.csv"

# Process next 50 addresses (auto-resume)
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256)" 50 --rpc-url <RPC> --private-key <KEY> --broadcast --ffi

# Start from index 0 (reset)
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256,uint256)" 0 50 --rpc-url <RPC> --private-key <KEY> --broadcast --ffi

# Check progress
cat scripts/bulk-claiming/data/deployment-progress.json

# View JSON data
jq '.records[0:3]' scripts/bulk-claiming/data/claiming-addresses.json
```

---

## ✅ Success Checklist

- [ ] CSV file prepared and validated
- [ ] JSON file generated successfully
- [ ] Environment variables set
- [ ] Tested with small batch (dry-run)
- [ ] Progress tracking working
- [ ] All addresses processed
- [ ] Verified on-chain allocations
- [ ] Verified on-chain vesting schedules

---

**Need Help?** Check the script comments or review the contract interfaces for more details.

