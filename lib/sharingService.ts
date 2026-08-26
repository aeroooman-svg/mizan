/**
 * Sharing Service — خدمة المشاركة العائلية (Supabase Direct)
 * 
 * Handles wallet sharing operations using Supabase REST API directly.
 * Full support for wallet metadata (balance, cardStyle, icon, color) and live transactions.
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
  const wallets = await getLocalWallets();
  const localWallet = wallets.find((w: any) => w.id === walletId);
  
  if (!localWallet) {
    return generateCode();
  }

  // If wallet already has a shareCode, push latest snapshot and return
  if (localWallet.shareCode) {
    await pushWalletToSupabase(localWallet);
    await pushTransactionsToSupabase(walletId);
    return localWallet.shareCode;
  }

  // Check if a code already exists on Supabase for this wallet
  const remoteWallets = await supabaseGet('wallets', `id=eq.${walletId}&select=share_code`);
  if (remoteWallets.length > 0 && remoteWallets[0].share_code) {
    const existingCode = remoteWallets[0].share_code;
    localWallet.shareCode = existingCode;
    await saveLocalWallets(wallets);
    await pushWalletToSupabase(localWallet);
    await pushTransactionsToSupabase(walletId);
    return existingCode;
  }

  // Generate new code
  const code = generateCode();
  localWallet.shareCode = code;

  await saveLocalWallets(wallets);

  try {
    const codesData = await AsyncStorage.getItem(SHARE_CODES_KEY);
    const codes = codesData ? JSON.parse(codesData) : {};
    codes[walletId] = code;
    await AsyncStorage.setItem(SHARE_CODES_KEY, JSON.stringify(codes));
  } catch {}

  // Push wallet + transactions to Supabase
  await pushWalletToSupabase(localWallet);
  await pushTransactionsToSupabase(walletId);

  // Register owner as member in wallet_shares table
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
 * Push a local wallet to Supabase with all metadata (initialBalance, cardStyle, icon, color).
 */
export async function pushWalletToSupabase(wallet: any): Promise<void> {
  try {
    const username = await getCurrentUsername();
    let membersList = [{ userId: `owner_${wallet.id}`, username, role: 'owner' }];
    
    if (wallet.sharedWith) {
      try {
        const parsed = JSON.parse(wallet.sharedWith);
        if (Array.isArray(parsed)) {
          membersList = parsed;
        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.members)) {
          membersList = parsed.members;
        }
      } catch {}
    }

    // Embed rich metadata inside shared_with JSON so everything is preserved across devices
    const metadataPayload = JSON.stringify({
      members: membersList,
      initialBalance: wallet.initialBalance !== undefined ? Number(wallet.initialBalance) : 0,
      cardStyle: wallet.cardStyle || 'classic',
      icon: wallet.icon || 'account-balance-wallet',
      color: wallet.color || '#0D7C66',
    });

    await supabaseUpsert('wallets', {
      id: wallet.id,
      name: wallet.name || 'المحفظة المشتركة',
      currency: wallet.currency || 'SAR',
      icon: wallet.icon || 'account-balance-wallet',
      color: wallet.color || '#0D7C66',
      created_at: wallet.createdAt || new Date().toISOString(),
      user_id: wallet.userId || null,
      shared_with: metadataPayload,
      share_code: wallet.shareCode || null,
    });
  } catch (e) {
    console.warn('pushWalletToSupabase error:', e);
  }
}

/**
 * Push local transactions for a wallet to Supabase (upsert).
 */
