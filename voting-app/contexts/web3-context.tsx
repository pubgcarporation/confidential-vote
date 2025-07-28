"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { ethers } from "ethers"
import { prepareVoteForContract, VOTE_OPTIONS, handleFHEError } from "@/lib/fheService"
import { useFHE } from "@/hooks/useFHE"
import { CONFIDENTIAL_VOTING_ABI, CONFIDENTIAL_VOTING_ADDRESS } from "@/lib/contracts"

// Sepolia network configuration
const SEPOLIA_CHAIN_ID = 11155111
const SEPOLIA_NETWORK_NAME = "Sepolia"
const SEPOLIA_RPC_URL = "https://g.w.lavanet.xyz:443/gateway/sep1/rpc-http/ac0a485e471079428fadfc1850f34a3d"

interface Proposal {
  id: number
  description: string
  yesCount: number
  noCount: number
  isPublic: boolean
  createdAt: Date
  encryptedYesCount?: string
  encryptedNoCount?: string
  totalVotes?: number
}

interface Web3ContextType {
  // Wallet state
  account: string | null
  isConnected: boolean
  isConnecting: boolean
  chainId: number | null

  // Network state
  isCorrectNetwork: boolean
  networkName: string | null

  // Contract state
  contract: ethers.Contract | null
  proposals: Proposal[]
  isLoading: boolean

  // FHE state
  fheStatus: {
    initialized: boolean
    loading: boolean
    error: string | null
    sdkAvailable: boolean
  }

