# Environment Setup for Vesting Permissions Script

## Required Environment Variables

Add these variables to your `.env` file:

```bash
# Wallet Configuration
PRIVATE_KEY=your_private_key_here

# Network RPC URLs
BASE_GOERLI_URL=https://goerli.base.org
MAINNET_URL=https://mainnet.base.org

# Etherscan API Key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# ========================================
# ABC Token Contract Addresses (Base Sepolia)
# ========================================

# ABC Token Proxy Address
ABC_TOKEN_ADDRESS=0x1A5000e8A2354f30dB93bb094aD77425490612e5

# ABC Vesting Manager Proxy Address  
ABC_VESTING_MANAGER_ADDRESS=0x2df41d6e79a76bd4e913ab6dc8b954581ee8e67f

# ABC Token Vault Proxy Address (UPDATE THIS WITH YOUR ACTUAL ADDRESS)
ABC_TOKEN_VAULT_ADDRESS=0xYourTokenVaultAddressHere
```

## How to Use

1. **Copy the variables above to your `.env` file**

2. **Update the `ABC_TOKEN_VAULT_ADDRESS`** with your actual TokenVault proxy address

3. **Run the permission setup script:**
   ```bash
   npx hardhat run scripts/setupVestingPermissions.ts --network baseSepolia
   ```

## What This Script Does

The script will:
- ✅ Check if VestingManager can mint tokens on ABCToken
- ✅ Check if your wallet has admin permissions on VestingManager  
- ✅ Check if your wallet is a manager on TokenVault (optional)
- ✅ Check if VestingManager is paused
- ✅ Check if ABCToken is paused
- 🔧 Automatically fix any permission issues found

## After Running

Once the script completes successfully, you can:
- Call `manualUnlock()` from your frontend
- Call `claimVestedTokens()` 
- Perform other admin operations on the VestingManager

## Troubleshooting

If the script fails:
1. Make sure your wallet has enough ETH for gas fees
2. Verify all contract addresses are correct
3. Ensure your wallet is the admin/owner of the contracts
4. Check that you're on the correct network (Base Sepolia)

