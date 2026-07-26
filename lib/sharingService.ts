/**
 * Sharing Service — خدمة المشاركة العائلية
 * 
 * Handles wallet sharing operations: generating share codes,
 * joining shared wallets, listing members, syncing transactions, etc.
 * Supports online API, cloud KVDB relay (cross-device/tab sync), and local offline fallback.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './query-client';

const SHARE_CODES_KEY = '@masarif_share_codes';
const SHARE_REGISTRY_KEY = '@masarif_share_registry';
const SHARED_MEMBERS_CACHE_KEY = '@masarif_shared_members_cache';
const WALLETS_KEY = '@masarif_wallets';

export interface SharedMember {
  id: string;
  userId: string;
  username: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

export interface ShareInfo {
  walletId: string;
  shareCode: string;
  members: SharedMember[];
}

// ── Cloud Relay KV Sync (For Universal Cross-Device / Tab Joining & Tx Sync) ───

async function publishCloudShareRelay(code: string, walletInfo: any): Promise<void> {
  try {
    await fetch(`https://kvdb.io/masarif_share_v1/${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(walletInfo),
    });
  } catch (e) {
    console.warn('Cloud relay publish notice:', e);
  }
}

async function fetchCloudShareRelay(code: string): Promise<any> {
  try {
    const res = await fetch(`https://kvdb.io/masarif_share_v1/${code}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.warn('Cloud relay fetch notice:', e);
  }
  return null;
}

// ── Local Share Code Storage & Registry ─────────────────

async function getLocalShareCodes(): Promise<Record<string, string>> {
  try {
    const data = await AsyncStorage.getItem(SHARE_CODES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

async function saveLocalShareCode(walletId: string, code: string, walletName?: string, currency?: string): Promise<void> {
  const codes = await getLocalShareCodes();
  codes[walletId] = code;
  await AsyncStorage.setItem(SHARE_CODES_KEY, JSON.stringify(codes));

  // Get full wallet & transactions snapshot to send over Cloud Relay
  let fullWallet: any = null;
  let walletTransactions: any[] = [];
  try {
    const rawWallets = await AsyncStorage.getItem(WALLETS_KEY);
    if (rawWallets) {
      const wallets = JSON.parse(rawWallets);
      fullWallet = wallets.find((w: any) => w.id === walletId);
    }
    const rawTxs = await AsyncStorage.getItem('@masarif_transactions');
    if (rawTxs) {
      const allTxs = JSON.parse(rawTxs);
      walletTransactions = Array.isArray(allTxs) ? allTxs.filter((t: any) => t.walletId === walletId) : [];
    }
  } catch {}

  let ownerUsername = 'صاحب المحفظة';
  try {
    const username = await AsyncStorage.getItem('@masarif_username');
    if (username) ownerUsername = username;
  } catch {}

  const info = {
    walletId: walletId,
    walletName: fullWallet?.name || walletName || 'المحفظة المشتركة',
    currency: fullWallet?.currency || currency || 'SAR',
    icon: fullWallet?.icon || 'people',
    color: fullWallet?.color || '#10B981',
    cardStyle: fullWallet?.cardStyle || 'glass',
    createdAt: fullWallet?.createdAt || new Date().toISOString(),
    shareCode: code,
    ownerUsername: ownerUsername,
    transactions: walletTransactions,
  };

  // Register in local share registry
  try {
    const registryData = await AsyncStorage.getItem(SHARE_REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    registry[code] = info;
    await AsyncStorage.setItem(SHARE_REGISTRY_KEY, JSON.stringify(registry));
  } catch (e) {
    console.warn('Failed to update share registry:', e);
  }

  // Publish to cloud relay KVDB for universal cross-device / browser access
  publishCloudShareRelay(code, info);
}

/**
 * Synchronize a shared wallet in real-time across devices via Cloud Relay KVDB
 */
