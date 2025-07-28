import { ethers } from "hardhat";

async function main() {
  console.log("=== Testing Private Key Configuration ===\n");

  // Get signers
  const [deployer] = await ethers.getSigners();
  
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  // Check if we're using private key or mnemonic
  const privateKey = process.env.PRIVATE_KEY;
  const mnemonic = process.env.MNEMONIC;
  
  if (privateKey) {
    console.log("✅ Using Private Key configuration");
    console.log("Private key (first 10 chars):", privateKey.slice(0, 10) + "...");
  } else if (mnemonic) {
    console.log("✅ Using Mnemonic configuration");
    console.log("Mnemonic (first 20 chars):", mnemonic.slice(0, 20) + "...");
  } else {
    console.log("✅ Using Default test mnemonic");
  }
  console.log("");

  // Deploy contract to test
  console.log("Deploying test contract...");
  const ConfidentialVotingFactory = await ethers.getContractFactory("ConfidentialVoting");
  const confidentialVoting = await ConfidentialVotingFactory.deploy();
  await confidentialVoting.waitForDeployment();
  
  const contractAddress = await confidentialVoting.getAddress();
  console.log("Contract deployed to:", contractAddress);
  console.log("");

  // Test contract interaction
  const proposalCount = await confidentialVoting.proposalCount();
  console.log("Initial proposal count:", proposalCount.toString());
  console.log("");

  console.log("=== Private Key Test Completed Successfully! ===");
  console.log("");
  console.log("Configuration Summary:");
  console.log("- Account Type:", privateKey ? "Private Key" : "Mnemonic");
  console.log("- Deployer Address:", deployer.address);
  console.log("- Contract Address:", contractAddress);
  console.log("- Network:", await ethers.provider.getNetwork());
  console.log("");
  console.log("Next steps:");
  console.log("1. For production: Use PRIVATE_KEY environment variable");
  console.log("2. For development: Use MNEMONIC or default test mnemonic");
  console.log("3. Deploy to testnet: npm run deploy:sepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 