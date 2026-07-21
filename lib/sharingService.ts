/**
 * Sharing Service — خدمة المشاركة العائلية
 * 
 * Handles wallet sharing operations: generating share codes,
 * joining shared wallets, listing members, etc.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './query-client';

const SHARE_CODES_KEY = '@masarif_share_codes';
const SHARED_MEMBERS_CACHE_KEY = '@masarif_shared_members_cache';

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

// ── Local Share Code Storage (for offline) ─────────────

async function getLocalShareCodes(): Promise<Record<string, string>> {
  try {
    const data = await AsyncStorage.getItem(SHARE_CODES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

async function saveLocalShareCode(walletId: string, code: string): Promise<void> {
  const codes = await getLocalShareCodes();
  codes[walletId] = code;
  await AsyncStorage.setItem(SHARE_CODES_KEY, JSON.stringify(codes));
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
  // Check local first
  const codes = await getLocalShareCodes();
  if (codes[walletId]) return codes[walletId];

  // Try API
  try {
    const response = await apiRequest('POST', `/api/wallets/${walletId}/share`);
    if (response.ok) {
      const data = await response.json();
      await saveLocalShareCode(walletId, data.shareCode);
      return data.shareCode;
    }
  } catch {
    // Offline fallback
  }

  // Generate locally
  const code = generateCode();
  await saveLocalShareCode(walletId, code);
  return code;
}

/**
 * Join a shared wallet using a share code
 */
export async function joinSharedWallet(code: string): Promise<{ success: boolean; walletName?: string; error?: string }> {
  try {
    const response = await apiRequest('POST', '/api/wallets/join', { shareCode: code });
    const data = await response.json();
    
    if (response.ok) {
      return { success: true, walletName: data.walletName };
    }
    return { success: false, error: data.error || 'Failed to join' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' };
  }
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
