"use client";

// Unified FHE Service using Zama SDK via CDN
// This replaces both zamaService.ts and fheService.ts

import { ethers } from 'ethers';
import { CONFIDENTIAL_VOTING_ADDRESS } from './contracts';

// Types for FHE operations
export interface FHEInstance {
  encrypt: (value: number) => Promise<{ encryptedValue: string; proof: string }>;
  decrypt: (encryptedValue: string) => Promise<number>;
  publicDecrypt: (encryptedValue: string) => Promise<number>;
  userDecrypt: (encryptedValue: string) => Promise<number>;
}

export interface FHEConfig {
  network: any;
  rpcUrl?: string;
  chainId?: number;
  account?: string;
}

export interface EncryptedVote {
  encryptedValue: string; // externalEuint8 as bytes32
  proof: string; // bytes
}

// Vote options
export const VOTE_OPTIONS = {
  YES: 0,
  NO: 1,
} as const;

// Zama SDK interface
interface ZamaInstance {
  createEncryptedInput: (contractAddress: string, userAddress: string) => Promise<any>; // Returns buffer object
  userDecrypt: (handleContractPairs: any[], privateKey: string, publicKey: string, signature: string, contractAddresses: string[], userAddress: string, startTimeStamp: string, durationDays: string) => Promise<Record<string, any>>;
  publicDecrypt: (handles: string[]) => Promise<Record<string, any>>;
  generateKeypair: () => Promise<{ publicKey: string; privateKey: string }>;
  getPublicKey: () => Promise<string>;
  getPublicParams: () => Promise<any>;
  createEIP712: (publicKey: string, contractAddresses: string[], startTimeStamp: string, durationDays: string) => Promise<any>;
}

// Global state for SDK loading
let sdkLoaded = false;
let sdkLoadPromise: Promise<void> | null = null;

// Load Zama SDK from CDN
const loadZamaSDKFromCDN = async (): Promise<void> => {
  if (typeof window === "undefined") {
    throw new Error("Zama SDK can only be loaded on client side");
  }

  if (sdkLoaded) {
    console.log('Zama SDK already loaded');
    return;
  }

  if (sdkLoadPromise) {
    console.log('Zama SDK loading already in progress, waiting...');
    await sdkLoadPromise;
    return;
  }

  console.log('Starting to load Zama SDK from CDN...');
  
  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    // Check if SDK is already loaded
    if ((window as any).initSDK && (window as any).createInstance) {
      console.log('Zama SDK already available in window');
      sdkLoaded = true;
      resolve();
      return;
    }

    // Try CDN first
    const tryCDN = () => {
      const script = document.createElement('script');
      script.src = 'https://cdn.zama.ai/relayer-sdk-js/0.1.0-9/relayer-sdk-js.umd.cjs';
      script.type = 'text/javascript';
      
      script.onload = () => {
        console.log('Zama SDK script loaded from CDN');
        
        // Wait a bit for the script to initialize
        setTimeout(() => {
          console.log('Checking SDK availability after CDN load...');
          console.log('window.initSDK:', typeof (window as any).initSDK);
          console.log('window.createInstance:', typeof (window as any).createInstance);
          console.log('window.SepoliaConfig:', typeof (window as any).SepoliaConfig);
          
          if ((window as any).initSDK && (window as any).createInstance) {
            console.log('Zama SDK loaded from CDN successfully');
            sdkLoaded = true;
            resolve();
          } else {
            console.log('CDN failed, trying dynamic import...');
            tryDynamicImport();
          }
        }, 2000); // Wait 2 seconds for initialization
      };
      
      script.onerror = () => {
        console.log('CDN failed, trying dynamic import...');
        tryDynamicImport();
      };

      document.head.appendChild(script);
    };

    // Fallback to dynamic import
    const tryDynamicImport = async () => {
      try {
        console.log('Trying dynamic import...');
        const module = await import("@zama-fhe/relayer-sdk/bundle");
        const sdk = (module as any).default || module;
        
        console.log('Dynamic import successful:', Object.keys(sdk));
        
        // Assign to window for consistency
        (window as any).initSDK = sdk.initSDK;
        (window as any).createInstance = sdk.createInstance;
        (window as any).SepoliaConfig = sdk.SepoliaConfig;
        
        if ((window as any).initSDK && (window as any).createInstance) {
          console.log('Zama SDK loaded via dynamic import successfully');
          sdkLoaded = true;
          resolve();
        } else {
          reject(new Error('SDK functions not available after dynamic import'));
        }
      } catch (error) {
        console.error('Dynamic import also failed:', error);
        reject(new Error('Both CDN and dynamic import failed'));
      }
    };

    // Start with CDN
    tryCDN();
    
    // Timeout after 15 seconds
    setTimeout(() => {
      if (!sdkLoaded) {
        console.error('Zama SDK load timeout');
        reject(new Error('Zama SDK load timeout'));
      }
    }, 15000);
  });

  await sdkLoadPromise;
};

