import { ethers } from "hardhat";
import { ConfidentialVoting } from "../typechain-types";

async function main() {
  console.log("=== Confidential Voting System Example ===\n");

  // Get signers
  const [owner, voter1, voter2, voter3, voter4, voter5] = await ethers.getSigners();
  
  console.log("Owner:", owner.address);
  console.log("Voters:", [voter1.address, voter2.address, voter3.address, voter4.address, voter5.address]);
  console.log("");

  // Deploy the contract
  console.log("1. Deploying ConfidentialVoting contract...");
  const ConfidentialVotingFactory = await ethers.getContractFactory("ConfidentialVoting");
  const confidentialVoting = await ConfidentialVotingFactory.deploy();
  await confidentialVoting.waitForDeployment();
  
  const contractAddress = await confidentialVoting.getAddress();
  console.log("Contract deployed to:", contractAddress);
  console.log("");

  // Create proposals
  console.log("2. Creating proposals...");
  const proposals = [
    "Should we implement FHE in our voting system?",
    "Should we add more security features?",
    "Should we integrate with other blockchains?"
  ];

  for (let i = 0; i < proposals.length; i++) {
    const tx = await confidentialVoting.createProposal(proposals[i]);
    await tx.wait();
    console.log(`Created proposal ${i}: ${proposals[i]}`);
  }

  console.log("Total proposals:", await confidentialVoting.proposalCount());
  console.log("");

  // Get proposal information
  console.log("3. Proposal information:");
  for (let i = 0; i < proposals.length; i++) {
    const proposal = await confidentialVoting.proposals(i);
    console.log(`Proposal ${i}:`);
    console.log(`  Description: ${proposal.description}`);
    console.log(`  Is Public: ${proposal.isPublic}`);
    console.log(`  Public Yes Count: ${proposal.publicYesCount}`);
    console.log(`  Public No Count: ${proposal.publicNoCount}`);
  }
  console.log("");

  // Check voting status
  console.log("4. Voting status:");
  for (let i = 0; i < proposals.length; i++) {
    for (let j = 0; j < 5; j++) {
      const voter = [voter1, voter2, voter3, voter4, voter5][j];
      const hasVoted = await confidentialVoting.hasUserVoted(i, voter.address);
      console.log(`  Voter ${j + 1} on Proposal ${i}: ${hasVoted ? "Voted" : "Not voted"}`);
    }
  }
  console.log("");

  // Get encrypted vote counts
  console.log("5. Encrypted vote counts:");
  for (let i = 0; i < proposals.length; i++) {
    const [yesCount, noCount] = await confidentialVoting.getEncryptedVoteCount(i);
    console.log(`Proposal ${i}: Yes=${yesCount}, No=${noCount} (encrypted)`);
  }
  console.log("");

  // Make vote counts public
  console.log("6. Making vote counts public...");
  for (let i = 0; i < proposals.length; i++) {
    const tx = await confidentialVoting.makeVoteCountsPublic(i);
    await tx.wait();
    console.log(`Made proposal ${i} public`);
  }
  console.log("");

  // Get public vote counts
  console.log("7. Public vote counts:");
  for (let i = 0; i < proposals.length; i++) {
    const [yesCount, noCount, isPublic] = await confidentialVoting.getPublicVoteCounts(i);
    console.log(`Proposal ${i}: Yes=${yesCount}, No=${noCount}, Public=${isPublic}`);
  }
  console.log("");

  console.log("=== Example completed successfully! ===");
  console.log("");
  console.log("Important notes:");
  console.log("1. This example shows the contract structure only");
  console.log("2. Real voting requires FHE encryption using Zama Relayer SDK");
  console.log("3. Votes must be encrypted as externalEuint8 with proper proofs");
  console.log("4. Decryption requires authorization and proper FHE setup");
  console.log("");
  console.log("Next steps for real implementation:");
  console.log("1. Install and configure Zama Relayer SDK");
  console.log("2. Implement client-side vote encryption");
  console.log("3. Handle FHE proofs and decryption");
  console.log("4. Deploy to Zama testnet for FHE support");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 