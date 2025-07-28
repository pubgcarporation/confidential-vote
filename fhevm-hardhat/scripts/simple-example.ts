import { ethers } from "hardhat";

async function main() {
  console.log("=== Confidential Voting System - Simple Demo ===\n");

  // Get signers
  const [owner, voter1, voter2, voter3] = await ethers.getSigners();
  
  console.log("Owner:", owner.address);
  console.log("Voters:", [voter1.address, voter2.address, voter3.address]);
  console.log("");

  // Deploy the contract
  console.log("1. Deploying ConfidentialVoting contract...");
  const ConfidentialVotingFactory = await ethers.getContractFactory("ConfidentialVoting");
  const confidentialVoting = await ConfidentialVotingFactory.deploy();
  await confidentialVoting.waitForDeployment();
  
  const contractAddress = await confidentialVoting.getAddress();
  console.log("Contract deployed to:", contractAddress);
  console.log("");

  // Check initial state
  console.log("2. Initial contract state:");
  const initialProposalCount = await confidentialVoting.proposalCount();
  console.log("Initial proposal count:", initialProposalCount.toString());
  console.log("");

  // Note about FHE requirements
  console.log("3. FHE Requirements:");
  console.log("Note: This contract requires FHE (Fully Homomorphic Encryption) to work properly.");
  console.log("The following operations need FHE support:");
  console.log("- Creating proposals (initializes encrypted vote counts)");
  console.log("- Casting votes (requires encrypted vote with proof)");
  console.log("- Vote counting (encrypted aggregation)");
  console.log("");
  console.log("To use this contract in production:");
  console.log("1. Deploy to Zama testnet (FHE-enabled network)");
  console.log("2. Use Zama Relayer SDK for vote encryption");
  console.log("3. Handle FHE proofs and decryption properly");
  console.log("");

  console.log("=== Demo completed! ===");
  console.log("");
  console.log("Contract features:");
  console.log("✅ Proposal creation and management");
  console.log("✅ Encrypted vote casting");
  console.log("✅ Vote privacy protection");
  console.log("✅ Public result revelation");
  console.log("✅ Comprehensive event logging");
  console.log("");
  console.log("Next steps:");
  console.log("1. Test on Zama testnet");
  console.log("2. Integrate with Zama Relayer SDK");
  console.log("3. Build frontend interface");
  console.log("4. Implement vote encryption/decryption");
} 