export async function pushTransactionsToSupabase(walletId: string): Promise<void> {
  try {
    const allTxns = await getLocalTransactions();
    const walletTxns = allTxns.filter((t: any) => t.walletId === walletId || t.toWalletId === walletId);
    
    if (walletTxns.length === 0) return;

    // Upsert in batches of 50
    for (let i = 0; i < walletTxns.length; i += 50) {
      const batch = walletTxns.slice(i, i + 50).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount) || 0,
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
 * Push a single local transaction to Supabase if its wallet or target wallet is shared.
 */
export async function pushSingleTransactionToSupabase(txn: any): Promise<void> {
  try {
    const wallets = await getLocalWallets();
    const isSourceShared = wallets.some((w: any) => w.id === txn.walletId && (w.shareCode || isWalletShared(w.sharedWith)));
    const isTargetShared = txn.toWalletId ? wallets.some((w: any) => w.id === txn.toWalletId && (w.shareCode || isWalletShared(w.sharedWith))) : false;

    if (isSourceShared || isTargetShared) {
      await supabaseUpsert('transactions', {
        id: txn.id,
        type: txn.type,
        amount: Number(txn.amount) || 0,
        category: txn.category,
        description: txn.description || '',
        date: txn.date,
        created_at: txn.createdAt || new Date().toISOString(),
        wallet_id: txn.walletId,
        to_wallet_id: txn.toWalletId || null,
        tags: txn.tags || null,
        receipt_uri: txn.receiptUri || null,
        user_id: txn.userId || null,
        added_by: txn.addedBy || null,
      });
    }
  } catch (e) {
    console.warn('pushSingleTransactionToSupabase error:', e);
  }
}

/**
 * Delete a transaction from Supabase.
 */
export async function deleteTransactionFromSupabase(txnId: string): Promise<void> {
  try {
    await supabaseDelete('transactions', `id=eq.${txnId}`);
  } catch (e) {
    console.warn('deleteTransactionFromSupabase error:', e);
  }
}

/**
 * Join a shared wallet using a share code — fetches full data + transactions from Supabase.
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
        error: 'لم يتم العثور على محفظة بهذا الكود. تأكد من صحة الكود والمحاولة مرة أخرى.',
      };
    }

    const remoteWallet = remoteWallets[0];
    const remoteWalletId = remoteWallet.id;

    // 2. Extract metadata (initialBalance, cardStyle, icon, color, members)
    let initialBalance = 0;
    let cardStyle = 'classic';
    let icon = remoteWallet.icon || 'account-balance-wallet';
    let color = remoteWallet.color || '#0D7C66';
    let membersList: any[] = [];

    if (remoteWallet.shared_with) {
      try {
        const parsed = JSON.parse(remoteWallet.shared_with);
        if (Array.isArray(parsed)) {
          membersList = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.initialBalance !== undefined) initialBalance = Number(parsed.initialBalance);
          if (parsed.cardStyle) cardStyle = parsed.cardStyle;
          if (parsed.icon) icon = parsed.icon;
          if (parsed.color) color = parsed.color;
          if (Array.isArray(parsed.members)) membersList = parsed.members;
        }
      } catch {}
    }

    // 3. Fetch all transactions for this wallet from Supabase (both source and destination transfers)
    const remoteTxns = await supabaseGet('transactions', `or=(wallet_id.eq.${remoteWalletId},to_wallet_id.eq.${remoteWalletId})&select=*`);

    // 4. Construct local wallet object
    const username = await getCurrentUsername();
    const joinerId = `user_joined_${Date.now()}`;
    
    const newMember = {
      userId: joinerId,
      username: username,
      role: 'editor',
    };

    if (!membersList.some(m => m.username === username)) {
      membersList.push(newMember);
    }

    const updatedMetadata = JSON.stringify({
      members: membersList,
      initialBalance: initialBalance,
      cardStyle: cardStyle,
      icon: icon,
      color: color,
    });

    const walletForLocal: any = {
      id: remoteWalletId,
      name: remoteWallet.name || 'المحفظة المشتركة',
      currency: remoteWallet.currency || 'SAR',
      icon: icon,
      color: color,
      cardStyle: cardStyle,
      initialBalance: initialBalance,
      createdAt: remoteWallet.created_at || new Date().toISOString(),
      shareCode: cleanCode,
      sharedWith: updatedMetadata,
    };

    // 5. Save wallet locally
    const localWallets = await getLocalWallets();
    const existingIdx = localWallets.findIndex((w: any) => w.id === remoteWalletId);
    if (existingIdx !== -1) {
      localWallets[existingIdx] = { ...localWallets[existingIdx], ...walletForLocal };
    } else {
      localWallets.push(walletForLocal);
    }
    await saveLocalWallets(localWallets);

    // 6. Merge transactions into local storage
    const localTxns = await getLocalTransactions();
    const txnMap = new Map<string, any>();
    localTxns.forEach((t: any) => txnMap.set(t.id, t));

    if (Array.isArray(remoteTxns) && remoteTxns.length > 0) {
      remoteTxns.forEach((t: any) => {
        txnMap.set(t.id, {
          id: t.id,
          type: t.type,
          amount: Number(t.amount) || 0,
          category: t.category,
          description: t.description || '',
          date: t.date,
          createdAt: t.created_at,
          walletId: t.wallet_id,
          toWalletId: t.to_wallet_id || undefined,
          tags: t.tags || undefined,
          receiptUri: t.receipt_uri || undefined,
          userId: t.user_id || undefined,
          addedBy: t.added_by || undefined,
        });
      });
    }

    await saveLocalTransactions(Array.from(txnMap.values()));

    // 7. Update Supabase wallets table with the updated member list & metadata
    try {
      await supabaseUpdate('wallets', `id=eq.${remoteWalletId}`, {
        shared_with: updatedMetadata,
      });
    } catch (e) {
      console.warn('joinSharedWallet supabaseUpdate error:', e);
    }

    // 8. Add member entry to wallet_shares table in Supabase
    try {
      await supabaseUpsert('wallet_shares', {
        id: `mem_${remoteWalletId}_${joinerId}`,
        wallet_id: remoteWalletId,
        user_id: joinerId,
        username: username,
        role: 'editor',
        joined_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('joinSharedWallet wallet_shares insert error:', e);
    }

    // 9. Save share code in local cache
    try {
      const codesData = await AsyncStorage.getItem(SHARE_CODES_KEY);
      const codes = codesData ? JSON.parse(codesData) : {};
      codes[remoteWalletId] = cleanCode;
      await AsyncStorage.setItem(SHARE_CODES_KEY, JSON.stringify(codes));
    } catch {}

    return {
      success: true,
      walletName: remoteWallet.name,
    };
  } catch (e: any) {
    console.error('joinSharedWallet error:', e);
    return {
      success: false,
      error: e?.message || 'حدث خطأ أثناء الانضمام للمحفظة',
    };
  }
}

/**
 * Synchronize a shared wallet's metadata and transactions bidirectionally with Supabase.
 */
export async function syncSharedWalletByCode(code: string): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return false;

  try {
    // 1. Fetch wallet from Supabase
    const remoteWallets = await supabaseGet('wallets', `share_code=eq.${cleanCode}&select=*`);
    if (remoteWallets.length === 0) return false;

    const remoteWallet = remoteWallets[0];
    const walletId = remoteWallet.id;

    // 2. Fetch remote transactions (both source and destination transfers)
    const remoteTxns = await supabaseGet('transactions', `or=(wallet_id.eq.${walletId},to_wallet_id.eq.${walletId})&select=*`);

    // 3. Extract metadata (initialBalance, cardStyle, icon, color)
    let initialBalance: number | undefined = undefined;
    let cardStyle: string | undefined = undefined;
    let icon = remoteWallet.icon;
    let color = remoteWallet.color;

    if (remoteWallet.shared_with) {
      try {
        const parsed = JSON.parse(remoteWallet.shared_with);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (parsed.initialBalance !== undefined) initialBalance = Number(parsed.initialBalance);
          if (parsed.cardStyle) cardStyle = parsed.cardStyle;
          if (parsed.icon) icon = parsed.icon;
          if (parsed.color) color = parsed.color;
        }
      } catch {}
    }

    // 4. Update local wallet
    const localWallets = await getLocalWallets();
    const wIdx = localWallets.findIndex((w: any) => w.id === walletId || w.shareCode === cleanCode);
    if (wIdx !== -1) {
      if (remoteWallet.name) localWallets[wIdx].name = remoteWallet.name;
      if (remoteWallet.currency) localWallets[wIdx].currency = remoteWallet.currency;
      if (icon) localWallets[wIdx].icon = icon;
      if (color) localWallets[wIdx].color = color;
      if (cardStyle) localWallets[wIdx].cardStyle = cardStyle;
      
      // Preserve local initialBalance if remote has none or 0
      if (initialBalance !== undefined && initialBalance !== 0) {
        localWallets[wIdx].initialBalance = initialBalance;
      } else if (localWallets[wIdx].initialBalance !== undefined && localWallets[wIdx].initialBalance !== 0) {
        // Push local initialBalance back up to Supabase
        await pushWalletToSupabase(localWallets[wIdx]);
      }
      
      if (remoteWallet.shared_with) localWallets[wIdx].sharedWith = remoteWallet.shared_with;
      await saveLocalWallets(localWallets);
    }

    // 5. Merge transactions
    const localTxns = await getLocalTransactions();
    const txnMap = new Map<string, any>();

    localTxns.forEach((t: any) => txnMap.set(t.id, t));

    if (Array.isArray(remoteTxns)) {
      remoteTxns.forEach((t: any) => {
        const remoteItem = {
          id: t.id,
          type: t.type,
          amount: Number(t.amount) || 0,
          category: t.category,
          description: t.description || '',
          date: t.date,
          createdAt: t.created_at,
          walletId: t.wallet_id,
          toWalletId: t.to_wallet_id || undefined,
          tags: t.tags || undefined,
          receiptUri: t.receipt_uri || undefined,
          userId: t.user_id || undefined,
          addedBy: t.added_by || undefined,
        };
        const localItem = txnMap.get(t.id);
        if (!localItem) {
          txnMap.set(t.id, remoteItem);
        } else {
          // Keep local if local has same id (to prevent overwriting pending edits before sync)
          txnMap.set(t.id, { ...remoteItem, ...localItem });
        }
      });
    }

    await saveLocalTransactions(Array.from(txnMap.values()));

    // 6. Push local transactions back up to Supabase to keep remote complete
    await pushTransactionsToSupabase(walletId);

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
    const sharedWallets = wallets.filter((w: any) => w.shareCode || isWalletShared(w.sharedWith));
    for (const wallet of sharedWallets) {
      if (wallet.initialBalance !== undefined && wallet.initialBalance !== 0) {
        await pushWalletToSupabase(wallet).catch(() => {});
      }
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
    if (members && members.length > 0) {
      return members.map((m: any) => ({
        id: m.id || `mem_${m.user_id}`,
        userId: m.user_id || m.id,
        username: m.username,
        role: m.role as 'owner' | 'editor' | 'viewer',
        joinedAt: m.joined_at || new Date().toISOString(),
      }));
    }
  } catch (e) {
    console.warn('getSharedMembers error:', e);
  }

  // Fallback: parse members from local or remote wallet shared_with JSON
  try {
    const localWallets = await getLocalWallets();
    const localW = localWallets.find((w: any) => w.id === walletId);
    let sharedWithStr = localW?.sharedWith;

    if (!sharedWithStr) {
      const remoteWallets = await supabaseGet('wallets', `id=eq.${walletId}&select=shared_with`);
      if (remoteWallets.length > 0) {
        sharedWithStr = remoteWallets[0].shared_with;
      }
    }

    if (sharedWithStr) {
      const parsed = typeof sharedWithStr === 'string' ? JSON.parse(sharedWithStr) : sharedWithStr;
      const list = Array.isArray(parsed) ? parsed : (parsed?.members || []);
      if (Array.isArray(list) && list.length > 0) {
        return list.map((m: any, idx: number) => ({
          id: m.id || m.userId || `mem_${idx}`,
          userId: m.userId || `user_${idx}`,
          username: m.username || (idx === 0 ? 'المالك' : 'عضو'),
          role: (m.role as any) || (idx === 0 ? 'owner' : 'editor'),
          joinedAt: m.joinedAt || new Date().toISOString(),
        }));
      }
    }
  } catch (e) {
    console.warn('Fallback getSharedMembers error:', e);
  }

  return [];
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
 * Stop sharing a wallet completely (owner only).
 * Revokes share code and removes all members from Supabase and local storage.
 */
export async function stopSharingWallet(walletId: string): Promise<boolean> {
  try {
    // 1. Delete all shares for this wallet from Supabase
    try {
      await supabaseDelete('wallet_shares', `wallet_id=eq.${walletId}`);
    } catch (e) {
      console.warn('stopSharingWallet supabaseDelete wallet_shares error:', e);
    }

    // 2. Clear share_code and shared_with in Supabase wallets table
    try {
      await supabaseUpdate('wallets', `id=eq.${walletId}`, {
        share_code: null,
        shared_with: null,
      });
    } catch (e) {
      console.warn('stopSharingWallet supabaseUpdate wallets error:', e);
    }

    // 3. Update local wallet record
    const localWallets = await getLocalWallets();
    const wIdx = localWallets.findIndex((w: any) => w.id === walletId);
    if (wIdx !== -1) {
      delete localWallets[wIdx].shareCode;
      delete localWallets[wIdx].sharedWith;
      await saveLocalWallets(localWallets);
    }

    // 4. Update via storage.ts to ensure @masarif_wallets and @mizan_wallets are kept in sync
    try {
      const { getWallets, updateWallet } = await import('./storage');
      const storedWallets = await getWallets();
      const target = storedWallets.find((w: any) => w.id === walletId);
      if (target) {
        delete target.shareCode;
        delete target.sharedWith;
        await updateWallet(target);
      }
    } catch (e) {
      console.warn('stopSharingWallet storage update error:', e);
    }

    // 5. Clear from SHARE_CODES_KEY cache
    try {
      const codesData = await AsyncStorage.getItem(SHARE_CODES_KEY);
      if (codesData) {
        const codes = JSON.parse(codesData);
        delete codes[walletId];
        await AsyncStorage.setItem(SHARE_CODES_KEY, JSON.stringify(codes));
      }
    } catch {}

    return true;
  } catch (e) {
    console.error('stopSharingWallet error:', e);
    // Even if remote operations throw, ensure local state is cleaned up
    try {
      const localWallets = await getLocalWallets();
      const wIdx = localWallets.findIndex((w: any) => w.id === walletId);
      if (wIdx !== -1) {
        delete localWallets[wIdx].shareCode;
        delete localWallets[wIdx].sharedWith;
        await saveLocalWallets(localWallets);
      }
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Remove a member from shared wallet and update Supabase & local state.
 */
export async function removeSharedMember(walletId: string, userId: string, username?: string): Promise<boolean> {
  try {
    // 1. Delete from Supabase wallet_shares (by userId and by username if available)
    try {
      await supabaseDelete('wallet_shares', `wallet_id=eq.${walletId}&user_id=eq.${userId}`);
      if (username) {
        await supabaseDelete('wallet_shares', `wallet_id=eq.${walletId}&username=eq.${encodeURIComponent(username)}`);
      }
    } catch (e) {
      console.warn('removeSharedMember supabaseDelete error:', e);
    }

    // 2. Fetch current wallet data from local storage
    const localWallets = await getLocalWallets();
    const wIdx = localWallets.findIndex((w: any) => w.id === walletId);
    
    let initialBalance = 0;
    let cardStyle = 'classic';
    let icon = 'account-balance-wallet';
    let color = '#0D7C66';
    let membersList: any[] = [];

    if (wIdx !== -1) {
      const w = localWallets[wIdx];
      initialBalance = Number(w.initialBalance) || 0;
      cardStyle = w.cardStyle || 'classic';
      icon = w.icon || 'account-balance-wallet';
      color = w.color || '#0D7C66';
      if (w.sharedWith) {
        try {
          const parsed = typeof w.sharedWith === 'string' ? JSON.parse(w.sharedWith) : w.sharedWith;
          membersList = Array.isArray(parsed) ? parsed : (parsed?.members || []);
        } catch {}
      }
    }

    // Try to get members from Supabase wallet_shares too
    try {
      const remainingFromDb = await supabaseGet('wallet_shares', `wallet_id=eq.${walletId}&select=*`);
      if (remainingFromDb && remainingFromDb.length > 0) {
        membersList = remainingFromDb.map((m: any) => ({
          userId: m.user_id,
          username: m.username,
          role: m.role,
        }));
      }
    } catch {}

    // Filter out the member being removed (by userId and username)
    const remainingMembers = membersList.filter((m: any) => {
      if (m.userId && m.userId === userId) return false;
      if (username && m.username && m.username.toLowerCase() === username.toLowerCase()) return false;
      return true;
    });

    const hasOtherMembers = remainingMembers.some((m: any) => m.role !== 'owner');

    const updatedMetadata = JSON.stringify({
      members: remainingMembers,
      initialBalance,
      cardStyle,
      icon,
      color,
    });

    // 3. Update Supabase wallets table
    try {
      await supabaseUpdate('wallets', `id=eq.${walletId}`, {
        shared_with: hasOtherMembers ? updatedMetadata : null,
      });
    } catch (e) {
      console.warn('removeSharedMember supabaseUpdate error:', e);
    }

    // 4. Update Local storage
    if (wIdx !== -1) {
      localWallets[wIdx].sharedWith = hasOtherMembers ? updatedMetadata : undefined;
      await saveLocalWallets(localWallets);
    }

    // 5. Update storage.ts
    try {
      const { getWallets, updateWallet } = await import('./storage');
      const storedWallets = await getWallets();
      const target = storedWallets.find((w: any) => w.id === walletId);
      if (target) {
        target.sharedWith = hasOtherMembers ? updatedMetadata : undefined;
        await updateWallet(target);
      }
    } catch (e) {}

    return true;
  } catch (e) {
    console.error('removeSharedMember error:', e);
    return false;
  }
}

/**
 * Leave a shared wallet (member only) and clean up local data.
 */
export async function leaveSharedWallet(walletId: string): Promise<boolean> {
  try {
    const username = await getCurrentUsername();
    
    // 1. Delete this member from Supabase wallet_shares
    try {
      await supabaseDelete(
        'wallet_shares',
        `wallet_id=eq.${walletId}&username=eq.${encodeURIComponent(username)}`
      );
    } catch {}

    // 2. Update Supabase wallets.shared_with
    try {
      const remaining = await supabaseGet('wallet_shares', `wallet_id=eq.${walletId}&select=*`);
      const membersList = remaining.map((m: any) => ({
        userId: m.user_id,
        username: m.username,
        role: m.role,
      }));

      const hasOtherMembers = membersList.length > 1;

      const remoteWallets = await supabaseGet('wallets', `id=eq.${walletId}&select=*`);
      if (remoteWallets.length > 0) {
        let meta: any = {};
        try {
          meta = JSON.parse(remoteWallets[0].shared_with) || {};
        } catch {}
        meta.members = membersList;
        await supabaseUpdate('wallets', `id=eq.${walletId}`, {
          shared_with: hasOtherMembers ? JSON.stringify(meta) : null,
        });
      }
    } catch {}

    // 3. Remove wallet and its transactions from this member's local device
    const localWallets = await getLocalWallets();
    const filteredWallets = localWallets.filter((w: any) => w.id !== walletId);
    await saveLocalWallets(filteredWallets);

    const localTxns = await getLocalTransactions();
    const filteredTxns = localTxns.filter((t: any) => t.walletId !== walletId);
    await saveLocalTransactions(filteredTxns);

    try {
      const { deleteWallet } = await import('./storage');
      await deleteWallet(walletId);
    } catch {}

    return true;
  } catch (e) {
    console.error('leaveSharedWallet error:', e);
    return false;
  }
}

/**
 * Check if a wallet is actively shared with other members.
 */
export function isWalletShared(sharedWith: string | null | undefined): boolean {
  if (!sharedWith) return false;
  try {
    const parsed = JSON.parse(sharedWith);
    if (Array.isArray(parsed)) return parsed.length > 1;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.members)) {
      return parsed.members.length > 1;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get shared member count from sharedWith JSON string.
 */
export function getSharedMemberCount(sharedWith: string | null | undefined): number {
  if (!sharedWith) return 0;
  try {
    const parsed = JSON.parse(sharedWith);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.members)) {
      return parsed.members.length;
    }
    return 0;
  } catch {
    return 0;
  }
}
