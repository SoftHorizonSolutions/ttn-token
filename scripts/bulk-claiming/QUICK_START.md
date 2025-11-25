# Quick Start - Bulk Claiming Deployment

## 🚀 Fast Commands Reference

### 1. Convert CSV to JSON
```bash
# Convert first CSV - creates new JSON
npx ts-node scripts/bulk-claiming/convertClaimingCsvToJson.ts "scripts/bulk-claiming/Airdrop Claim(Galxe).csv"

# Convert second CSV - appends to same JSON
npx ts-node scripts/bulk-claiming/convertClaimingCsvToJson.ts "scripts/bulk-claiming/claiming-addresses.csv.csv"

### 2. Set Environment Variables
```bash
export VESTING_MANAGER_PROXY="0xYourVestingManagerAddress"
export TOKEN_VAULT_PROXY="0xYourTokenVaultAddress"
```
## 3.0 Starts from batch one.
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256,uint256)" 0 50 \
  --rpc-url https://sepolia.base.org \
  --private-key 835cabaa3818eff3bcc991decf13e77b5be3eaaab584334b1488285df8bf68c5 \
  --broadcast \
  --ffi

### 3.1 Process Next Batch (Auto-Resume)
```bash
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256)" 50 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast \
  --ffi
```

### 4. Check Progress
```bash
cat scripts/bulk-claiming/data/deployment-progress.json
```

### 5. Start from Zero (Reset)
```bash
rm scripts/bulk-claiming/data/deployment-progress.json
# OR use explicit start index:
forge script script/bulk-claiming/BulkCreateAllocationsAndVestingBatched.s.sol:BulkCreateAllocationsAndVestingBatched \
  --sig "run(uint256,uint256)" 0 50 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast \
  --ffi
```

---

## 📋 What Each Command Does

| Command | Purpose |
|---------|---------|
| `convertClaimingCsvToJson.ts` | Converts CSV file to JSON format |
| `run(uint256) 50` | Process next 50 addresses (auto-resumes) |
| `run(uint256,uint256) 0 50` | Start from index 0, process 50 addresses |
| `--broadcast` | Send transactions on-chain (remove for dry-run) |
| `--ffi` | Enable file I/O for progress tracking |

---

## 🔄 Typical Workflow

1. **Convert CSV** → Creates JSON file
2. **Run script** → Processes batch of addresses
3. **Check progress** → See how many processed
4. **Repeat step 2** → Continue until all done

---

## ⚠️ Important Notes

- Each address = **2 transactions** (allocation + vesting)
- Progress is **auto-saved** after each address
- Safe to **stop and resume** anytime
- Use **better RPC** (Alchemy/Infura) for reliability

---

For detailed guide, see: `BULK_CLAIMING_GUIDE.md`

