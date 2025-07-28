import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ConfidentialVoting contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy the ConfidentialVoting contract
  const ConfidentialVoting = await ethers.getContractFactory("ConfidentialVoting");
  const confidentialVoting = await ConfidentialVoting.deploy();
  await confidentialVoting.waitForDeployment();

  const contractAddress = await confidentialVoting.getAddress();
  console.log("ConfidentialVoting deployed to:", contractAddress);

  // Verify deployment
  const deployedContract = await ethers.getContractAt("ConfidentialVoting", contractAddress);
  const proposalCount = await deployedContract.proposalCount();
  console.log("Initial proposal count:", proposalCount.toString());

  // Note: Creating proposals requires FHE support
  console.log("Note: Creating proposals requires FHE support and will work on Sepolia testnet");
  console.log("To create proposals, deploy to Sepolia testnet using: npm run deploy:sepolia");

  console.log("Deployment completed successfully!");
  console.log("");
  console.log("Next steps:");
  console.log("1. Use Zama Relayer SDK to encrypt votes on the frontend");
  console.log("2. Call vote() function with encrypted vote and proof");
  console.log("3. Use makeVoteCountsPublic() to reveal results");
  console.log("4. Decrypt results using Zama Relayer SDK");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 