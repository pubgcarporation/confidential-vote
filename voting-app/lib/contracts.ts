// Contract configuration for Confidential Voting
// Similar to zpool-fe structure

// Contract addresses (Sepolia deployment)
export const CONFIDENTIAL_VOTING_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xc6360DF25c973F7d5A758a257c42833DBE4D7aa8";

// Import ABI from compiled contract
import contractABI from './ConfidentialVotingABI.json';
export const CONFIDENTIAL_VOTING_ABI = contractABI.abi; 