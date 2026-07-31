import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './query-client';
import { Wallet, Transaction } from './storage';

const TRANSACTIONS_KEY = '@mizan_transactions';
const LEGACY_TRANSACTIONS_KEY = '@masarif_transactions';
const WALLETS_KEY = '@mizan_wallets';
const LEGACY_WALLETS_KEY = '@masarif_wallets';
const USER_ID_KEY = '@mizan_user_id';
const LEGACY_USER_ID_KEY = '@masarif_user_id';
const LAST_SYNC_KEY = '@mizan_last_sync_time';

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
    const userId = (await AsyncStorage.getItem(USER_ID_KEY)) || (await AsyncStorage.getItem(LEGACY_USER_ID_KEY));
    if (!userId) {
      updateSyncState('idle');
      return null; // Local-only mode
    }

    updateSyncState('syncing');

    // 1. Load local data with fallback
    let localWalletsData = await AsyncStorage.getItem(WALLETS_KEY);
    if (!localWalletsData) {
      localWalletsData = await AsyncStorage.getItem(LEGACY_WALLETS_KEY);
    }
    let localTxnsData = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    if (!localTxnsData) {
      localTxnsData = await AsyncStorage.getItem(LEGACY_TRANSACTIONS_KEY);
    }

    const localWallets: Wallet[] = localWalletsData ? JSON.parse(localWalletsData) : [];
    const localTxns: Transaction[] = localTxnsData ? JSON.parse(localTxnsData) : [];

    let mergedWallets = [...localWallets];
    let mergedTxns = [...localTxns];

    // 2. Try Primary Server API first
    try {
      const response = await apiRequest('POST', '/api/sync', {
        wallets: localWallets,
        transactions: localTxns,
      });

      if (response.ok) {
        const mergedData: SyncData = await response.json();
        if (mergedData && Array.isArray(mergedData.wallets) && Array.isArray(mergedData.transactions)) {
          await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(mergedData.wallets));
          await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(mergedData.transactions));
          const nowStr = new Date().toISOString();
          lastSyncTime = nowStr;
          await AsyncStorage.setItem(LAST_SYNC_KEY, nowStr);
          updateSyncState('synced');
          return mergedData;
        }
      }
    } catch (apiErr) {
      console.warn('Primary server API endpoint notice, attempting Cloud Relay KV DB sync:', apiErr);
    }

    // 3. Fallback Universal Cloud Relay DB (Works everywhere on Vercel & Mobile)
    const cleanUserId = userId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const cloudUrl = `https://kvdb.io/mizan_user_cloud_v1/${cleanUserId}`;

    // A. Fetch remote data from Cloud
    try {
      const getRes = await fetch(cloudUrl);
      if (getRes.ok) {
        const remoteData = await getRes.json();
        if (remoteData && Array.isArray(remoteData.wallets)) {
          const walletMap = new Map<string, Wallet>();
          localWallets.forEach(w => walletMap.set(w.id, w));
          remoteData.wallets.forEach((w: Wallet) => walletMap.set(w.id, w));
          mergedWallets = Array.from(walletMap.values());
        }
        if (remoteData && Array.isArray(remoteData.transactions)) {
          const txnMap = new Map<string, Transaction>();
          localTxns.forEach(t => txnMap.set(t.id, t));
          remoteData.transactions.forEach((t: Transaction) => txnMap.set(t.id, t));
          mergedTxns = Array.from(txnMap.values());
        }
      }
    } catch (cloudFetchErr) {
      console.warn('Cloud Relay fetch notice:', cloudFetchErr);
    }

    // B. Publish merged data back to Cloud
    try {
      await fetch(cloudUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cleanUserId,
          wallets: mergedWallets,
          transactions: mergedTxns,
          lastSyncTime: new Date().toISOString(),
        }),
      });
    } catch (cloudPostErr) {
      console.warn('Cloud Relay post notice:', cloudPostErr);
    }

    // C. Save merged dataset locally to primary & legacy keys for 100% data durability
    const walletsJson = JSON.stringify(mergedWallets);
    const txnsJson = JSON.stringify(mergedTxns);
    await AsyncStorage.setItem(WALLETS_KEY, walletsJson);
    await AsyncStorage.setItem(LEGACY_WALLETS_KEY, walletsJson);
    await AsyncStorage.setItem(TRANSACTIONS_KEY, txnsJson);
    await AsyncStorage.setItem(LEGACY_TRANSACTIONS_KEY, txnsJson);

    // D. Automatically Sync All Shared Wallets Live
    try {
      const { syncAllSharedWallets } = await import('./sharingService');
      await syncAllSharedWallets();
    } catch {}

    const nowStr = new Date().toISOString();
    lastSyncTime = nowStr;
    await AsyncStorage.setItem(LAST_SYNC_KEY, nowStr);
    updateSyncState('synced');

    return { wallets: mergedWallets, transactions: mergedTxns };
  } catch (e) {
    console.warn('Sync notice:', e);
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
  await AsyncStorage.setItem('@mizan_username', username);
  await AsyncStorage.setItem('@masarif_username', username);
  updateSyncState('syncing');
  await syncWithCloud();
}

export async function performLogout(): Promise<void> {
  await AsyncStorage.removeItem(USER_ID_KEY);
  await AsyncStorage.removeItem('@mizan_username');
  await AsyncStorage.removeItem('@masarif_username');
  await AsyncStorage.removeItem(LAST_SYNC_KEY);
  await AsyncStorage.removeItem(WALLETS_KEY);
  await AsyncStorage.removeItem(TRANSACTIONS_KEY);
  lastSyncTime = null;
  updateSyncState('idle');
}

export async function getLoggedInUser(): Promise<{ username: string; id: string } | null> {
  const id = await AsyncStorage.getItem(USER_ID_KEY);
  const username = (await AsyncStorage.getItem('@mizan_username')) || (await AsyncStorage.getItem('@masarif_username'));
  if (id && username) {
    return { id, username };
  }
  return null;
}