  // Functions
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  switchToSepolia: () => Promise<void>
  createProposal: (description: string) => Promise<void>
  vote: (proposalId: number, voteValue: boolean) => Promise<void>
  makeVoteCountsPublic: (proposalId: number) => Promise<void>
  hasUserVoted: (proposalId: number) => Promise<boolean>
  getMyVote: (proposalId: number) => Promise<string>
  getPublicVoteCounts: (proposalId: number) => Promise<{yesCount: number, noCount: number, isPublic: boolean}>
  decryptVoteCounts: (proposalId: number) => Promise<{yesCount: number, noCount: number}>
  refreshProposals: () => Promise<void>
  isProposalOwner: (proposalId: number) => Promise<boolean>
  fheDecrypt?: (encryptedValue: any) => Promise<number>
  fheUserDecrypt?: (encryptedValue: any) => Promise<number>
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasAttemptedAutoConnect, setHasAttemptedAutoConnect] = useState(false)

  // Network validation
  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID
  const networkName = chainId ? (chainId === SEPOLIA_CHAIN_ID ? SEPOLIA_NETWORK_NAME : `Chain ID ${chainId}`) : null

  // FHE configuration - only create when user is actually connected
  const fheConfig = isConnected && account && typeof window !== "undefined" ? {
    network: (window as any).ethereum,
    rpcUrl: SEPOLIA_RPC_URL,
    account: account,
    chainId: chainId || undefined
  } : undefined

  console.log('FHE config:', {
    isConnected,
    account,
    chainId,
    fheConfig: !!fheConfig
  })

  // Use FHE service
  const {
    isInitialized: fheInitialized,
    isLoading: fheLoading,
    error: fheError,
    encrypt: fheEncrypt,
    decrypt: fheDecrypt,
    publicDecrypt: fhePublicDecrypt,
    userDecrypt: fheUserDecrypt
  } = useFHE(fheConfig)

  console.log('FHE status:', {
    fheInitialized,
    fheLoading,
    fheError,
    fheEncrypt: !!fheEncrypt
  })

  // Initialize Web3
  useEffect(() => {
    console.log('Initializing Web3...')
    checkConnection()
  }, [])

  // Auto-reconnect when ethereum becomes available
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum && !isConnected && !isConnecting) {
      console.log('Ethereum available, checking for existing connection...')
      checkConnection()
    }
  }, [isConnected, isConnecting])

  // Auto-connect on page load if wallet is already connected
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window !== "undefined" && window.ethereum && !isConnected && !isConnecting && !hasAttemptedAutoConnect) {
        try {
          setHasAttemptedAutoConnect(true)
          const accounts = await window.ethereum.request({ method: "eth_accounts" })
          if (accounts.length > 0) {
            console.log('Auto-connecting to existing wallet...')
            await connectWallet()
          }
        } catch (error) {
          console.error('Auto-connect failed:', error)
        }
      }
    }
    
    // Only run auto-connect once on mount
    const timer = setTimeout(autoConnect, 1000)
    return () => clearTimeout(timer)
  }, [hasAttemptedAutoConnect]) // Only depend on hasAttemptedAutoConnect

  // Load proposals when FHE is initialized
  useEffect(() => {
    if (fheInitialized && isConnected && contract && proposals.length === 0) {
      console.log('FHE initialized, loading proposals...')
      loadProposals()
    }
  }, [fheInitialized, isConnected, contract])

  const checkConnection = async () => {
    console.log('Checking connection...')
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        console.log('Ethereum provider found, checking accounts...')
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        console.log('Available accounts:', accounts)
        
        if (accounts.length > 0) {
          console.log('Found connected account:', accounts[0])
          // User was already connected, restore the connection
          const chainId = await window.ethereum.request({ method: "eth_chainId" })
          const currentChainId = Number.parseInt(chainId, 16)
          console.log('Current chain ID:', currentChainId)
          
          setAccount(accounts[0])
          setChainId(currentChainId)
          
          // Create provider and contract instance
          const provider = new ethers.BrowserProvider(window.ethereum)
          const signer = await provider.getSigner()
          const contractInstance = new ethers.Contract(CONFIDENTIAL_VOTING_ADDRESS, CONFIDENTIAL_VOTING_ABI, signer)
          
          // Check if contract exists at address
          const contractCode = await provider.getCode(CONFIDENTIAL_VOTING_ADDRESS)
          console.log('Contract code exists:', contractCode !== '0x')
          console.log('Contract address:', CONFIDENTIAL_VOTING_ADDRESS)
          
          if (contractCode === '0x') {
            console.error('Contract not found at address:', CONFIDENTIAL_VOTING_ADDRESS)
            alert('Contract not found at this address. Please check deployment.')
            return
          }
          
          setContract(contractInstance)
          setIsConnected(true)
          
          // Don't load proposals yet - wait for FHE to be initialized
          console.log('Wallet connected, waiting for FHE initialization before loading proposals')
          
          console.log('Restored wallet connection:', {
            account: accounts[0],
            chainId: currentChainId,
            isConnected: true,
            contractExists: true
          })
        } else {
          console.log('No wallet connected, waiting for user to connect...')
        }
      } catch (error) {
        console.error("Error checking connection:", error)
        // Don't retry automatically - let user manually connect if needed
        // This prevents infinite loops when network is down
      }
    } else {
      console.log('Ethereum provider not available')
    }
  }

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask!")
      return
    }

    try {
      setIsConnecting(true)

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      // Get chain ID
      const chainId = await window.ethereum.request({ method: "eth_chainId" })
      const currentChainId = Number.parseInt(chainId, 16)

      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      // Create contract instance
      const contractInstance = new ethers.Contract(CONFIDENTIAL_VOTING_ADDRESS, CONFIDENTIAL_VOTING_ABI, signer)

      setAccount(accounts[0])
      setChainId(currentChainId)
      setContract(contractInstance)
      setIsConnected(true)

      console.log('Wallet connected successfully:', {
        account: accounts[0],
        chainId: currentChainId,
        isConnected: true
      })

      // Don't load proposals yet - wait for FHE to be initialized
      console.log('Wallet connected, waiting for FHE initialization before loading proposals')
    } catch (error) {
      console.error("Error connecting wallet:", error)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setIsConnected(false)
    setChainId(null)
    setContract(null)
    setProposals([])
    setHasAttemptedAutoConnect(false) // Reset to allow auto-connect again
  }

  const loadProposals = async (contractInstance?: ethers.Contract) => {
    const contractToUse = contractInstance || contract
    if (!contractToUse) return

    try {
      setIsLoading(true)

      // Get proposal count
      const count = await contractToUse.proposalCount()
      const proposalCount = Number(count)

      const loadedProposals: Proposal[] = []

      // Load each proposal
      for (let i = 0; i < proposalCount; i++) {
        try {
          const proposal = await contractToUse.proposals(i)
          const [yesCount, noCount, isPublic] = await contractToUse.getPublicVoteCounts(i)
      
          let actualYesCount = Number(yesCount)
          let actualNoCount = Number(noCount)
          let totalVotes = actualYesCount + actualNoCount
      
          let encryptedYesCount, encryptedNoCount
          console.log('isPublic', isPublic)
          console.log('fheInitialized', fheInitialized)
          if (isPublic && fheInitialized) {
            try {
              const decrypted = await decryptVoteCounts(i)
              actualYesCount = decrypted.yesCount
              actualNoCount = decrypted.noCount
              totalVotes = actualYesCount + actualNoCount
              console.log(`✅ Decrypted proposal ${i}:`, { actualYesCount, actualNoCount })
            } catch (err) {
              console.warn(`⚠️ Failed to decrypt proposal ${i}, using encrypted counts`, err)
              // Fallback to encrypted counts if decryption fails
              try {
                const [encYes, encNo] = await contractToUse.getEncryptedVoteCount(i)
                encryptedYesCount = encYes
                encryptedNoCount = encNo
                // Keep counts as 0 since we can't decrypt
                actualYesCount = 0
                actualNoCount = 0
                totalVotes = 0
              } catch (encErr) {
                console.warn(`⚠️ Could not fetch encrypted counts for proposal ${i}`, encErr)
              }
            }
          } else {
            try {
              const [encYes, encNo] = await contractToUse.getEncryptedVoteCount(i)
              encryptedYesCount = encYes
              encryptedNoCount = encNo
            } catch (err) {
              console.warn(`⚠️ Could not fetch encrypted counts for proposal ${i}`, err)
            }
          }
      
          loadedProposals.push({
            id: i,
            description: proposal.description,
            yesCount: actualYesCount,
            noCount: actualNoCount,
            isPublic,
            createdAt: new Date(),
            encryptedYesCount,
            encryptedNoCount,
            totalVotes,
          })
        } catch (error) {
          console.error(`❌ Error loading proposal ${i}:`, error)
        }
      }
      

      setProposals(loadedProposals.reverse()) // Show newest first
    } catch (error) {
      console.error("Error loading proposals:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const createProposal = async (description: string) => {
    if (!contract || !account) {
      throw new Error("Wallet not connected")
    }

    try {
      setIsLoading(true)

      const tx = await contract.createProposal(description)
      await tx.wait()

      // Refresh proposals
      await loadProposals()
    } catch (error) {
      console.error("Error creating proposal:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const validateNetwork = () => {
    if (!isCorrectNetwork) {
      alert(`This app only supports ${SEPOLIA_NETWORK_NAME} network. Please switch to ${SEPOLIA_NETWORK_NAME} in your wallet.`)
      return false
    }
    return true
  }

  const vote = async (proposalId: number, voteValue: boolean) => {
    if (!contract || !account) {
      throw new Error("Wallet not connected")
    }

    if (!fheInitialized) {
      throw new Error("FHE service not initialized. Please wait for initialization to complete.")
    }

    // Validate network before voting
    if (!validateNetwork()) {
      return
    }

    try {
      setIsLoading(true)

      // Check if proposal is public - if so, voting is closed
      const [yesCount, noCount, isPublic] = await contract.getPublicVoteCounts(proposalId)
      if (isPublic) {
        throw new Error("Voting is closed for this proposal. Results have been made public.")
      }

      // Convert boolean vote to numeric value for FHE
      const numericVote = voteValue ? VOTE_OPTIONS.YES : VOTE_OPTIONS.NO
      
      console.log('Starting FHE encryption for vote:', {
        proposalId,
        voteValue,
        numericVote,
        voteOptions: VOTE_OPTIONS,
        fheInitialized,
        fheLoading,
        fheError
      })
      
      // Validate vote value matches contract enum
      if (numericVote !== 0 && numericVote !== 1) {
        throw new Error(`Invalid vote value: ${numericVote}. Must be 0 (Yes) or 1 (No)`);
      }
      
      // Check if fheEncrypt is available
      if (!fheEncrypt) {
        throw new Error("FHE encrypt function not available")
      }
      
      // Use real FHE encryption
      const encryptedVote = await fheEncrypt(numericVote)
      
      console.log('FHE encryption successful:', encryptedVote)
      console.log('Contract vote call params:', {
        proposalId,
        encryptedValue: encryptedVote.encryptedValue,
        proof: encryptedVote.proof,
        contractAddress: contract.target
      })

      const tx = await contract.vote(proposalId, encryptedVote.encryptedValue, encryptedVote.proof)
      await tx.wait()

      // Refresh proposals
      await loadProposals()
    } catch (error: any) {
      console.error("Error voting:", error)
      
      // Handle specific contract errors
      if (error?.message?.includes('Already voted')) {
        throw new Error('You have already voted on this proposal. Each user can only vote once.')
      }
      
      if (error?.message?.includes('Invalid proposal')) {
        throw new Error('Invalid proposal ID. Please refresh and try again.')
      }
      
      if (error?.message?.includes('Voting is closed')) {
        throw new Error('Voting is closed for this proposal. Results have been made public.')
      }
      
      const errorMessage = handleFHEError(error)
      throw new Error(`Voting failed: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const makeVoteCountsPublic = async (proposalId: number) => {
    if (!contract || !account) {
      throw new Error("Wallet not connected")
    }

    try {
      setIsLoading(true)

      console.log(`Making vote counts public for proposal ${proposalId}...`)
      console.log('Contract address:', contract.target)
      console.log('User address:', account)
      
      // Check if proposal exists and current state
      try {
        const proposal = await contract.proposals(proposalId)
        console.log('Proposal exists:', !!proposal)
        
        // Check if already public
        const [yesCount, noCount, isPublic] = await contract.getPublicVoteCounts(proposalId)
        console.log('Current proposal state:', { yesCount: Number(yesCount), noCount: Number(noCount), isPublic })
        
        if (isPublic) {
          throw new Error('Vote counts are already public')
        }
      } catch (checkError) {
        console.log('Error checking proposal state:', checkError)
      }

      // Try to estimate gas first to catch errors early
      try {
        const gasEstimate = await contract.makeVoteCountsPublic.estimateGas(proposalId)
        console.log('Gas estimate:', gasEstimate.toString())
      } catch (estimateError: any) {
        console.error('Gas estimation failed:', estimateError)
        
        // Handle specific custom errors
        if (estimateError?.data) {
          const errorData = estimateError.data
          console.log('Error data:', errorData)
          
          // Check for specific error signatures
          if (errorData.includes('0xd0d25976')) {
            throw new Error('Custom error: Vote counts cannot be made public (possibly no votes cast yet)')
          }
          
          if (errorData.includes('0x4e487b71')) {
            throw new Error('Custom error: Invalid proposal ID')
          }
        }
        
        throw new Error(`Gas estimation failed: ${estimateError?.message || 'Unknown error'}`)
      }

      const tx = await contract.makeVoteCountsPublic(proposalId)
      console.log('Transaction sent:', tx.hash)
      await tx.wait()
      console.log('Transaction confirmed')

      console.log(`Vote counts made public for proposal ${proposalId}`)

      // Try to decrypt vote counts immediately after making public
      if (fheInitialized) {
        try {
          const decryptedCounts = await decryptVoteCounts(proposalId);
          console.log(`Decrypted vote counts after making public:`, decryptedCounts);
        } catch (error) {
          console.log(`Could not decrypt vote counts immediately:`, error);
        }
      }

      // Refresh proposals
      await loadProposals()
    } catch (error: any) {
      console.error("Error making vote counts public:", error)
      
      // Handle specific contract errors
      if (error?.message?.includes('Vote counts already public')) {
        throw new Error('Vote counts are already public for this proposal.')
      }
      
      if (error?.message?.includes('Invalid proposal')) {
        throw new Error('Invalid proposal ID. Please refresh and try again.')
      }
      
      if (error?.message?.includes('Custom error:')) {
        throw error // Re-throw custom error messages
      }
      
      throw new Error(`Failed to make vote counts public: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const hasUserVoted = async (proposalId: number): Promise<boolean> => {
    if (!contract || !account) {
      return false
    }

    try {
      const voted = await contract.hasUserVoted(proposalId, account)
      console.log(`User ${account} has voted on proposal ${proposalId}:`, voted)
      return voted
    } catch (error: any) {
      console.error("Error checking if user voted:", error)
      // Return false on error to allow user to try voting
      return false
    }
  }

  const getMyVote = async (proposalId: number): Promise<string> => {
    if (!contract || !account) {
      throw new Error("Wallet not connected")
    }

    try {
      const encryptedVote = await contract.getMyVote(proposalId)
      console.log(`Encrypted vote for proposal ${proposalId}:`, encryptedVote)
      return encryptedVote
    } catch (error: any) {
      console.error("Error getting my vote:", error)
      
      // Handle custom errors
      if (error?.data) {
        const errorData = error.data
        
        // Check for custom error signatures
        if (errorData.includes('0x4e487b71')) {
          throw new Error('Invalid proposal ID')
        }
        
        if (errorData.includes('0x4e487b72')) {
          throw new Error('You have not voted on this proposal yet')
        }
        
        if (errorData.includes('0xd0d25976')) {
          throw new Error('FHE permission denied - you may not have voted or FHE is not properly initialized')
        }
      }
      
      throw new Error(`Failed to get my vote: ${error?.message || 'Unknown error'}`)
    }
  }

  const getPublicVoteCounts = async (proposalId: number): Promise<{yesCount: number, noCount: number, isPublic: boolean}> => {
    if (!contract) {
      throw new Error("Contract not connected")
    }

    try {
      const [yesCount, noCount, isPublic] = await contract.getPublicVoteCounts(proposalId)
      return {
        yesCount: Number(yesCount),
        noCount: Number(noCount),
        isPublic: Boolean(isPublic)
      }
    } catch (error) {
      console.error("Error getting public vote counts:", error)
      return { yesCount: 0, noCount: 0, isPublic: false }
    }
  }

  const isProposalOwner = async (proposalId: number): Promise<boolean> => {
    if (!contract || !account) return false;
    try {
      const result = await contract.isProposalOwner(proposalId, account);
      return result;
    } catch (error: any) {
      console.error("Error checking proposal ownership:", error);
      return false;
    }
  };

  const decryptVoteCounts = async (proposalId: number): Promise<{yesCount: number, noCount: number}> => {
    if (!contract || !fheInitialized) {
      throw new Error("Contract or FHE not initialized")
    }

    try {
      // Get encrypted vote counts
      const [encryptedYes, encryptedNo] = await contract.getEncryptedVoteCount(proposalId)
      
      console.log('Encrypted vote counts:', { encryptedYes, encryptedNo })
      
      // Use FHE SDK to decrypt vote counts
      const decryptedYes = await fhePublicDecrypt(encryptedYes)
      const decryptedNo = await fhePublicDecrypt(encryptedNo)
      
      console.log('Decrypted vote counts:', { decryptedYes, decryptedNo })
      
      return {
        yesCount: Number(decryptedYes),
        noCount: Number(decryptedNo)
      }
    } catch (error: any) {
      console.error("Error decrypting vote counts:", error)
      throw new Error(`Failed to decrypt vote counts: ${error?.message || 'Unknown error'}`)
    }
  }

  const refreshProposals = async () => {
    await loadProposals()
  }

  const switchToSepolia = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask!")
      return
    }

    try {
      // Try to switch to Sepolia network
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
      })
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
                chainName: SEPOLIA_NETWORK_NAME,
                nativeCurrency: {
                  name: "Sepolia Ether",
                  symbol: "SEP",
                  decimals: 18,
                },
                rpcUrls: [SEPOLIA_RPC_URL],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          })
        } catch (addError) {
          console.error("Error adding Sepolia network:", addError)
          alert("Failed to add Sepolia network to MetaMask")
        }
      } else {
        console.error("Error switching to Sepolia network:", switchError)
        alert("Failed to switch to Sepolia network")
      }
    }
  }

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        console.log('Account changed:', accounts)
        if (accounts.length === 0) {
          disconnectWallet()
        } else {
          const newAccount = accounts[0]
          console.log('New account:', newAccount)
          
          // Reload page when account changes to ensure proper FHE re-initialization
          // This is the safest approach since FHE service needs to be re-initialized with new account
          window.location.reload()
        }
      }

      const handleChainChanged = (chainId: string) => {
        console.log('Chain changed:', chainId)
        setChainId(Number.parseInt(chainId, 16))
        // Reload page when chain changes to ensure proper initialization
        window.location.reload()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
        window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [fheInitialized, contract, chainId])

  const value: Web3ContextType = {
    account,
    isConnected,
    isConnecting,
    chainId,
    isCorrectNetwork,
    networkName,
    contract,
    proposals,
    isLoading,
    fheStatus: {
      initialized: fheInitialized,
      loading: fheLoading,
      error: fheError,
      sdkAvailable: fheInitialized && !fheError
    },
    connectWallet,
    disconnectWallet,
    switchToSepolia,
    createProposal,
    vote,
    makeVoteCountsPublic,
    hasUserVoted,
    getMyVote,
    getPublicVoteCounts,
    decryptVoteCounts,
    refreshProposals,
    isProposalOwner,
    fheDecrypt,
    fheUserDecrypt,
  }

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>
}

export function useWeb3() {
  const context = useContext(Web3Context)
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider")
  }
  return context
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}