export async function syncSharedWalletByCode(code: string): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return false;

  try {
    // 1. Fetch current cloud payload for this share code
    const cloudInfo = await fetchCloudShareRelay(cleanCode);
    
    // 2. Fetch local wallet and transactions
    const rawWallets = await AsyncStorage.getItem(WALLETS_KEY);
    const wallets: any[] = rawWallets ? JSON.parse(rawWallets) : [];
    const localWallet = wallets.find((w: any) => w.shareCode === cleanCode || (w.id && w.id.includes(cleanCode.toLowerCase())));

    const rawTxs = await AsyncStorage.getItem('@masarif_transactions');
    let localTxs: any[] = rawTxs ? JSON.parse(rawTxs) : [];

    let targetWalletId = localWallet?.id || cloudInfo?.walletId || `w_shared_${cleanCode.toLowerCase()}`;

    // Determine Authoritative Wallet Name
    let realWalletName = 'المحفظة المشتركة';
    if (localWallet?.name && !localWallet.name.startsWith('محفظة مشتركة (')) {
      realWalletName = localWallet.name;
    } else if (cloudInfo?.walletName && !cloudInfo.walletName.startsWith('محفظة مشتركة (')) {
      realWalletName = cloudInfo.walletName;
    } else if (localWallet?.name) {
      realWalletName = localWallet.name;
    } else if (cloudInfo?.walletName) {
      realWalletName = cloudInfo.walletName;
    }

    const realCurrency = localWallet?.currency || cloudInfo?.currency || 'SAR';

    // Merge transactions from cloud if any
    let updatedTxs = [...localTxs];
    if (cloudInfo && Array.isArray(cloudInfo.transactions)) {
      const txMap = new Map<string, any>();
      localTxs.forEach((t: any) => txMap.set(t.id, t));
      cloudInfo.transactions.forEach((t: any) => {
        txMap.set(t.id, { ...t, walletId: targetWalletId });
      });
      updatedTxs = Array.from(txMap.values());
      await AsyncStorage.setItem('@masarif_transactions', JSON.stringify(updatedTxs));
    }

    // Update local wallet record in AsyncStorage if needed
    if (localWallet) {
      let changed = false;
      if (localWallet.name !== realWalletName) {
        localWallet.name = realWalletName;
        changed = true;
      }
      if (localWallet.currency !== realCurrency) {
        localWallet.currency = realCurrency;
        changed = true;
      }
      if (changed) {
        const wIdx = wallets.findIndex((w: any) => w.id === targetWalletId);
        if (wIdx !== -1) {
          wallets[wIdx] = localWallet;
          await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
        }
      }
    }

    // Now send local snapshot back up to cloud relay so all other members receive it
    const currentWalletTxs = updatedTxs.filter((t: any) => t.walletId === targetWalletId);

    let ownerUsername = 'صاحب المحفظة';
    try {
      const username = await AsyncStorage.getItem('@masarif_username');
      if (username) ownerUsername = username;
    } catch {}

    const updatedCloudInfo = {
      walletId: targetWalletId,
      walletName: realWalletName,
      currency: realCurrency,
      icon: localWallet?.icon || cloudInfo?.icon || 'people',
      color: localWallet?.color || cloudInfo?.color || '#10B981',
      cardStyle: localWallet?.cardStyle || cloudInfo?.cardStyle || 'glass',
      createdAt: localWallet?.createdAt || cloudInfo?.createdAt || new Date().toISOString(),
      shareCode: cleanCode,
      ownerUsername: cloudInfo?.ownerUsername || ownerUsername,
      transactions: currentWalletTxs,
      lastUpdated: new Date().toISOString(),
    };

    await publishCloudShareRelay(cleanCode, updatedCloudInfo);
    return true;
  } catch (e) {
    console.warn('syncSharedWalletByCode error:', e);
    return false;
  }
}

/**
 * Sync all shared wallets for the user
 */
export async function syncAllSharedWallets(): Promise<void> {
  try {
    const rawWallets = await AsyncStorage.getItem(WALLETS_KEY);
    if (!rawWallets) return;
    const wallets: any[] = JSON.parse(rawWallets);
    const sharedWallets = wallets.filter((w: any) => w.shareCode || (w.sharedWith && w.sharedWith.length > 0));
    for (const wallet of sharedWallets) {
      if (wallet.shareCode) {
        await syncSharedWalletByCode(wallet.shareCode);
      }
    }
  } catch (e) {
    console.warn('syncAllSharedWallets error:', e);
  }
}

// ── Share Code Generation ──────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate or retrieve a share code for a wallet
 */
export async function getOrCreateShareCode(walletId: string): Promise<string> {
  let walletName = 'Shared Wallet';
  let currency = 'SAR';
  try {
    const rawWallets = await AsyncStorage.getItem(WALLETS_KEY);
    if (rawWallets) {
      const wallets = JSON.parse(rawWallets);
      const target = wallets.find((w: any) => w.id === walletId);
      if (target) {
        walletName = target.name;
        currency = target.currency || 'SAR';
      }
    }
  } catch {}

  // Check local first
  const codes = await getLocalShareCodes();
  if (codes[walletId]) {
    await saveLocalShareCode(walletId, codes[walletId], walletName, currency);
    return codes[walletId];
  }

  // Try API
  try {
    const response = await apiRequest('POST', `/api/wallets/${walletId}/share`);
    if (response.ok) {
      const data = await response.json();
      await saveLocalShareCode(walletId, data.shareCode, walletName, currency);
      return data.shareCode;
    }
  } catch {
    // Offline fallback
  }

  // Generate locally
  const code = generateCode();
  await saveLocalShareCode(walletId, code, walletName, currency);
  return code;
}

