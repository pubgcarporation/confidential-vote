import { useState, useEffect, useCallback } from 'react';
import fheService, { FHEInstance, FHEConfig } from '../lib/fheService';

interface UseFHEReturn {
  fheInstance: FHEInstance | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  isSDKAvailable: boolean;
  encrypt: (value: number) => Promise<{ encryptedValue: string; proof: string }>;
  decrypt: (encryptedValue: string) => Promise<number>;
  publicDecrypt: (encryptedValue: string) => Promise<number>;
  userDecrypt: (encryptedValue: string) => Promise<number>;
  refreshInstance: () => Promise<void>;
  resetFHE: () => void;
}

export const useFHE = (config?: FHEConfig): UseFHEReturn => {
  const [fheInstance, setFheInstance] = useState<FHEInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSDKAvailable, setIsSDKAvailable] = useState(false);

  const initializeFHE = useCallback(async (fheConfig?: FHEConfig) => {
    // Only initialize on client side
    if (typeof window === "undefined") {
      console.log('Skipping FHE initialization on server side');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Initializing FHE service...', fheConfig);
      const instance = await fheService.createInstance(fheConfig || { network: (window as any).ethereum });
      setFheInstance(instance);
      setIsInitialized(true);
      setIsSDKAvailable(true);
      console.log('FHE service initialized successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize FHE service';
      setError(errorMessage);
      console.error('FHE initialization error:', err);
      
      // Reset state on error
      setIsInitialized(false);
      setFheInstance(null);
      setIsSDKAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshInstance = useCallback(async () => {
    console.log('Refreshing FHE instance...');
    setIsInitialized(false);
    setFheInstance(null);
    setError(null);
    await initializeFHE(config);
  }, [config, initializeFHE]);

  const resetFHE = useCallback(() => {
    console.log('Resetting FHE service...');
    fheService.reset();
    setIsInitialized(false);
    setFheInstance(null);
    setError(null);
    setIsLoading(false);
    setIsSDKAvailable(false);
  }, []);

  // Initialize FHE when config changes
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") {
      return;
    }

    if (config && !isInitialized && !isLoading) {
      initializeFHE(config);
    } else if (!config && isInitialized) {
      // Reset FHE when config becomes undefined (wallet disconnected)
      resetFHE();
    }
  }, [config, isInitialized, isLoading, initializeFHE, resetFHE]);

  // Wrapper functions that check if FHE is initialized
  const encrypt = useCallback(async (value: number): Promise<{ encryptedValue: string; proof: string }> => {
    console.log('FHE encrypt called with value:', value, 'fheInstance:', !!fheInstance);
    if (!fheInstance) {
      throw new Error('FHE service not initialized. Please wait for initialization to complete.');
    }
    try {
      const result = await fheInstance.encrypt(value);
      console.log('FHE encrypt result:', result);
      return result;
    } catch (error) {
      console.error('FHE encrypt error:', error);
      throw error;
    }
  }, [fheInstance]);

  const decrypt = useCallback(async (encryptedValue: string): Promise<number> => {
    console.log('FHE decrypt called with value:', encryptedValue, 'fheInstance:', !!fheInstance);
    if (!fheInstance) {
      throw new Error('FHE service not initialized. Please wait for initialization to complete.');
    }
    try {
      const result = await fheInstance.decrypt(encryptedValue);
      console.log('FHE decrypt result:', result);
      return result;
    } catch (error) {
      console.error('FHE decrypt error:', error);
      throw error;
    }
  }, [fheInstance]);

  const publicDecrypt = useCallback(async (encryptedValue: string): Promise<number> => {
    console.log('FHE publicDecrypt called with value:', encryptedValue, 'fheInstance:', !!fheInstance);
    if (!fheInstance) {
      throw new Error('FHE service not initialized. Please wait for initialization to complete.');
    }
    try {
      const result = await fheInstance.publicDecrypt(encryptedValue);
      console.log('FHE publicDecrypt result:', result);
      return result;
    } catch (error) {
      console.error('FHE publicDecrypt error:', error);
      throw error;
    }
  }, [fheInstance]);

  const userDecrypt = useCallback(async (encryptedValue: string): Promise<number> => {
    console.log('FHE userDecrypt called with value:', encryptedValue, 'fheInstance:', !!fheInstance);
    if (!fheInstance) {
      throw new Error('FHE service not initialized. Please wait for initialization to complete.');
    }
    try {
      const result = await fheInstance.userDecrypt(encryptedValue);
      console.log('FHE userDecrypt result:', result);
      return result;
    } catch (error) {
      console.error('FHE userDecrypt error:', error);
      throw error;
    }
  }, [fheInstance]);

  return {
    fheInstance,
    isInitialized,
    isLoading,
    error,
    isSDKAvailable,
    encrypt,
    decrypt,
    publicDecrypt,
    userDecrypt,
    refreshInstance,
    resetFHE
  };
}; 