// Contract configuration for Confidential Voting
// Similar to zpool-fe structure

// Contract addresses (Sepolia deployment)
export const CONFIDENTIAL_VOTING_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x6edCAd4CfbAbd1b94fdE123297D0B981A1477807";

// Import ABI from compiled contract
import contractABI from './ConfidentialVotingABI.json';
export const CONFIDENTIAL_VOTING_ABI = contractABI.abi; 