# Confidential Voting System

A decentralized confidential voting system built with Solidity and Fully Homomorphic Encryption (FHE) using the FHEVM framework.

## Overview

This system allows for truly confidential voting where:
- Voters can cast encrypted ballots using FHE
- Vote privacy is maintained through encrypted operations
- Anyone can create proposals and vote
- Results can be made public after voting period ends

## Features

- **Confidential Voting**: All votes are encrypted using FHE
- **Proposal Management**: Create and manage multiple proposals
- **Encrypted Vote Counting**: Vote counts are encrypted until made public
- **Public Results**: Option to reveal vote counts after voting
- **Audit Trail**: Events for all important actions

## Smart Contract: ConfidentialVoting.sol

### Key Functions

#### Proposal Management
- `createProposal()`: Create a new proposal
- `proposalCount()`: Get total number of proposals
- `proposals()`: Get proposal information

#### Voting
- `vote()`: Cast an encrypted vote with proof
- `hasUserVoted()`: Check if a user has voted on a proposal
- `getMyVote()`: Get your own encrypted vote (with authorization)

#### Results
- `getEncryptedVoteCount()`: Get encrypted vote counts
- `makeVoteCountsPublic()`: Make vote counts public
- `getPublicVoteCounts()`: Get public vote counts

### Security Features

- **FHE Encryption**: All votes are encrypted using TFHE
- **Proof Verification**: Votes require cryptographic proofs
- **Vote Privacy**: Individual votes remain private
- **Public Results**: Controlled revelation of vote counts

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (optional):
```bash
# Copy example environment file
cp .env.example .env

# Edit .env file with your configuration
# Option 1: Use private key (recommended for production)
# PRIVATE_KEY=your_private_key_here
# SEPOLIA_RPC_URL=https://your-sepolia-rpc-endpoint.com
# ZAMA_RPC_URL=https://your-zama-rpc-endpoint.com

# Option 2: Use mnemonic phrase
# MNEMONIC=your twelve word mnemonic phrase here
```

3. Compile contracts:
```bash
npm run compile
```

## Usage

### Deploy the Contract

```bash
# Deploy to local network
npm run deploy

# Deploy to Hardhat Node (persistent local testing)
npm run deploy:localhost

# Deploy to Sepolia testnet (for FHE operations)
npm run deploy:sepolia
```

### Create a Proposal

```javascript
await confidentialVoting.createProposal("Should we implement FHE voting?");
```

### Cast a Vote

```javascript
// Note: This requires FHE encryption using Zama Relayer SDK
// The encryptedVote should be an externalEuint8 with proper proof
await confidentialVoting.vote(proposalId, encryptedVote, proof);
```

### Make Results Public

```javascript
await confidentialVoting.makeVoteCountsPublic(proposalId);
```

### Get Public Results

```javascript
const [yesCount, noCount, isPublic] = await confidentialVoting.getPublicVoteCounts(proposalId);
```

## Testing

Run the test suite:

```bash
npx hardhat test
```

## Networks

The project is configured for:
- **Hardhat**: Local development (mock encryption)
- **Anvil**: Local development with Anvil (mock encryption)
- **Localhost**: Hardhat Node server (mock encryption, persistent)
- **Sepolia**: Ethereum testnet with Zama Protocol (real FHE encryption)

## Account Configuration

### Option 1: Private Key (Recommended for Production)
```bash
# Copy example file
cp .env.example .env

# Edit .env file
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://your-sepolia-rpc-endpoint.com
```

### Option 2: Mnemonic Phrase
```bash
# Copy example file
cp .env.example .env

# Edit .env file
MNEMONIC=your twelve word mnemonic phrase here
```

### Security Notes
- **Private Key**: More secure for production, single account
- **Mnemonic**: Can generate multiple accounts, good for development
- **Environment Variables**: Never commit private keys to version control
- **Default**: Uses test mnemonic if no environment variables are set

## Architecture

### FHE Integration

The contract uses TFHE (TFHE-rs) for encrypted operations:
- `euint8`: Encrypted 8-bit integers for vote counts
- `externalEuint8`: External encrypted values for vote submission
- `FHE.add()`: Encrypted addition for vote aggregation
- `FHE.select()`: Encrypted conditional selection
- `FHE.eq()`: Encrypted equality comparison

### Vote Encryption

Votes are encrypted as simple Yes/No values:
- `VoteOption.Yes` (0): Vote for the proposal
- `VoteOption.No` (1): Vote against the proposal
- Each vote is encrypted before submission
- Results are aggregated in encrypted form

### Vote Privacy

- **Individual Privacy**: Each voter's choice is encrypted
- **Aggregate Privacy**: Total vote counts are encrypted
- **Controlled Revelation**: Results can be made public when needed
- **Proof Verification**: Cryptographic proofs ensure vote validity

## Security Considerations

1. **Vote Privacy**: FHE ensures vote privacy even from contract owner
2. **Proof Verification**: Cryptographic proofs prevent invalid votes
3. **Controlled Revelation**: Results are only revealed when explicitly made public
4. **No Double Voting**: Each address can only vote once per proposal
5. **Immutable Votes**: Votes cannot be changed once cast

## Limitations

1. **Gas Costs**: FHE operations are computationally expensive
2. **Client-side Encryption**: Voters need to encrypt votes before submission
3. **Network Requirements**: Requires FHE-enabled networks (like Zama)
4. **Complex Setup**: Requires Zama Relayer SDK for full functionality

## Frontend Integration

To integrate with a frontend:

1. Install Zama Relayer SDK:
```bash
npm install @zama-fhe/relayer-sdk
```

2. Encrypt votes on the client side:
```javascript
import { Relayer } from '@zama-fhe/relayer-sdk';

const relayer = new Relayer();
const encryptedVote = await relayer.encrypt(voteValue);
const proof = await relayer.generateProof(encryptedVote);
```

3. Submit encrypted vote:
```javascript
await contract.vote(proposalId, encryptedVote, proof);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details. 