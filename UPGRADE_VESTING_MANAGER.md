# Upgrade Vesting Manager to V2

This guide walks you through upgrading the TTNVestingManager contract from V1 to V2 using Foundry.

## 📋 Prerequisites

Before starting the upgrade process, ensure you have:

1. **Foundry installed** - The project uses Foundry for contract deployment
2. **Environment variables set** - Required proxy address
3. **Admin access** - The account must have `DEFAULT_ADMIN_ROLE` on the proxy
4. **Network access** - RPC URL configured for the target network
5. **Sufficient balance** - Account must have enough ETH for gas fees

## 🔧 Required Environment Variables

Set the following environment variable before running the upgrade:

```bash
export VESTING_MANAGER_PROXY=<your_proxy_address>
```


## 📝 Step-by-Step Upgrade Instructions

### Step 1: Clean Build Artifacts

Clean any existing build artifacts to ensure a fresh compilation:

```bash
forge clean
```

### Step 2: Compile Contracts

Compile all contracts to generate fresh build artifacts:

```bash
forge build
```

**Expected Output:**
```
Compiling X files with Solc 0.8.28
Solc 0.8.28 finished in X.XXs
Compiler run successful!
```

### Step 3: Run the Upgrade Script

Execute the upgrade script with the following command:

```bash
forge script script/Deployscript/UpgradeVestingManager.s.sol:UpgradeVestingManagerScript \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --private-key <PRIVATE KEY>
```

**Command Breakdown:**
- `forge script` - Runs a Foundry script
- `script/Deployscript/UpgradeVestingManager.s.sol:UpgradeVestingManagerScript` - Script path and contract name
- `--rpc-url https://sepolia.base.org` - RPC endpoint for Base Sepolia testnet
- `--broadcast` - Broadcasts the transaction to the network
- `--verify` - Verifies the contract on Etherscan/BaseScan
- `--private-key <key>` - Private key of the account with admin role



## ✅ What to Expect

### Successful Upgrade Output

When the upgrade completes successfully, you should see:

```
=== VestingManager Upgrade ===
Proxy Address: 0x...
Using private key from --private-key flag or foundry.toml

[Pre-upgrade Validation] Checking for existing schedules...
  [OK] Found existing schedules - storage will be preserved
       Sample schedule 1 beneficiary: 0x...

[Upgrading] Upgrading proxy to TTNVestingManagerV2...
[OK] Upgrade transaction sent!

=== Upgrade Summary ===
Proxy Address (unchanged): 0x...
New Implementation Address: 0x...
[OK] Upgrade Complete!
[OK] V2 Initialization Complete!

New functions available:
  - forceRevokeSchedule(uint256 scheduleId)
  - batchForceRevokeSchedules(uint256[] calldata scheduleIds)
  - getVersion() -> returns 2
```

### Key Points

- **Proxy Address remains unchanged** - The proxy address stays the same, only the implementation is upgraded
- **Storage is preserved** - All existing vesting schedules and state are maintained
- **New functions available** - V2 adds new functionality without breaking existing features

## 🔍 Verification Steps

After the upgrade, verify the upgrade was successful:

### 1. Check Version

Call the `getVersion()` function to confirm V2 is active:




### 2. Check on BaseScan

Visit the proxy address on [BaseScan](https://sepolia.basescan.org) and verify:
- The implementation address has changed
- The contract is verified
- Recent transactions show the upgrade

## 🆕 New Features in V2

The V2 upgrade adds the following new functions:

### `forceRevokeSchedule(uint256 scheduleId)`
- Force marks a schedule as revoked without touching TokenVault
- Use for schedules whose allocation is already revoked in vault
- Requires `DEFAULT_ADMIN_ROLE`
- Returns the amount of unvested tokens

### `batchForceRevokeSchedules(uint256[] calldata scheduleIds)`
- Batch version for efficiency
- Force marks multiple schedules as revoked
- Requires `DEFAULT_ADMIN_ROLE`
- Returns the count of successfully revoked schedules

### `getVersion()`
- Returns the current version number (2 for V2)
- Pure function that doesn't use storage

## ⚠️ Troubleshooting

### Error: "Transaction has been reverted by the EVM"

**Possible Causes:**
1. **Missing Admin Role** - The account doesn't have `DEFAULT_ADMIN_ROLE`
   - **Solution:** Grant the role to your account before upgrading

2. **Duplicate Build Info** - Old build artifacts causing validation errors
   - **Solution:** Run `forge clean` and `forge build` again

3. **Insufficient Gas** - Transaction ran out of gas
   - **Solution:** Increase gas limit or check gas price

4. **Network Issues** - RPC endpoint issues
   - **Solution:** Verify RPC URL is correct and accessible

### Error: "Found multiple contracts with name..."

**Solution:**
```bash
forge clean
forge build
```

This cleans old build artifacts and recompiles with fresh artifacts.

### Error: "vm.envAddress: failed parsing $VESTING_MANAGER_PROXY"

**Solution:** Ensure the environment variable is set:
```bash
export VESTING_MANAGER_PROXY=<your_proxy_address>
```

### Error: "AccessControlUnauthorizedAccount"

**Solution:** The account doesn't have the required `DEFAULT_ADMIN_ROLE`. Grant it first:
```solidity
vestingManager.grantRole(DEFAULT_ADMIN_ROLE, yourAddress);
```

## 🔒 Security Notes

1. **Private Key Security** - Never commit private keys to version control
2. **Test First** - Always test upgrades on testnets before mainnet
3. **Backup** - Ensure you have backups of important state before upgrading
4. **Verify** - Always verify contracts after deployment
5. **Admin Access** - Only accounts with `DEFAULT_ADMIN_ROLE` can upgrade



**Last Updated:** January 2025
**Contract Version:** V2
**Network:** Base Sepolia Testnet

