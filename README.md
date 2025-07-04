## TTN Token System - Deployment & Interaction Guide

This project uses both **Foundry** and **Hardhat** for smart contract development, deployment, and verification.

---

## Prerequisites
- Node.js & npm
- [Foundry](https://book.getfoundry.sh/getting-started/installation.html) (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- [Hardhat](https://hardhat.org/getting-started/) (`npm install`)

---

## Environment Setup

### Option 1: Interactive Private Key (Recommended)
Foundry will securely prompt for your private key during deployment. This method is safe and doesn't store the private key in shell history.

### Option 2: Environment Variables
Create a `.env` file in the project root with the following (replace values as needed):

```

**Security Note:** If using environment variables, ensure `.env` is in your `.gitignore` to prevent accidentally committing private keys.

---

## Build Contracts

```sh
forge build
```

---

## Deploy Contracts

### Base Sepolia Testnet

This will deploy all contracts and verify them on BaseScan Sepolia testnet:

```sh
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key <BASESCAN_API_KEY> \
  --chain 84532 \
  --private-key <PRIVATE_KEY>
```

### Base Mainnet

This will deploy all contracts and verify them on BaseScan mainnet:

```sh
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key <BASESCAN_API_KEY> \
  --chain 8453 \
  --private-key <PRIVATE_KEY>
```

**Note:** The script will print all implementation and proxy addresses. Copy these to your `.env` file for future use.

---
## Verification (Automatic)
- Contract verification is handled automatically during deployment with the `--verify` flag.
- You can check verification status on [BaseScan Sepolia](https://sepolia.basescan.org/).
- You can check verification status on [BaseScan Mainnet](https://basescan.org/).

---

## Why Foundry for Deployment & Verification?

### Foundry Advantages for This Project

#### 🚀 **Performance & Speed**
- **Faster Compilation:** Rust-based compiler is significantly faster than Solidity compiler
- **Quick Deployment:** Reduced deployment time on Base Sepolia testnet
- **Efficient Verification:** Streamlined verification process with built-in support

#### 🔧 **Built-in Features**
- **Native Proxy Support:** Excellent support for UUPS proxy pattern deployment
- **Automatic Verification:** One-command deployment and verification
- **Gas Optimization:** Better gas estimation and optimization tools
- **Console Logging:** Built-in console.log for debugging deployment scripts

#### 🛡️ **Security & Reliability**
- **Type Safety:** Strong typing in deployment scripts reduces errors
- **Gas Tracking:** Automatic gas usage tracking and optimization
- **Error Handling:** Better error messages and debugging capabilities
- **Transaction Management:** Robust transaction handling and retry mechanisms

#### 📊 **Developer Experience**
- **Interactive Scripts:** Secure private key prompting without shell history exposure
- **Broadcast Files:** Automatic transaction recording and replay capabilities
- **Environment Integration:** Seamless environment variable support
- **Chain Management:** Native support for multiple networks and RPC endpoints
  

### Hardhat vs Foundry Comparison

| Feature | Foundry | Hardhat |
|---------|---------|---------|
| **Compilation Speed** | ⚡ Very Fast (Rust) | 🐌 Slower (JavaScript) |
| **Proxy Deployment** | ✅ Native Support | ⚠️ Requires Plugins |
| **Verification** | ✅ Built-in | ⚠️ Requires Plugins |
| **Gas Optimization** | ✅ Excellent | ⚠️ Limited |
| **Type Safety** | ✅ Strong | ⚠️ JavaScript-based |
| **Console Logging** | ✅ Built-in | ⚠️ Requires Setup |
| **Transaction Recording** | ✅ Automatic | ❌ Manual Setup |

### Hardhat Compatibility
- You can still use Hardhat for scripting, upgrades, and TypeScript-based tests.
- See `scripts/deploy.ts` for a Hardhat deployment example.
- **Hybrid Approach:** Use Foundry for deployment/verification, Hardhat for complex scripting

---

## Additional Foundry Commands

- **Build:** `forge build`
- **Test:** `forge test`
- **Format:** `forge fmt`
- **Anvil (local node):** `anvil`
- **Help:** `forge --help`

---


## Deployed Contracts on Base Sepolia

### Contract Architecture Overview

This project uses the **UUPS (Universal Upgradeable Proxy Standard)** pattern for upgradeable contracts. This architecture consists of:

- **Implementation Contracts:** The actual contract logic that can be upgraded
- **Proxy Contracts:** The user-facing contracts that delegate calls to the implementation

### Implementation Contracts (Logic Layer)
These contain the actual contract logic and can be upgraded without changing user addresses:

- **TTNToken Implementation:** [0x2d28b0e6dffd7155dbf4328681d0de41f099f6a6](https://sepolia.basescan.org/address/0x2d28b0e6dffd7155dbf4328681d0de41f099f6a6)
  - Contains the ERC20 token logic with custom features
  - **Upgradeable:** ✅ Can be upgraded to add new features
  - **Integration:** ❌ Should NOT be integrated directly

- **TokenVault Implementation:** [0xe32ed47c51e68c309133719a848a0988a028a3c4](https://sepolia.basescan.org/address/0xe32ed47c51e68c309133719a848a0988a028a3c4)
  - Contains vault logic for token distribution and management
  - **Upgradeable:** ✅ Can be upgraded to modify vault functionality
  - **Integration:** ❌ Should NOT be integrated directly

- **VestingManager Implementation:** [0x4dbcd8721e025ee11b8b1fa4991da993e202a0b5](https://sepolia.basescan.org/address/0x4dbcd8721e025ee11b8b1fa4991da993e202a0b5)
  - Contains vesting schedule logic and token release mechanisms
  - **Upgradeable:** ✅ Can be upgraded to modify vesting rules
  - **Integration:** ❌ Should NOT be integrated directly

### Proxy Contracts (User Interface)
These are the contracts that users and applications should interact with:

- **TTNToken Proxy:** [0x794110602acab007732eda2f3aee7dce78bd6256](https://sepolia.basescan.org/address/0x794110602acab007732eda2f3aee7dce78bd6256)
  - **Integration:** ✅ **USE THIS ADDRESS** for token interactions
  - **Purpose:** Main TTN token contract for transfers, approvals, etc.
  - **Upgradeable:** ✅ Will automatically use upgraded implementation

- **TokenVault Proxy:** [0xe72dcaea94829025391ace9cff3053c06731f46b](https://sepolia.basescan.org/address/0xe72dcaea94829025391ace9cff3053c06731f46b)
  - **Integration:** ✅ **USE THIS ADDRESS** for vault operations
  - **Purpose:** Token distribution, airdrops, and vault management
  - **Upgradeable:** ✅ Will automatically use upgraded implementation

- **VestingManager Proxy:** [0x2df41d6e79a76bd4e913ab6dc8b954581ee8e67f](https://sepolia.basescan.org/address/0x2df41d6e79a76bd4e913ab6dc8b954581ee8e67f)
  - **Integration:** ✅ **USE THIS ADDRESS** for vesting operations
  - **Purpose:** Create and manage token vesting schedules
  - **Upgradeable:** ✅ Will automatically use upgraded implementation

### Why UUPS Proxy Pattern?
- **Upgradeability:** Contract logic can be updated without changing user addresses
- **Gas Efficiency:** More gas-efficient than traditional proxy patterns
- **Security:** Implementation contracts are separate from proxy contracts
- **User Experience:** Users always interact with the same proxy addresses

### Integration Guidelines
- **✅ Use Proxy Addresses:** Always integrate using the proxy contract addresses
- **❌ Don't Use Implementation Addresses:** Never integrate directly with implementation contracts
- **🔗 Consistent Addresses:** Proxy addresses remain the same even after upgrades
- **📋 ABI Compatibility:** Use the proxy contract ABIs for integration

### Transaction Logging & Events

#### 📝 **Which Contract Logs Transactions?**
- **Proxy Contracts:** ✅ **Log all user transactions and events**
- **Implementation Contracts:** ❌ **Do NOT log transactions directly**

#### 🔄 **How Transaction Logging Works**
1. **User calls Proxy Contract** → Proxy delegates to Implementation
2. **Implementation executes logic** → Events are emitted from Implementation
3. **Proxy forwards events** → Events appear as if they came from Proxy address
4. **Blockchain logs** → All transactions show Proxy contract address


#### 🎯 **Why This Matters**
- **Consistent Address:** All events/tokens show same proxy address
- **Upgrade Safety:** Events continue working after implementation upgrades
- **User Experience:** Users always see the same contract address in their wallet
- **Integration:** Frontends and APIs should listen to proxy contract events


---

## References
- [Foundry Book](https://book.getfoundry.sh/)
- [Hardhat Docs](https://hardhat.org/getting-started/)
- [BaseScan Sepolia](https://sepolia.basescan.org/)