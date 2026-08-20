/**
 * Sharing Service — خدمة المشاركة العائلية (Supabase Direct)
 * 
 * Handles wallet sharing operations using Supabase REST API directly.
 * No Express server or kvdb.io needed — works across all devices in real-time.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseGet, supabaseUpsert, supabaseInsert, supabaseDelete, supabaseUpdate } from './supabaseClient';

const WALLETS_KEY = '@mizan_wallets';
const LEGACY_WALLETS_KEY = '@masarif_wallets';
const TRANSACTIONS_KEY = '@mizan_transactions';
const LEGACY_TRANSACTIONS_KEY = '@masarif_transactions';
const USERNAME_KEY = '@mizan_username';
const LEGACY_USERNAME_KEY = '@masarif_username';
const SHARE_CODES_KEY = '@masarif_share_codes';

async function getStorageWithFallback(primary: string, legacy: string): Promise<string | null> {
  const val = await AsyncStorage.getItem(primary);
  if (val) return val;
  return AsyncStorage.getItem(legacy);
}

async function setStorageDual(primary: string, legacy: string, value: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(primary, value),
    AsyncStorage.setItem(legacy, value),
  ]);
}

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

// ── Helper: Get current username ──────────────────────────
async function getCurrentUsername(): Promise<string> {
  try {
    const username = await getStorageWithFallback(USERNAME_KEY, LEGACY_USERNAME_KEY);
    return username || 'مستخدم ميزان';
  } catch {
    return 'مستخدم ميزان';
  }
}

// ── Helper: Get local wallets ─────────────────────────────
async function getLocalWallets(): Promise<any[]> {
  try {
    const raw = await getStorageWithFallback(WALLETS_KEY, LEGACY_WALLETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Helper: Save local wallets ────────────────────────────
async function saveLocalWallets(wallets: any[]): Promise<void> {
  const json = JSON.stringify(wallets);
  await setStorageDual(WALLETS_KEY, LEGACY_WALLETS_KEY, json);
}

// ── Helper: Get local transactions ────────────────────────
async function getLocalTransactions(): Promise<any[]> {
  try {
    const raw = await getStorageWithFallback(TRANSACTIONS_KEY, LEGACY_TRANSACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Helper: Save local transactions ───────────────────────
async function saveLocalTransactions(txns: any[]): Promise<void> {
  const json = JSON.stringify(txns);
  await setStorageDual(TRANSACTIONS_KEY, LEGACY_TRANSACTIONS_KEY, json);
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
 * Generate or retrieve a share code for a wallet, and push wallet data to Supabase.
 */
export async function getOrCreateShareCode(walletId: string): Promise<string> {
  // 1. Check if wallet already has a share code locally
  const wallets = await getLocalWallets();
  const localWallet = wallets.find((w: any) => w.id === walletId);
  
  if (!localWallet) {
    // No wallet found, generate a code anyway
    return generateCode();
  }

  // 2. If wallet already has a shareCode, reuse it
  if (localWallet.shareCode) {
    // Push/sync wallet to Supabase to ensure it's available for others
    await pushWalletToSupabase(localWallet);
    await pushTransactionsToSupabase(walletId);
    return localWallet.shareCode;
  }

  // 3. Check if a code already exists on Supabase for this wallet
  const remoteWallets = await supabaseGet('wallets', `id=eq.${walletId}&select=share_code`);
  if (remoteWallets.length > 0 && remoteWallets[0].share_code) {
    const existingCode = remoteWallets[0].share_code;
    // Save locally
    localWallet.shareCode = existingCode;
    await saveLocalWallets(wallets);
    return existingCode;
  }

  // 4. Generate new code
  const code = generateCode();
  localWallet.shareCode = code;

  // Save locally
  await saveLocalWallets(wallets);

  // Also save in local share codes cache
  try {
    const codesData = await AsyncStorage.getItem(SHARE_CODES_KEY);
    const codes = codesData ? JSON.parse(codesData) : {};
    codes[walletId] = code;
    await AsyncStorage.setItem(SHARE_CODES_KEY, JSON.stringify(codes));
  } catch {}

  // 5. Push wallet + transactions to Supabase
  await pushWalletToSupabase(localWallet);
  await pushTransactionsToSupabase(walletId);

  // 6. Register owner as a member in wallet_shares
  const username = await getCurrentUsername();
  await supabaseUpsert('wallet_shares', {
    id: `mem_owner_${walletId}`,
    wallet_id: walletId,
    user_id: `owner_${walletId}`,
    username: username,
    role: 'owner',
    joined_at: localWallet.createdAt || new Date().toISOString(),
  });

  return code;
}

/**
 * Push a local wallet to Supabase (upsert).
 */
