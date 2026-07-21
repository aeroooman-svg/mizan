import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './query-client';
import { Wallet, Transaction } from './storage';

const TRANSACTIONS_KEY = '@masarif_transactions';
const WALLETS_KEY = '@masarif_wallets';
const USER_ID_KEY = '@masarif_user_id';
const LAST_SYNC_KEY = '@masarif_last_sync_time';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncData {
  wallets: Wallet[];
  transactions: Transaction[];
}

type SyncListener = (state: SyncState, lastSyncTime: string | null) => void;

let currentSyncState: SyncState = 'idle';
let lastSyncTime: string | null = null;
const syncListeners: Set<SyncListener> = new Set();

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(currentSyncState, lastSyncTime);
  return () => syncListeners.delete(listener);
}

function updateSyncState(newState: SyncState) {
  currentSyncState = newState;
  syncListeners.forEach(listener => listener(currentSyncState, lastSyncTime));
}

export async function syncWithCloud(): Promise<SyncData | null> {
  try {
    const userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (!userId) {
      updateSyncState('idle');
      return null; // Local-only mode
    }

    updateSyncState('syncing');

    // 1. Load local data to sync up
    const localWalletsData = await AsyncStorage.getItem(WALLETS_KEY);
    const localTxnsData = await AsyncStorage.getItem(TRANSACTIONS_KEY);

    const localWallets: Wallet[] = localWalletsData ? JSON.parse(localWalletsData) : [];
    const localTxns: Transaction[] = localTxnsData ? JSON.parse(localTxnsData) : [];

    // 2. Perform sync request to server API
    const response = await apiRequest('POST', '/api/sync', {
      wallets: localWallets,
      transactions: localTxns,
    });

    if (!response.ok) {
      throw new Error('Sync server endpoint returned status ' + response.status);
    }

    const mergedData: SyncData = await response.json();

    // 3. Save merged data back to local cache
    if (mergedData && Array.isArray(mergedData.wallets) && Array.isArray(mergedData.transactions)) {
      await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(mergedData.wallets));
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(mergedData.transactions));
      
      const nowStr = new Date().toISOString();
      lastSyncTime = nowStr;
      await AsyncStorage.setItem(LAST_SYNC_KEY, nowStr);
      updateSyncState('synced');
      return mergedData;
    }

    updateSyncState('synced');
    return null;
  } catch (e) {
    console.warn('Real-time sync notice (fallback to local mode):', e);
    updateSyncState('offline');
    return null;
  }
}

export async function getLastSyncTime(): Promise<string | null> {
  if (lastSyncTime) return lastSyncTime;
  lastSyncTime = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return lastSyncTime;
}

export async function performLogin(username: string, userId: string): Promise<void> {
  await AsyncStorage.setItem(USER_ID_KEY, userId);
  await AsyncStorage.setItem('@masarif_username', username);
  updateSyncState('syncing');
  await syncWithCloud();
}

export async function performLogout(): Promise<void> {
  await AsyncStorage.removeItem(USER_ID_KEY);
  await AsyncStorage.removeItem('@masarif_username');
  await AsyncStorage.removeItem(LAST_SYNC_KEY);
  await AsyncStorage.removeItem(WALLETS_KEY);
  await AsyncStorage.removeItem(TRANSACTIONS_KEY);
  lastSyncTime = null;
  updateSyncState('idle');
}

export async function getLoggedInUser(): Promise<{ username: string; id: string } | null> {
  const id = await AsyncStorage.getItem(USER_ID_KEY);
  const username = await AsyncStorage.getItem('@masarif_username');
  if (id && username) {
    return { id, username };
  }
  return null;
}
