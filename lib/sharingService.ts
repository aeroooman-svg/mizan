/**
 * Sharing Service — خدمة المشاركة العائلية
 * 
 * Handles wallet sharing operations: generating share codes,
 * joining shared wallets, listing members, etc.
 * Supports both online API sync and local offline fallback.
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

// ── Local Share Code Storage & Registry ─────────────────

async function getLocalShareCodes(): Promise<Record<string, string>> {
  try {
    const data = await AsyncStorage.getItem(SHARE_CODES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

async function saveLocalShareCode(walletId: string, code: string, walletName?: string): Promise<void> {
  const codes = await getLocalShareCodes();
  codes[walletId] = code;
  await AsyncStorage.setItem(SHARE_CODES_KEY, JSON.stringify(codes));

  // Register in local share registry
  try {
    const registryData = await AsyncStorage.getItem(SHARE_REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    registry[code] = {
      walletId,
      walletName: walletName || 'Shared Wallet',
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(SHARE_REGISTRY_KEY, JSON.stringify(registry));
  } catch (e) {
    console.warn('Failed to update share registry:', e);
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
  // Get wallet name from local storage if available
  let walletName = 'Shared Wallet';
  try {
    const rawWallets = await AsyncStorage.getItem(WALLETS_KEY);
    if (rawWallets) {
      const wallets = JSON.parse(rawWallets);
      const target = wallets.find((w: any) => w.id === walletId);
      if (target) walletName = target.name;
    }
  } catch {}

  // Check local first
  const codes = await getLocalShareCodes();
  if (codes[walletId]) {
    await saveLocalShareCode(walletId, codes[walletId], walletName);
    return codes[walletId];
  }

  // Try API
  try {
    const response = await apiRequest('POST', `/api/wallets/${walletId}/share`);
    if (response.ok) {
      const data = await response.json();
      await saveLocalShareCode(walletId, data.shareCode, walletName);
      return data.shareCode;
    }
  } catch {
    // Offline fallback
  }

  // Generate locally
  const code = generateCode();
  await saveLocalShareCode(walletId, code, walletName);
  return code;
}

/**
 * Join a shared wallet using a share code (supports online API & offline fallback)
 */
export async function joinSharedWallet(code: string): Promise<{ success: boolean; walletName?: string; error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  
  // 1. Try Online Server API
  try {
    const response = await apiRequest('POST', '/api/wallets/join', { shareCode: cleanCode });
    if (response.ok) {
      const data = await response.json();
      return { success: true, walletName: data.walletName };
    }
  } catch (e) {
    // Server un-reachable or offline, proceed to local registry check
  }

  // 2. Offline / Local Fallback Check
  try {
    // Check local registry first
    const registryData = await AsyncStorage.getItem(SHARE_REGISTRY_KEY);
    const registry = registryData ? JSON.parse(registryData) : {};
    let matchedInfo = registry[cleanCode];

    let targetWallet: any = null;
    const rawWallets = await AsyncStorage.getItem(WALLETS_KEY);
    const wallets = rawWallets ? JSON.parse(rawWallets) : [];

    if (matchedInfo) {
      targetWallet = wallets.find((w: any) => w.id === matchedInfo.walletId);
    } else {
      // Search all wallets directly by shareCode
      const localCodes = await getLocalShareCodes();
      targetWallet = wallets.find((w: any) => w.shareCode === cleanCode || (w.id && localCodes[w.id] === cleanCode));
    }

    if (!targetWallet && matchedInfo) {
      // Reconstruct wallet if found in registry but missing locally
      targetWallet = {
        id: matchedInfo.walletId,
        name: matchedInfo.walletName || 'المحفظة المشتركة',
        currency: 'EGP',
        icon: 'people',
        color: '#4F46E5',
        cardStyle: 'glass',
        createdAt: new Date().toISOString(),
        shareCode: cleanCode,
      };
    }

    if (targetWallet) {
      // Add local user as a member
      const newMember: SharedMember = {
        id: `mem_${Date.now()}`,
        userId: `user_${Date.now()}`,
        username: 'عضو جديد (مشارك)',
        role: 'editor',
        joinedAt: new Date().toISOString(),
      };

      const existingMembers = await getLocalMembersCache(targetWallet.id);
      const updatedMembers = [...existingMembers, newMember];
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
    error: 'كود المشاركة غير صحيح أو تعذر العثور على المحفظة (تأكد من كتابة الكود الصحيح)',
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
    // Local update fallback
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

