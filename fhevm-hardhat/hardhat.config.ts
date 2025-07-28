import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import type { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// FHEVM plugin is automatically initialized

// Support both private key and mnemonic
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const MNEMONIC = process.env.MNEMONIC || "";

// Use private key if available, otherwise use mnemonic
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : { mnemonic: MNEMONIC };

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: PRIVATE_KEY ? [{ privateKey: PRIVATE_KEY, balance: "10000000000000000000000" }] : { mnemonic: MNEMONIC },
      chainId: 31337,
    },
    anvil: {
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : { 
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : { 
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL || `https://ethereum-sepolia-rpc.publicnode.com`,
    },
    // Localhost for Hardhat Node
    localhost: {
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : { 
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 31337,
      url: "http://localhost:8545",
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.24",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
