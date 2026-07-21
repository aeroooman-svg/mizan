import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  Wallet,
  CurrencyCode,
  getWallets,
  saveWallet as saveWalletToStorage,
  deleteWallet as deleteWalletFromStorage,
  getSelectedWalletId,
  setSelectedWalletId as setSelectedWalletIdStorage,
} from './storage';
import * as Crypto from 'expo-crypto';

interface WalletContextValue {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  selectedWalletId: string | null;
  isLoading: boolean;
  addWallet: (
    name: string,
    currency: CurrencyCode,
    icon: string,
    color: string,
    cardStyle?: 'classic' | 'glass' | 'futuristic' | 'minimal',
    sharedWith?: string
  ) => Promise<Wallet>;
  removeWallet: (id: string) => Promise<void>;
  selectWallet: (id: string) => Promise<void>;
  refreshWallets: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWallets = useCallback(async () => {
    setIsLoading(true);
    try {
      const [wlts, selId] = await Promise.all([getWallets(), getSelectedWalletId()]);
      setWallets(wlts);
      if (selId && wlts.some((w) => w.id === selId)) {
        setSelectedWalletIdState(selId);
      } else if (wlts.length > 0) {
        setSelectedWalletIdState(wlts[0].id);
        await setSelectedWalletIdStorage(wlts[0].id);
      } else {
        setSelectedWalletIdState(null);
      }
    } catch (e) {
      console.error('Error loading wallets:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const selectWallet = async (id: string) => {
    setSelectedWalletIdState(id);
    await setSelectedWalletIdStorage(id);
  };

  const addWallet = async (
    name: string,
    currency: CurrencyCode,
    icon: string,
    color: string,
    cardStyle?: 'classic' | 'glass' | 'futuristic' | 'minimal',
    sharedWith?: string
  ): Promise<Wallet> => {
    const newWallet: Wallet = {
      id: Crypto.randomUUID(),
      name,
      currency,
      icon,
      color,
      cardStyle,
      sharedWith,
      createdAt: new Date().toISOString(),
    };
    await saveWalletToStorage(newWallet);
    await loadWallets();
    await selectWallet(newWallet.id);
    return newWallet;
  };

  const removeWallet = async (id: string) => {
    await deleteWalletFromStorage(id);
    await loadWallets();
  };

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) || null;

  return (
    <WalletContext.Provider
      value={{
        wallets,
        selectedWallet,
        selectedWalletId,
        isLoading,
        addWallet,
        removeWallet,
        selectWallet,
        refreshWallets: loadWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallets() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallets must be used within a WalletProvider');
  }
  return ctx;
}
