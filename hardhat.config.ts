import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config();

// Get environment variables or use defaults
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const BASE_GOERLI_URL = process.env.BASE_GOERLI_URL || "https://goerli.base.org";
const BASE_SEPOLIA_URL = process.env.BASE_SEPOLIA_URL || "https://sepolia.base.org";
const BASE_MAINNET_URL = process.env.BASE_MAINNET_URL || "https://base-mainnet.g.alchemy.com/v2/egiIx6XhC4WtmHI_y0Cbm";
const ETHEREUM_MAINNET_URL = process.env.ETHEREUM_MAINNET_URL || process.env.MAINNET_URL || "https://eth.llamarpc.com";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  // Network configurations
  networks: {
    // Local development network
    hardhat: {
      chainId: 31337
    },
    // Base Goerli testnet
    base_goerli: {
      url: BASE_GOERLI_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 84531,
      gasPrice: 1000000000, // 1 gwei
    },
    // Base Sepolia testnet
    baseSepolia: {
      url: BASE_SEPOLIA_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 84532,
      gasPrice: 1000000000, // 1 gwei
    },
    // Base mainnet
    base: {
      url: BASE_MAINNET_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 8453,
      gasPrice: 1000000000, // 1 gwei
    },
    // Ethereum mainnet
    mainnet: {
      url: ETHEREUM_MAINNET_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 1,
      gasPrice: 20000000000, // 20 gwei (adjust as needed)
    }
  },
  // Etherscan verification config
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      base: ETHERSCAN_API_KEY,
      baseGoerli: ETHERSCAN_API_KEY,
      baseSepolia: ETHERSCAN_API_KEY
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "baseGoerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
  // Path configurations
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config;