async function pushWalletToSupabase(wallet: any): Promise<void> {
  try {
    const username = await getCurrentUsername();
    const members = [{ userId: `owner_${wallet.id}`, username, role: 'owner' }];
    
    await supabaseUpsert('wallets', {
      id: wallet.id,
      name: wallet.name || 'المحفظة المشتركة',
      currency: wallet.currency || 'SAR',
      icon: wallet.icon || 'account-balance-wallet',
      color: wallet.color || '#0D7C66',
      created_at: wallet.createdAt || new Date().toISOString(),
      user_id: wallet.userId || null,
      shared_with: wallet.sharedWith || JSON.stringify(members),
      share_code: wallet.shareCode || null,
    });
  } catch (e) {
    console.warn('pushWalletToSupabase error:', e);
  }
}

/**
 * Push local transactions for a wallet to Supabase (upsert each).
 */
async function pushTransactionsToSupabase(walletId: string): Promise<void> {
  try {
    const allTxns = await getLocalTransactions();
    const walletTxns = allTxns.filter((t: any) => t.walletId === walletId);
    
    if (walletTxns.length === 0) return;

    // Upsert in batches of 50
    for (let i = 0; i < walletTxns.length; i += 50) {
      const batch = walletTxns.slice(i, i + 50).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description || '',
        date: t.date,
        created_at: t.createdAt || new Date().toISOString(),
        wallet_id: t.walletId,
        to_wallet_id: t.toWalletId || null,
        tags: t.tags || null,
        receipt_uri: t.receiptUri || null,
        user_id: t.userId || null,
        added_by: t.addedBy || null,
      }));
      await supabaseUpsert('transactions', batch);
    }
  } catch (e) {
    console.warn('pushTransactionsToSupabase error:', e);
  }
}

/**
 * Join a shared wallet using a share code — fetches real data from Supabase.
 */
export async function joinSharedWallet(code: string): Promise<{ success: boolean; walletName?: string; error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (cleanCode.length < 3) {
    return { success: false, error: 'كود المشاركة يتكون من 3 أحرف/أرقام أو أكثر' };
  }

  try {
    // 1. Search for wallet by share code in Supabase
    const remoteWallets = await supabaseGet('wallets', `share_code=eq.${cleanCode}&select=*`);
    
    if (remoteWallets.length === 0) {
      return {
        success: false,
        error: 'كود المشاركة غير صحيح أو المحفظة غير موجودة. تأكد من الكود وحاول مجدداً.',
      };
    }

    const remoteWallet = remoteWallets[0];
    const remoteWalletId = remoteWallet.id;

    // 2. Fetch transactions for this wallet from Supabase
    const remoteTxns = await supabaseGet('transactions', `wallet_id=eq.${remoteWalletId}&select=*`);

    // 3. Reconstruct wallet object for local storage
    const walletForLocal: any = {
      id: remoteWalletId,
      name: remoteWallet.name || 'المحفظة المشتركة',
      currency: remoteWallet.currency || 'SAR',
      icon: remoteWallet.icon || 'people',
      color: remoteWallet.color || '#10B981',
      cardStyle: 'glass',
      createdAt: remoteWallet.created_at || new Date().toISOString(),
      shareCode: cleanCode,
      sharedWith: remoteWallet.shared_with || '',
    };

    // 4. Save wallet locally
    const localWallets = await getLocalWallets();
    const existingIdx = localWallets.findIndex((w: any) => w.id === remoteWalletId);
    if (existingIdx !== -1) {
      // Update existing
      localWallets[existingIdx] = { ...localWallets[existingIdx], ...walletForLocal };
    } else {
      localWallets.push(walletForLocal);
    }
    await saveLocalWallets(localWallets);

    // 5. Merge remote transactions into local
    if (remoteTxns.length > 0) {
      const localTxns = await getLocalTransactions();
      const txnMap = new Map<string, any>();
      localTxns.forEach((t: any) => txnMap.set(t.id, t));

      remoteTxns.forEach((t: any) => {
        txnMap.set(t.id, {
          id: t.id,
          type: t.type,
          amount: t.amount,
          category: t.category,
          description: t.description || '',
          date: t.date,
          createdAt: t.created_at,
          walletId: t.wallet_id,
          toWalletId: t.to_wallet_id || null,
          tags: t.tags || null,
          receiptUri: t.receipt_uri || null,
          userId: t.user_id || null,
          addedBy: t.added_by || null,
        });
      });

      await saveLocalTransactions(Array.from(txnMap.values()));
    }

    // 6. Register joiner as member in Supabase wallet_shares
    const username = await getCurrentUsername();
    const joinerId = `user_joined_${Date.now()}`;
    
    await supabaseInsert('wallet_shares', {
      id: `mem_${joinerId}`,
      wallet_id: remoteWalletId,
      user_id: joinerId,
      username: username,
      role: 'editor',
      joined_at: new Date().toISOString(),
    });

    // 7. Update sharedWith in the wallet on Supabase
    const allMembers = await supabaseGet('wallet_shares', `wallet_id=eq.${remoteWalletId}&select=*`);
    const membersJson = JSON.stringify(allMembers.map((m: any) => ({
      userId: m.user_id,
      username: m.username,
      role: m.role,
    })));
    await supabaseUpdate('wallets', `id=eq.${remoteWalletId}`, { shared_with: membersJson });

    // Update local wallet with sharedWith
    const updatedWallets = await getLocalWallets();
    const wIdx = updatedWallets.findIndex((w: any) => w.id === remoteWalletId);
    if (wIdx !== -1) {
      updatedWallets[wIdx].sharedWith = membersJson;
      await saveLocalWallets(updatedWallets);
    }

    return { success: true, walletName: walletForLocal.name };
  } catch (e: any) {
    console.error('joinSharedWallet error:', e);
    return {
      success: false,
      error: 'تعذر الانضمام للمحفظة. تحقق من اتصالك بالإنترنت وحاول مجدداً.',
    };
  }
}

