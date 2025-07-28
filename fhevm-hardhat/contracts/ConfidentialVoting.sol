// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract ConfidentialVoting is SepoliaConfig {
    using FHE for *;

    enum VoteOption {
        Yes,
        No
    }

    error InvalidProposal();
    error AlreadyVoted();
    error NotVoted();
    error VoteCountsAlreadyPublic();
    error FHEPermissionDenied();

    struct Proposal {
        string description;
        euint8 yesCount;
        euint8 noCount;
        bool isPublic;
        uint8 publicYesCount;
        uint8 publicNoCount;
    }

    Proposal[] public proposals;

    mapping(uint256 => mapping(address => euint8)) private encryptedVotes;
    mapping(uint256 => mapping(address => bool)) private hasVoted;
    mapping(uint256 => address) private proposalOwner;

    event ProposalCreated(uint256 indexed proposalId, string description);
    event Voted(uint256 indexed proposalId, address voter);
    event VoteCountsMadePublic(uint256 indexed proposalId);

    function createProposal(string calldata description) external {
        uint256 proposalId = proposals.length;
        Proposal storage newProposal = proposals.push();
        newProposal.description = description;
        newProposal.yesCount = FHE.asEuint8(0);
        newProposal.noCount = FHE.asEuint8(0);
        newProposal.isPublic = false;
        newProposal.publicYesCount = 0;
        newProposal.publicNoCount = 0;
        proposalOwner[proposalId] = msg.sender;
        emit ProposalCreated(proposalId, description);
    }

    function vote(
        uint256 proposalId,
        externalEuint8 encryptedVote,
        bytes calldata proof
    ) external {
        if (proposalId >= proposals.length) revert InvalidProposal();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        
        Proposal storage p = proposals[proposalId];
        if (p.isPublic) revert VoteCountsAlreadyPublic(); // Prevent voting on public proposals

        euint8 v = FHE.fromExternal(encryptedVote, proof);
        encryptedVotes[proposalId][msg.sender] = v;
        hasVoted[proposalId][msg.sender] = true;

        // Grant decryption access immediately
        FHE.allow(v, msg.sender);
        FHE.allowThis(v);

        euint8 yes = FHE.asEuint8(uint8(VoteOption.Yes));
        euint8 no = FHE.asEuint8(uint8(VoteOption.No));
        euint8 one = FHE.asEuint8(1);

        p.yesCount = FHE.add(
            p.yesCount,
            FHE.select(FHE.eq(v, yes), one, FHE.asEuint8(0))
        );
        p.noCount = FHE.add(
            p.noCount,
            FHE.select(FHE.eq(v, no), one, FHE.asEuint8(0))
        );

        FHE.allowThis(p.yesCount);
        FHE.allowThis(p.noCount);
        emit Voted(proposalId, msg.sender);
    }

    function getEncryptedVoteCount(
        uint256 proposalId
    ) external view returns (euint8 yes, euint8 no) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        Proposal storage p = proposals[proposalId];
        return (p.yesCount, p.noCount);
    }

    function getMyVote(uint256 proposalId) external view returns (euint8) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        if (!hasVoted[proposalId][msg.sender]) revert NotVoted();

        return encryptedVotes[proposalId][msg.sender];
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function hasUserVoted(
        uint256 proposalId,
        address voter
    ) external view returns (bool) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        return hasVoted[proposalId][voter];
    }

    function hasAnyVotes(uint256 proposalId) external view returns (bool) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        return true;
    }

    function isProposalOwner(uint256 proposalId, address user) external view returns (bool) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        return proposalOwner[proposalId] == user;
    }

    function makeVoteCountsPublic(uint256 proposalId) external {
        if (proposalId >= proposals.length) revert InvalidProposal();
        if (msg.sender != proposalOwner[proposalId]) revert FHEPermissionDenied();
        
        Proposal storage p = proposals[proposalId];
        if (p.isPublic) revert VoteCountsAlreadyPublic();

        FHE.makePubliclyDecryptable(p.yesCount);
        FHE.makePubliclyDecryptable(p.noCount);

        p.isPublic = true;

        emit VoteCountsMadePublic(proposalId);
    }

    function getPublicVoteCounts(
        uint256 proposalId
    ) external view returns (uint8 yesCount, uint8 noCount, bool isPublic) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        Proposal storage p = proposals[proposalId];
        return (p.publicYesCount, p.publicNoCount, p.isPublic);
    }
}