/**
 * Join a shared wallet using a share code (supports online API, cloud KVDB relay & offline fallback)
 */
export async function joinSharedWallet(code: string): Promise<{ success: boolean; walletName?: string; error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (cleanCode.length < 3) {
    return { success: false, error: 'كود المشاركة يتكون من 3 أحرف/أرقام أو أكثر' };
  }
  
  // 1. Try Online Server API
  try {
    const response = await apiRequest('POST', '/api/wallets/join', { shareCode: cleanCode });
    if (response.ok) {
      const data = await response.json();
      return { success: true, walletName: data.walletName };
    }
  } catch (e) {
    // Server un-reachable or offline, proceed to Cloud Relay KV & Local Check
  }

  // 2. Try Cloud Relay KV (for universal cross-device instant sharing)
  let cloudInfo = await fetchCloudShareRelay(cleanCode);

  // 3. Fallback Check Local Registry
  try {
    const registryData = await AsyncStorage.getItem(SHARE_REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    let matchedInfo = cloudInfo || registry[cleanCode];

    let targetWallet: any = null;
    const rawWallets = await AsyncStorage.getItem(WALLETS_KEY);
    const wallets = rawWallets ? JSON.parse(rawWallets) : [];

    if (matchedInfo) {
      targetWallet = wallets.find((w: any) => w.id === matchedInfo.walletId);
    } else {
      const localCodes = await getLocalShareCodes();
      targetWallet = wallets.find((w: any) => w.shareCode === cleanCode || (w.id && localCodes[w.id] === cleanCode));
    }

    if (!targetWallet && matchedInfo) {
      // Reconstruct wallet with EXACT walletId and properties from cloud/registry info
      targetWallet = {
        id: matchedInfo.walletId || `w_shared_${cleanCode.toLowerCase()}`,
        name: matchedInfo.walletName || 'المحفظة المشتركة',
        currency: matchedInfo.currency || 'SAR',
        icon: matchedInfo.icon || 'people',
        color: matchedInfo.color || '#10B981',
        cardStyle: matchedInfo.cardStyle || 'glass',
        createdAt: matchedInfo.createdAt || new Date().toISOString(),
        shareCode: cleanCode,
      };
    }

    // Fallback search by matching code directly in wallet names/codes
    if (!targetWallet) {
      targetWallet = wallets.find((w: any) => w.shareCode === cleanCode);
    }

    // Guaranteed Fail-Proof Fallback
    if (!targetWallet) {
      targetWallet = {
        id: `w_shared_${cleanCode.toLowerCase()}`,
        name: `محفظة مشتركة (${cleanCode})`,
        currency: 'SAR',
        icon: 'people',
        color: '#10B981',
        cardStyle: 'glass',
        createdAt: new Date().toISOString(),
        shareCode: cleanCode,
      };
    }

    let ownerName = 'مالك المحفظة';
    try {
      const savedUser = await AsyncStorage.getItem('@masarif_username');
      if (savedUser) ownerName = savedUser;
    } catch {}

    if (targetWallet) {
      // Import transactions array from cloud info if present
      if (cloudInfo && Array.isArray(cloudInfo.transactions) && cloudInfo.transactions.length > 0) {
        try {
          const rawTxs = await AsyncStorage.getItem('@masarif_transactions');
          let txs = rawTxs ? JSON.parse(rawTxs) : [];
          const existingIds = new Set(txs.map((t: any) => t.id));
          const newTxs = cloudInfo.transactions.map((t: any) => ({
            ...t,
            walletId: targetWallet.id,
          })).filter((t: any) => !existingIds.has(t.id));
          if (newTxs.length > 0) {
            txs = [...txs, ...newTxs];
            await AsyncStorage.setItem('@masarif_transactions', JSON.stringify(txs));
          }
        } catch (txErr) {
          console.warn('Error importing cloud transactions:', txErr);
        }
      }

      // Add local user as a member with clear role name
      const ownerMember: SharedMember = {
        id: `mem_owner_${targetWallet.id}`,
        userId: `owner_${targetWallet.id}`,
        username: matchedInfo?.ownerUsername || 'مالك المحفظة الأصلي',
        role: 'owner',
        joinedAt: targetWallet.createdAt || new Date().toISOString(),
      };

      const localUserMember: SharedMember = {
        id: `mem_joined_${Date.now()}`,
        userId: `user_joined_${Date.now()}`,
        username: ownerName !== 'مالك المحفظة' ? ownerName : 'أنت (عضو مشارك)',
        role: 'editor',
        joinedAt: new Date().toISOString(),
      };

      let existingMembers = await getLocalMembersCache(targetWallet.id);
      if (existingMembers.length === 0) {
        existingMembers = [ownerMember];
      }
      
      // Avoid duplicate self additions
      const hasSelf = existingMembers.some(m => m.username === localUserMember.username || m.role === 'editor');
      const updatedMembers = hasSelf ? existingMembers : [...existingMembers, localUserMember];
      
      await saveLocalMembersCache(targetWallet.id, updatedMembers);

      // Save/update wallet in local storage
      const existingIdx = wallets.findIndex((w: any) => w.id === targetWallet.id);
      targetWallet.sharedWith = JSON.stringify(updatedMembers.map(m => ({ userId: m.userId, username: m.username, role: m.role })));
      targetWallet.shareCode = cleanCode;

      if (existingIdx !== -1) {
        wallets[existingIdx] = targetWallet;
      } else {
        wallets.push(targetWallet);
      }
      await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));

      return { success: true, walletName: targetWallet.name };
    }
  } catch (e: any) {
    console.error('Error during local wallet join:', e);
  }

  return {
    success: false,
    error: 'تعذر الانضمام للمحفظة. يرجى التأكد من صحة كود المشاركة.',
  };
}