/**
 * Synchronize a shared wallet's transactions with Supabase.
 */
export async function syncSharedWalletByCode(code: string): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return false;

  try {
    // 1. Find wallet on Supabase by share code
    const remoteWallets = await supabaseGet('wallets', `share_code=eq.${cleanCode}&select=*`);
    if (remoteWallets.length === 0) return false;

    const remoteWallet = remoteWallets[0];
    const walletId = remoteWallet.id;

    // 2. Fetch remote transactions
    const remoteTxns = await supabaseGet('transactions', `wallet_id=eq.${walletId}&select=*`);

    // 3. Merge with local transactions
    const localTxns = await getLocalTransactions();
    const txnMap = new Map<string, any>();

    // Local transactions first
    localTxns.forEach((t: any) => txnMap.set(t.id, t));

    // Remote transactions (mapped to local format)
    remoteTxns.forEach((t: any) => {
      txnMap.set(t.id, {
        id: t.id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description || '',
        date: t.date,
        createdAt: t.created_at,
        walletId: t.wallet_id,
        toWalletId: t.to_wallet_id || null,
        tags: t.tags || null,
        receiptUri: t.receipt_uri || null,
        userId: t.user_id || null,
        addedBy: t.added_by || null,
      });
    });

    const mergedTxns = Array.from(txnMap.values());
    await saveLocalTransactions(mergedTxns);

    // 4. Push local wallet transactions back to Supabase
    await pushTransactionsToSupabase(walletId);

    // 5. Update local wallet metadata from remote
    const localWallets = await getLocalWallets();
    const wIdx = localWallets.findIndex((w: any) => w.id === walletId);
    if (wIdx !== -1) {
      if (remoteWallet.name) localWallets[wIdx].name = remoteWallet.name;
      if (remoteWallet.currency) localWallets[wIdx].currency = remoteWallet.currency;
      if (remoteWallet.shared_with) localWallets[wIdx].sharedWith = remoteWallet.shared_with;
      await saveLocalWallets(localWallets);
    }

    return true;
  } catch (e) {
    console.warn('syncSharedWalletByCode error:', e);
    return false;
  }
}

/**
 * Sync all shared wallets for the user.
 */
export async function syncAllSharedWallets(): Promise<void> {
  try {
    const wallets = await getLocalWallets();
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

/**
 * Get members of a shared wallet from Supabase.
 */
export async function getSharedMembers(walletId: string): Promise<SharedMember[]> {
  try {
    const members = await supabaseGet('wallet_shares', `wallet_id=eq.${walletId}&select=*`);
    return members.map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      username: m.username,
      role: m.role as 'owner' | 'editor' | 'viewer',
      joinedAt: m.joined_at,
    }));
  } catch (e) {
    console.warn('getSharedMembers error:', e);
    return [];
  }
}

/**
 * Update role of a shared wallet member.
 */
export async function updateSharedMemberRole(
  walletId: string,
  userId: string,
  newRole: 'owner' | 'editor' | 'viewer'
): Promise<boolean> {
  try {
    return await supabaseUpdate(
      'wallet_shares',
      `wallet_id=eq.${walletId}&user_id=eq.${userId}`,
      { role: newRole }
    );
  } catch {
    return false;
  }
}

/**
 * Remove a member from shared wallet.
 */
export async function removeSharedMember(walletId: string, userId: string): Promise<boolean> {
  try {
    return await supabaseDelete(
      'wallet_shares',
      `wallet_id=eq.${walletId}&user_id=eq.${userId}`
    );
  } catch {
    return false;
  }
}

/**
 * Leave a shared wallet.
 */
export async function leaveSharedWallet(walletId: string): Promise<boolean> {
  try {
    const username = await getCurrentUsername();
    // Find current user's member record
    const members = await supabaseGet(
      'wallet_shares',
      `wallet_id=eq.${walletId}&username=eq.${encodeURIComponent(username)}&select=*`
    );
    if (members.length > 0) {
      return await supabaseDelete(
        'wallet_shares',
        `wallet_id=eq.${walletId}&user_id=eq.${members[0].user_id}`
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a wallet is shared.
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
 * Get shared member count from sharedWith JSON string.
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
