# TGE Vesting Deployment - Complete Guide

**Deploy TGE vesting for 74 addresses with complete tracking.**

---

## 🚀 Quick Start - Complete Workflow

### Step 1: Convert CSV to JSON

```bash
npx ts-node scripts/convertCsvToJson.ts
```

**What this does:**
- Reads `script/data/MINT EXECUTION(...).csv`
- Extracts TGE unlock amounts (column 7)
- Preserves decimals (10333.25, 9666.75, etc.)
- Converts to WEI (blockchain format)
- Saves to `script/data/vesting-data.json`

---

### Step 2: Deploy to Blockchain

```bash
source .env
forge script script/DeployTGEFromJSON.s.sol:DeployTGEFromJSON \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --ffi
```

**What this does:**
- Uses `vm.ffi()` to read `vesting-data.json`
- Creates 74 vesting schedules
- Sets unlock time = hardcoded epoch (12pm UTC)
- Sets allocationId = 0 for all
- Saves all transaction hashes automatically

**⚠️ The `--ffi` flag is required!** It enables file reading.

---

### Step 3: Export Results to CSV

```bash
npx ts-node scripts/convertDeploymentToCsv.ts
```

**What this does:**
- Reads deployment broadcast JSON
- Extracts all transaction hashes
- Matches addresses with labels
- Converts WEI back to tokens
- Creates `script/data/deployment-results.csv`

**CSV contains:**
- Transaction hash for each schedule
- Beneficiary address and label
- Amount in WEI and tokens  
- Unlock time and parameters
- Deployment timestamp

---

## 📋 File Locations

**Input:**
- CSV: `script/data/MINT EXECUTION(AIRDROP VESTING - KOLS).csv`

**Generated:**
- JSON: `script/data/vesting-data.json` (intermediate)
- Deployment log: `broadcast/DeployTGEFromJSON.s.sol/84532/run-latest.json`
- Results CSV: `script/data/deployment-results.csv` (final)

---

## ✅ Deployment Status

**Network:** Base Sepolia (Chain ID: 84532)  
**Schedules Created:** 74 (IDs 229-302)  
**Total Amount:** 718,266.65 TGE tokens  
**Unlock Time:** 1761220800 (Thursday, 23 October 2025 12:00:00 UTC)

---

## 🔍 View & Verify Results

### Option 1: View Transaction Hashes (Command Line)

```bash
# See all 74 transaction hashes
cat broadcast/DeployTGEFromJSON.s.sol/84532/run-latest.json | jq '.receipts[] | .transactionHash'

# See first 5 with details
cat broadcast/DeployTGEFromJSON.s.sol/84532/run-latest.json | jq '.receipts[0:5] | .[] | {hash: .transactionHash, gasUsed, blockNumber}'
```

### Option 2: Open CSV in Excel

```bash
open script/data/deployment-results.csv
```

All transaction details in spreadsheet format! ✅

### Option 3: Verify on BaseScan

1. Go to: https://sepolia.basescan.org/address/0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f
2. View all transactions from your deployer address
3. Each `createVestingSchedule` call = 1 beneficiary

### Option 4: Query Blockchain Directly

```bash
# Check any beneficiary's schedule IDs
cast call 0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f \
  "getSchedulesForBeneficiary(address)(uint256[])" \
  0x72C1dE2D2e0E4C406026C3D55b8C9E4E05da3960 \
  --rpc-url https://sepolia.base.org
```

---

## 👥 For Beneficiaries - How to Claim

After unlock time (12pm UTC on Oct 23, 2025), beneficiaries can claim:

```bash
cast send 0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f \
  "claimVestedTokens(uint256)" YOUR_SCHEDULE_ID \
  --private-key YOUR_KEY \
  --rpc-url https://sepolia.base.org
```

**Find Schedule ID:** Check `deployment-results.csv` or query blockchain.

---

## 🔑 Technical Notes

**How FFI File Reading Works:**
1. `ffi = true` in `foundry.toml` enables shell commands
2. `vm.ffi(["cat", "file.json"])` executes shell to read file
3. `--ffi` flag required when running script
4. Bypasses Foundry's `fs_permissions` restrictions

**Why This Approach:**
- ✅ Direct JSON file reading
- ✅ No data hardcoding needed
- ✅ Easy to update amounts
- ✅ Clean separation of data and logic

---

**Complete. Simple. Works.** ✅