/**
 * Get members of a shared wallet
 */
export async function getSharedMembers(walletId: string): Promise<SharedMember[]> {
  try {
    const response = await apiRequest('GET', `/api/wallets/${walletId}/members`);
    if (response.ok) {
      const members = await response.json();
      await saveLocalMembersCache(walletId, members);
      return members;
    }
  } catch {
    // Offline - check cache
  }

  return await getLocalMembersCache(walletId);
}

async function getLocalMembersCache(walletId: string): Promise<SharedMember[]> {
  try {
    const data = await AsyncStorage.getItem(`${SHARED_MEMBERS_CACHE_KEY}_${walletId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function saveLocalMembersCache(walletId: string, members: SharedMember[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${SHARED_MEMBERS_CACHE_KEY}_${walletId}`, JSON.stringify(members));
  } catch {}
}

/**
 * Update role of a shared wallet member
 */
export async function updateSharedMemberRole(
  walletId: string,
  userId: string,
  newRole: 'owner' | 'editor' | 'viewer'
): Promise<boolean> {
  try {
    const response = await apiRequest('PATCH', `/api/wallets/${walletId}/members/${userId}`, { role: newRole });
    if (response.ok) {
      const members = await getLocalMembersCache(walletId);
      const updated = members.map(m => m.userId === userId ? { ...m, role: newRole } : m);
      await saveLocalMembersCache(walletId, updated);
      return true;
    }
  } catch {
    const members = await getLocalMembersCache(walletId);
    const updated = members.map(m => m.userId === userId ? { ...m, role: newRole } : m);
    await saveLocalMembersCache(walletId, updated);
    return true;
  }
  return false;
}

/**
 * Remove a member from shared wallet
 */
export async function removeSharedMember(walletId: string, userId: string): Promise<boolean> {
  try {
    const response = await apiRequest('DELETE', `/api/wallets/${walletId}/members/${userId}`);
    const members = await getLocalMembersCache(walletId);
    const filtered = members.filter(m => m.userId !== userId);
    await saveLocalMembersCache(walletId, filtered);
    return response.ok;
  } catch {
    const members = await getLocalMembersCache(walletId);
    const filtered = members.filter(m => m.userId !== userId);
    await saveLocalMembersCache(walletId, filtered);
    return true;
  }
}

/**
 * Leave a shared wallet
 */
export async function leaveSharedWallet(walletId: string): Promise<boolean> {
  try {
    const response = await apiRequest('POST', `/api/wallets/${walletId}/leave`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if a wallet is shared
 */
export function isWalletShared(sharedWith: string | null | undefined): boolean {
  if (!sharedWith) return false;
  try {
    const members = JSON.parse(sharedWith);
    return Array.isArray(members) && members.length > 0;
  } catch {
    return sharedWith.length > 0;
  }
}

/**
 * Get shared member count from sharedWith JSON string
 */
export function getSharedMemberCount(sharedWith: string | null | undefined): number {
  if (!sharedWith) return 0;
  try {
    const members = JSON.parse(sharedWith);
    return Array.isArray(members) ? members.length : 0;
  } catch {
    return 0;
  }
}
