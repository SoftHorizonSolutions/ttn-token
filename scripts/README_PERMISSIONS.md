# Fix VestingManager Permissions

## Quick Start

### 1. Add to your `.env` file:

```bash
# Your existing variables...
PRIVATE_KEY=...
BASE_GOERLI_URL=...

# Add these contract addresses:
ABC_TOKEN_ADDRESS=0x1A5000e8A2354f30dB93bb094aD77425490612e5
ABC_VESTING_MANAGER_ADDRESS=0x2df41d6e79a76bd4e913ab6dc8b954581ee8e67f
ABC_TOKEN_VAULT_ADDRESS=0xYourTokenVaultAddressHere  # ⚠️ UPDATE THIS!
```

### 2. Run the script:

```bash
npx hardhat run scripts/setupVestingPermissions.ts --network baseSepolia
```

### 3. Done! ✅

After the script runs successfully, your `manualUnlock()` function should work in the frontend.

---

## What Was Wrong?

The error you were getting:
```
Transaction has been reverted by the EVM
```

This happened because the **VestingManager contract** didn't have permission to call `mint()` on the **ABCToken contract**.

When you call `manualUnlock()`:
1. Your wallet → calls → VestingManager contract
2. VestingManager → tries to call → ABCToken.mint()
3. ❌ ABCToken rejects it (no permission)

## What This Script Fixes:

✅ Grants `DEFAULT_ADMIN_ROLE` to VestingManager on ABCToken (so it can mint)
✅ Grants `DEFAULT_ADMIN_ROLE` to your wallet on VestingManager (so you can call manualUnlock)
✅ Unpauses contracts if they're paused
✅ Verifies everything is working

---

## For Other Networks

If you need to run this on a different network:

```bash
# Base Mainnet
npx hardhat run scripts/setupVestingPermissions.ts --network base

# Local Hardhat
npx hardhat run scripts/setupVestingPermissions.ts --network hardhat
```

---

## Troubleshooting

### Error: "ABC_TOKEN_VAULT_ADDRESS not found"
- Add the `ABC_TOKEN_VAULT_ADDRESS` to your `.env` file

### Error: "NotAuthorized" or "AccessControlUnauthorizedAccount"
- Your wallet needs to be the admin/owner of the contracts first
- If using a multisig, run this through the multisig interface

### Error: "Insufficient funds"
- Make sure you have enough ETH for gas fees on Base Sepolia

---

## Need Help?

Check `ENV_SETUP.md` for detailed documentation.