// Initialize Zama SDK
const initializeZamaSDK = async (): Promise<void> => {
  await loadZamaSDKFromCDN();
  
  if (!(window as any).initSDK) {
    throw new Error('Zama SDK not available after loading');
  }

  console.log('Initializing Zama SDK...');
  await (window as any).initSDK();
  console.log('Zama SDK initialized successfully');
};

// Create Zama instance
const createZamaInstance = async (config: FHEConfig): Promise<ZamaInstance> => {
  await initializeZamaSDK();

  if (!(window as any).createInstance || !(window as any).SepoliaConfig) {
    throw new Error('Zama SDK functions not available');
  }

  console.log('Creating Zama instance with config:', {
    network: config.network,
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    account: config.account
  });

  const sdkConfig = { ...(window as any).SepoliaConfig, network: config.network };
  console.log('SDK config:', sdkConfig);

  try {
    const instance = await (window as any).createInstance(sdkConfig);
    console.log('Zama instance created successfully');
    console.log('Instance type:', typeof instance);
    console.log('Instance keys:', Object.keys(instance));
    console.log('Instance methods:', Object.getOwnPropertyNames(instance));
    console.log('Instance prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
    return instance;
  } catch (error: any) {
    console.error('Failed to create Zama instance:', error);
    throw new Error(`Failed to create Zama instance: ${error?.message || 'Unknown error'}`);
  }
};

// Main FHE Service class
class FHEService {
  private instance: ZamaInstance | null = null;
  private currentConfig: FHEConfig | null = null;
  private initPromise: Promise<ZamaInstance> | null = null;
  private decryptCache: Map<string, { value: number; timestamp: number }> = new Map();
  private readonly DECRYPT_CACHE_DURATION = 30000; // 30 seconds

  private configChanged(newConfig: FHEConfig): boolean {
    if (!this.currentConfig) return true;
    
    return (
      this.currentConfig.account !== newConfig.account ||
      this.currentConfig.chainId !== newConfig.chainId ||
      this.currentConfig.rpcUrl !== newConfig.rpcUrl
    );
  }

  async getInstance(config: FHEConfig): Promise<ZamaInstance> {
    // Check if config changed, if so, reset instance
    if (this.configChanged(config)) {
      console.log('Config changed, creating new Zama instance...');
      this.reset();
    }

    if (this.instance) {
      return this.instance;
    }

    if (this.initPromise) {
      return await this.initPromise;
    }

    this.currentConfig = config;
    this.initPromise = createZamaInstance(config);
    this.instance = await this.initPromise;
    return this.instance;
  }

  async createInstance(config: FHEConfig): Promise<FHEInstance> {
    const zamaInstance = await this.getInstance(config);
    
    return {
      encrypt: async (value: number): Promise<{ encryptedValue: string; proof: string }> => {
        return await this.encrypt(value, config);
      },
      
      decrypt: async (encryptedValue: string): Promise<number> => {
        return await this.decrypt(encryptedValue, config);
      },
      
      publicDecrypt: async (encryptedValue: string): Promise<number> => {
        return await this.publicDecrypt(encryptedValue, config);
      },
      userDecrypt: async (encryptedValue: string): Promise<number> => {
        return await this.userDecrypt(encryptedValue, config);
      }
    };
  }

  async encrypt(value: number, config: FHEConfig): Promise<{ encryptedValue: string; proof: string }> {
    const instance = await this.getInstance(config);
    console.log(`Encrypting value: ${value}`);
    console.log('Instance in encrypt:', instance);
    console.log('Instance type:', typeof instance);
    console.log('Instance keys:', Object.keys(instance));
    console.log('Instance.createEncryptedInput:', typeof instance.createEncryptedInput);
    
    try {
      if (!config.account) {
        throw new Error('User address is required for FHE encryption. Please connect your wallet first.');
      }
      
      // Create encrypted input buffer (don't pass value here)
      const buffer = await instance.createEncryptedInput(CONFIDENTIAL_VOTING_ADDRESS, config.account);
      console.log('Created encrypted input buffer:', buffer);
      console.log('Buffer methods:', Object.getOwnPropertyNames(buffer));
      console.log('Buffer prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(buffer)));
      console.log('Available add methods:', {
        add8: typeof buffer.add8,
        add16: typeof buffer.add16,
        add32: typeof buffer.add32,
        add128: typeof buffer.add128
      });
      
      // Add the value to the buffer using add8 (for euint8 in contract)
      if (typeof buffer.add8 === 'function') {
        buffer.add8(value);
      } else if (typeof buffer.add16 === 'function') {
        buffer.add16(value);
      } else if (typeof buffer.add32 === 'function') {
        buffer.add32(value);
      } else if (typeof buffer.add128 === 'function') {
        buffer.add128(value);
      } else {
        throw new Error('No suitable add method found on buffer');
      }
      
      // Encrypt the buffer to get ciphertext handles
      const ciphertexts = await buffer.encrypt();
      console.log('Ciphertexts result:', ciphertexts);
      
      // Extract encrypted value and proof
      const handleArray = Array.from(ciphertexts.handles[0]) as number[];
      const encryptedValue = '0x' + handleArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
      
      const proofArray = Array.from(ciphertexts.inputProof) as number[];
      const proof = '0x' + proofArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
      
      console.log('Final encryption result:', { encryptedValue, proof });
      return { encryptedValue, proof };
    } catch (error: any) {
      console.error('Encryption failed:', error);
      throw new Error(`Encryption failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async decrypt(encryptedValue: string, config: FHEConfig): Promise<number> {
    const instance = await this.getInstance(config);
    console.log(`Decrypting value: ${encryptedValue}`);
    
    // Check cache first
    const cached = this.decryptCache.get(encryptedValue);
    if (cached && Date.now() - cached.timestamp < this.DECRYPT_CACHE_DURATION) {
      console.log('Returning cached decryption result:', cached.value);
      return cached.value;
    }
    
    try {
      // Use publicDecrypt for backward compatibility
      const result = await this.publicDecrypt(encryptedValue, config);
      console.log('Decryption result:', result);
      
      // Cache the result
      this.decryptCache.set(encryptedValue, {
        value: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error: any) {
      console.error('Decryption failed:', error);
      throw new Error(`Decryption failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async publicDecrypt(encryptedValue: string, config: FHEConfig): Promise<number> {
    const instance = await this.getInstance(config);
    console.log(`Public decrypting value: ${encryptedValue}`);
    console.log(`Encrypted value type: ${typeof encryptedValue}`);
    console.log(`Encrypted value length: ${encryptedValue.length}`);
    
    try {
      // Check if encryptedValue is a valid hex string
      if (!encryptedValue.startsWith('0x')) {
        throw new Error('Encrypted value must be a hex string starting with 0x');
      }
      
      // Try to parse as hex and check if it's valid
      const hexValue = encryptedValue.slice(2); // Remove 0x prefix
      if (hexValue.length % 2 !== 0) {
        throw new Error('Invalid hex string length');
      }
      
      // Public decrypt expects an array of handles
      const handles = [encryptedValue];
      console.log('Calling publicDecrypt with handles:', handles);
      
      const result = await instance.publicDecrypt(handles);
      console.log('Public decryption result:', result);
      
      // Extract the decrypted value for our handle
      const decryptedValue = result[encryptedValue];
      console.log('Decrypted value for handle:', decryptedValue);
      
      if (decryptedValue === undefined) {
        throw new Error('No decrypted value found for the given handle');
      }
      
      // Convert to number
      const numericValue = typeof decryptedValue === 'bigint' ? Number(decryptedValue) : Number(decryptedValue);
      console.log('Numeric value:', numericValue);
      
      return numericValue;
    } catch (error: any) {
      console.error('Public decryption failed:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        encryptedValue: encryptedValue
      });
      throw new Error(`Public decryption failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async userDecrypt(encryptedValue: string, config: FHEConfig): Promise<number> {
    const instance = await this.getInstance(config);
    console.log(`User decrypting value: ${encryptedValue}`);
    
    try {
      if (!config.account) {
        throw new Error('User address is required for user decryption');
      }

      // Check cache first
      const cached = this.decryptCache.get(encryptedValue);
      if (cached && Date.now() - cached.timestamp < this.DECRYPT_CACHE_DURATION) {
        console.log('Returning cached user decryption result:', cached.value);
        return cached.value;
      }

      // Generate keypair for user
      const keypair = await instance.generateKeypair();
      console.log('Generated keypair:', {
        publicKey: keypair.publicKey?.substring(0, 20) + '...',
        privateKey: keypair.privateKey?.substring(0, 20) + '...'
      });
      
      // Prepare handle-contract pairs
      const handleContractPairs = [
        {
          handle: encryptedValue,
          contractAddress: CONFIDENTIAL_VOTING_ADDRESS,
        },
      ];
      
      // Prepare EIP712 signature data
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      const contractAddresses = [CONFIDENTIAL_VOTING_ADDRESS];
      
      const eip712 = await instance.createEIP712(
        keypair.publicKey, 
        contractAddresses, 
        startTimeStamp, 
        durationDays
      );
      
      console.log('EIP712 data:', eip712);
      
      // Get signer from window.ethereum
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // Sign the EIP712 data
      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );
      
      console.log('Signature:', signature);
      
      // Perform user decryption
      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        signer.address,
        startTimeStamp,
        durationDays,
      );
      
      console.log('User decryption result:', result);
      
      // Extract decrypted value
      const decryptedValue = result[encryptedValue];
      console.log('Decrypted value:', decryptedValue);
      
      const numericValue = Number(decryptedValue);
      
      // Cache the result
      this.decryptCache.set(encryptedValue, {
        value: numericValue,
        timestamp: Date.now()
      });
      
      return numericValue;
    } catch (error: any) {
      console.error('User decryption failed:', error);
      throw new Error(`User decryption failed: ${error?.message || 'Unknown error'}`);
    }
  }

  isReady(): boolean {
    return this.instance !== null;
  }

  isSDKAvailable(): boolean {
    return sdkLoaded && this.isReady();
  }

  getSDKStatus(): { initialized: boolean; sdkInstance: any; cdnAvailable: boolean } {
    return {
      initialized: this.isReady(),
      sdkInstance: this.isReady() ? 'Zama CDN Instance' : null,
      cdnAvailable: sdkLoaded
    };
  }

  reset(): void {
    console.log('Resetting FHE service...');
    this.instance = null;
    this.initPromise = null;
    this.clearDecryptCache();
  }

  clearDecryptCache(): void {
    this.decryptCache.clear();
  }

  getStatus(): { ready: boolean; sdkLoaded: boolean } {
    return {
      ready: this.isReady(),
      sdkLoaded
    };
  }
}

// Create singleton instance
const fheService = new FHEService();

// Export the service instance
export default fheService;

// Export utility functions
export const encryptVote = async (voteValue: number, config: FHEConfig): Promise<EncryptedVote> => {
  const instance = await fheService.createInstance(config);
  const result = await instance.encrypt(voteValue);
  return {
    encryptedValue: result.encryptedValue,
    proof: result.proof
  };
};

export const decryptVote = async (encryptedValue: string, config: FHEConfig): Promise<number> => {
  const instance = await fheService.createInstance(config);
  return await instance.decrypt(encryptedValue);
};

export const generateVoteProof = async (encryptedVote: EncryptedVote, config: FHEConfig): Promise<string> => {
  // For now, return the proof from the encrypted vote
  // In a real implementation, this might generate additional proofs
  return encryptedVote.proof;
};

export const validateVoteValue = (value: number): boolean => {
  return value === VOTE_OPTIONS.YES || value === VOTE_OPTIONS.NO;
};

export const getVoteOptionLabel = (value: number): string => {
  switch (value) {
    case VOTE_OPTIONS.YES:
      return 'Yes';
    case VOTE_OPTIONS.NO:
      return 'No';
    default:
      return 'Unknown';
  }
};

export const prepareVoteForContract = async (voteValue: number, config: FHEConfig): Promise<{
  encryptedVote: string;
  proof: string;
}> => {
  if (!validateVoteValue(voteValue)) {
    throw new Error(`Invalid vote value: ${voteValue}`);
  }

  const encryptedVote = await encryptVote(voteValue, config);
  
  return {
    encryptedVote: encryptedVote.encryptedValue,
    proof: encryptedVote.proof
  };
};

// Contract interaction utilities
export const getContractAddress = (): string => {
  return CONFIDENTIAL_VOTING_ADDRESS;
};

export const validateContractAddress = (address: string): boolean => {
  return address.toLowerCase() === CONFIDENTIAL_VOTING_ADDRESS.toLowerCase();
};

export const getFHEStatus = () => {
  return {
    isInitialized: fheService.isSDKAvailable(),
    sdkStatus: fheService.getSDKStatus(),
    serviceStatus: fheService.getStatus()
  };
};

export const handleFHEError = (error: any): string => {
  if (error?.message?.includes('getCoprocessorSigners')) {
    return 'Network does not support FHE. Please connect to Sepolia testnet.';
  }
  
  if (error?.message?.includes('Zama SDK can only be loaded on client side')) {
    return 'FHE SDK is not available on server side. Please try again.';
  }
  
  if (error?.message?.includes('Failed to load Zama SDK from CDN')) {
    return 'Failed to load FHE SDK from CDN. Please check your internet connection.';
  }
  
  return error?.message || 'Unknown FHE error occurred';
}; 