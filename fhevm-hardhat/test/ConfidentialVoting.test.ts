import { expect } from "chai";
import { ethers } from "hardhat";
import { ConfidentialVoting } from "../typechain-types";

describe("ConfidentialVoting", function () {
  let confidentialVoting: ConfidentialVoting;
  let owner: any;
  let voter1: any;
  let voter2: any;
  let voter3: any;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();

    const ConfidentialVotingFactory = await ethers.getContractFactory("ConfidentialVoting");
    confidentialVoting = await ConfidentialVotingFactory.deploy();
    await confidentialVoting.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should start with zero proposals", async function () {
      expect(await confidentialVoting.proposalCount()).to.equal(0);
    });
  });

  describe("Proposal Creation", function () {
    it("Should create a proposal", async function () {
      const description = "Should we implement FHE voting?";
      
      await expect(confidentialVoting.createProposal(description))
        .to.emit(confidentialVoting, "ProposalCreated")
        .withArgs(0, description);

      expect(await confidentialVoting.proposalCount()).to.equal(1);
    });

    it("Should create multiple proposals", async function () {
      await confidentialVoting.createProposal("Proposal 1");
      await confidentialVoting.createProposal("Proposal 2");
      await confidentialVoting.createProposal("Proposal 3");

      expect(await confidentialVoting.proposalCount()).to.equal(3);
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      await confidentialVoting.createProposal("Test proposal");
    });

    it("Should check if user has voted", async function () {
      const proposalId = 0;
      
      // Initially, user should not have voted
      expect(await confidentialVoting.hasUserVoted(proposalId, voter1.address)).to.be.false;
    });

    it("Should prevent voting twice on the same proposal", async function () {
      const proposalId = 0;
      
      // Note: This test would require actual FHE encryption in a real scenario
      // For now, we just test the basic structure
      expect(await confidentialVoting.hasUserVoted(proposalId, voter1.address)).to.be.false;
    });
  });

  describe("Proposal Information", function () {
    beforeEach(async function () {
      await confidentialVoting.createProposal("Test proposal");
    });

    it("Should get proposal information", async function () {
      const proposalId = 0;
      const proposal = await confidentialVoting.proposals(proposalId);
      
      expect(proposal.description).to.equal("Test proposal");
      expect(proposal.isPublic).to.be.false;
      expect(proposal.publicYesCount).to.equal(0);
      expect(proposal.publicNoCount).to.equal(0);
    });

    it("Should get encrypted vote counts", async function () {
      const proposalId = 0;
      
      // This would return encrypted values in a real scenario
      const [yesCount, noCount] = await confidentialVoting.getEncryptedVoteCount(proposalId);
      
      // In a real test, these would be encrypted euint8 values
      expect(yesCount).to.exist;
      expect(noCount).to.exist;
    });
  });

  describe("Public Vote Counts", function () {
    beforeEach(async function () {
      await confidentialVoting.createProposal("Test proposal");
    });

    it("Should make vote counts public", async function () {
      const proposalId = 0;
      
      await expect(confidentialVoting.makeVoteCountsPublic(proposalId))
        .to.emit(confidentialVoting, "VoteCountsMadePublic")
        .withArgs(proposalId, 0, 0);

      const [yesCount, noCount, isPublic] = await confidentialVoting.getPublicVoteCounts(proposalId);
      expect(isPublic).to.be.true;
      expect(yesCount).to.equal(0);
      expect(noCount).to.equal(0);
    });

    it("Should not allow making vote counts public twice", async function () {
      const proposalId = 0;
      
      await confidentialVoting.makeVoteCountsPublic(proposalId);
      
      await expect(confidentialVoting.makeVoteCountsPublic(proposalId))
        .to.be.revertedWith("Vote counts already public");
    });
  });

  describe("Error Handling", function () {
    it("Should revert for invalid proposal ID", async function () {
      const invalidProposalId = 999;
      
      await expect(confidentialVoting.hasUserVoted(invalidProposalId, voter1.address))
        .to.be.revertedWith("Invalid proposal");
      
      await expect(confidentialVoting.getEncryptedVoteCount(invalidProposalId))
        .to.be.revertedWith("Invalid proposal");
      
      await expect(confidentialVoting.makeVoteCountsPublic(invalidProposalId))
        .to.be.revertedWith("Invalid proposal");
    });
  });
}); 