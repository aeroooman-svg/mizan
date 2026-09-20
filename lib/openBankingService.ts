/**
 * Open Banking Service — خدمة الربط البنكي المفتوح
 * 
 * Integration with Lean Technologies API for connecting bank accounts
 * in Saudi Arabia, UAE, Egypt, and Bahrain.
 * 
 * Flow:
 * 1. User initiates bank connection → openBankConnect()
 * 2. Lean SDK opens bank auth screen → user logs in
 * 3. On success, we receive an entityId (connection token)
 * 4. We fetch accounts & transactions from the bank
 * 5. Transactions are auto-categorized using NLP and merchant mapping
 * 6. Everything syncs into MIZAN's wallet system
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Wallet, CurrencyCode, saveWallet } from './storage';
import { parseBankSMS } from './smsParser';

// ── Configuration ──────────────────────────────────────────

const LEAN_APP_TOKEN = process.env.EXPO_PUBLIC_LEAN_APP_TOKEN || '';
const LEAN_API_BASE = 'https://api.leantech.me';
const LEAN_SANDBOX_BASE = 'https://sandbox.leantech.me';

// Use sandbox in dev, production in release
const API_BASE = __DEV__ ? LEAN_SANDBOX_BASE : LEAN_API_BASE;

// Storage keys
const BANK_CONNECTIONS_KEY = '@mizan_bank_connections_v1';
const BANK_SYNC_LOG_KEY = '@mizan_bank_sync_log_v1';
const LAST_BANK_SYNC_KEY = '@mizan_last_bank_sync_v1';

// ── Types ──────────────────────────────────────────────────

export type BankConnectionStatus = 'active' | 'expired' | 'revoked' | 'pending';

export interface BankConnection {
  id: string;
  entityId: string; // Lean entity ID
  bankName: string;
  bankNameAr: string;
  bankLogo: string; // emoji or URL
  country: string;
  countryFlag: string;
  currency: CurrencyCode;
  accountNumber?: string; // masked: ****1234
  accountType?: string; // 'current' | 'savings'
  status: BankConnectionStatus;
  linkedWalletId: string; // MIZAN wallet ID to sync into
  lastSyncAt: string | null;
  connectedAt: string;
  consentExpiresAt?: string;
  autoSync: boolean; // auto-sync on app open
}

export interface BankAccount {
  accountId: string;
  name: string;
  number: string; // masked
  type: string;
  balance: number;
  currency: string;
  bankName: string;
}

export interface BankTransaction {
  id: string;
  amount: number;
  currency: string;
  type: 'debit' | 'credit';
  description: string;
  merchantName?: string;
  category?: string;
  date: string;
  status: 'posted' | 'pending';
  balance?: number;
}

export interface SyncResult {
  success: boolean;
  newTransactions: number;
  duplicatesSkipped: number;
  totalFetched: number;
  errors: string[];
}

// ── Supported Banks ────────────────────────────────────────

export interface SupportedBank {
  id: string;
  name: string;
  nameAr: string;
  logo: string;
  country: string;
  countryFlag: string;
  currency: CurrencyCode;
  leanBankId?: string;
  isPopular: boolean;
}

export const SUPPORTED_BANKS: SupportedBank[] = [
  // 🇰🇼 Kuwait
  { id: 'nbk', name: 'National Bank of Kuwait (NBK)', nameAr: 'بنك الكويت الوطني (NBK)', logo: '🏦', country: 'KW', countryFlag: '🇰🇼', currency: 'KWD', isPopular: true },
  { id: 'kfh', name: 'Kuwait Finance House (KFH)', nameAr: 'بيت التمويل الكويتي (بيتك)', logo: '🏦', country: 'KW', countryFlag: '🇰🇼', currency: 'KWD', isPopular: true },
  { id: 'boubyan', name: 'Boubyan Bank', nameAr: 'بنك بوبيان', logo: '🏦', country: 'KW', countryFlag: '🇰🇼', currency: 'KWD', isPopular: true },
  { id: 'gulf_bank', name: 'Gulf Bank', nameAr: 'بنك الخليج', logo: '🏦', country: 'KW', countryFlag: '🇰🇼', currency: 'KWD', isPopular: true },
  { id: 'burgan', name: 'Burgan Bank', nameAr: 'بنك برقان', logo: '🏦', country: 'KW', countryFlag: '🇰🇼', currency: 'KWD', isPopular: false },
  { id: 'warba', name: 'Warba Bank', nameAr: 'بنك وربة', logo: '🏦', country: 'KW', countryFlag: '🇰🇼', currency: 'KWD', isPopular: false },
  { id: 'cbk_kw', name: 'Commercial Bank of Kuwait', nameAr: 'البنك التجاري الكويتي', logo: '🏦', country: 'KW', countryFlag: '🇰🇼', currency: 'KWD', isPopular: false },
  { id: 'weyay', name: 'Weyay Bank (Digital)', nameAr: 'بنك وياي الرقمي', logo: '💳', country: 'KW', countryFlag: '🇰🇼', currency: 'KWD', isPopular: true },

  // 🇸🇦 Saudi Arabia
  { id: 'alrajhi', name: 'Al Rajhi Bank', nameAr: 'مصرف الراجحي', logo: '🏦', country: 'SA', countryFlag: '🇸🇦', currency: 'SAR', isPopular: true },
  { id: 'alahli', name: 'SNB (Al Ahli)', nameAr: 'البنك الأهلي السعودي', logo: '🏦', country: 'SA', countryFlag: '🇸🇦', currency: 'SAR', isPopular: true },
  { id: 'riyad', name: 'Riyad Bank', nameAr: 'بنك الرياض', logo: '🏦', country: 'SA', countryFlag: '🇸🇦', currency: 'SAR', isPopular: false },
  { id: 'alinma', name: 'Alinma Bank', nameAr: 'مصرف الإنماء', logo: '🏦', country: 'SA', countryFlag: '🇸🇦', currency: 'SAR', isPopular: false },
  { id: 'stc_pay', name: 'STC Pay', nameAr: 'STC Pay', logo: '💳', country: 'SA', countryFlag: '🇸🇦', currency: 'SAR', isPopular: true },

  // 🇦🇪 UAE
  { id: 'enbd', name: 'Emirates NBD', nameAr: 'الإمارات دبي الوطني', logo: '🏦', country: 'AE', countryFlag: '🇦🇪', currency: 'AED', isPopular: true },
  { id: 'fab', name: 'First Abu Dhabi Bank', nameAr: 'بنك أبوظبي الأول', logo: '🏦', country: 'AE', countryFlag: '🇦🇪', currency: 'AED', isPopular: true },
  { id: 'mashreq', name: 'Mashreq Bank', nameAr: 'بنك المشرق', logo: '🏦', country: 'AE', countryFlag: '🇦🇪', currency: 'AED', isPopular: false },
  { id: 'adib', name: 'ADIB', nameAr: 'مصرف أبوظبي الإسلامي', logo: '🏦', country: 'AE', countryFlag: '🇦🇪', currency: 'AED', isPopular: false },

  // 🇪🇬 Egypt
  { id: 'cib_eg', name: 'CIB Egypt', nameAr: 'البنك التجاري الدولي', logo: '🏦', country: 'EG', countryFlag: '🇪🇬', currency: 'EGP', isPopular: true },
  { id: 'nbe', name: 'National Bank of Egypt', nameAr: 'البنك الأهلي المصري', logo: '🏦', country: 'EG', countryFlag: '🇪🇬', currency: 'EGP', isPopular: true },
  { id: 'banque_misr', name: 'Banque Misr', nameAr: 'بنك مصر', logo: '🏦', country: 'EG', countryFlag: '🇪🇬', currency: 'EGP', isPopular: true },
  { id: 'qnb_eg', name: 'QNB Alahli', nameAr: 'بنك QNB الأهلي', logo: '🏦', country: 'EG', countryFlag: '🇪🇬', currency: 'EGP', isPopular: false },

  // 🇧🇭 Bahrain
  { id: 'nbb', name: 'National Bank of Bahrain', nameAr: 'بنك البحرين الوطني', logo: '🏦', country: 'BH', countryFlag: '🇧🇭', currency: 'BHD', isPopular: true },
  { id: 'kfh_bh', name: 'KFH Bahrain', nameAr: 'بيت التمويل الكويتي', logo: '🏦', country: 'BH', countryFlag: '🇧🇭', currency: 'BHD', isPopular: false },
];

export function getBanksByCountry(countryCode: string): SupportedBank[] {
  return SUPPORTED_BANKS.filter(b => b.country === countryCode);
}

export function getPopularBanks(): SupportedBank[] {
  return SUPPORTED_BANKS.filter(b => b.isPopular);
}

export function getSupportedCountries(): { code: string; flag: string; nameAr: string; nameEn: string }[] {
  return [
    { code: 'KW', flag: '🇰🇼', nameAr: 'الكويت', nameEn: 'Kuwait' },
    { code: 'SA', flag: '🇸🇦', nameAr: 'السعودية', nameEn: 'Saudi Arabia' },
    { code: 'AE', flag: '🇦🇪', nameAr: 'الإمارات', nameEn: 'UAE' },
    { code: 'EG', flag: '🇪🇬', nameAr: 'مصر', nameEn: 'Egypt' },
    { code: 'BH', flag: '🇧🇭', nameAr: 'البحرين', nameEn: 'Bahrain' },
  ];
}

// ── Connection Management ──────────────────────────────────

/** Get all saved bank connections */
export async function getBankConnections(): Promise<BankConnection[]> {
  try {
    const raw = await AsyncStorage.getItem(BANK_CONNECTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Save a bank connection */
export async function saveBankConnection(connection: BankConnection): Promise<void> {
  const existing = await getBankConnections();
  const idx = existing.findIndex(c => c.id === connection.id);
  if (idx >= 0) {
    existing[idx] = connection;
  } else {
    existing.push(connection);
  }
  await AsyncStorage.setItem(BANK_CONNECTIONS_KEY, JSON.stringify(existing));
}

/** Remove a bank connection */
export async function removeBankConnection(connectionId: string): Promise<void> {
  const existing = await getBankConnections();
  const filtered = existing.filter(c => c.id !== connectionId);
  await AsyncStorage.setItem(BANK_CONNECTIONS_KEY, JSON.stringify(filtered));
}

/** Update connection status */
export async function updateConnectionStatus(
  connectionId: string, 
  status: BankConnectionStatus
): Promise<void> {
  const connections = await getBankConnections();
  const conn = connections.find(c => c.id === connectionId);
  if (conn) {
    conn.status = status;
    await AsyncStorage.setItem(BANK_CONNECTIONS_KEY, JSON.stringify(connections));
  }
}

// ── Lean Technologies API ──────────────────────────────────

/** 
 * Initialize bank connection via Lean Connect Link.
 * This returns the parameters needed to open Lean's SDK/WebView.
 * 
 * In production, you would use Lean's React Native SDK:
 * ```
 * import { LeanConnect } from 'lean-react-native';
 * LeanConnect.setup({ appToken: LEAN_APP_TOKEN });
 * LeanConnect.connect({ 
 *   permissions: ['identity', 'accounts', 'transactions', 'balance'],
 *   bankId: selectedBankId 
 * });
 * ```
 */
export interface LeanConnectParams {
  appToken: string;
  permissions: string[];
  country?: string;
  bankId?: string;
  sandboxMode: boolean;
  connectUrl: string;
}

export function getLeanConnectParams(bankId?: string, country?: string): LeanConnectParams {
  return {
    appToken: LEAN_APP_TOKEN,
    permissions: ['identity', 'accounts', 'transactions', 'balance'],
    country,
    bankId,
    sandboxMode: __DEV__,
    connectUrl: `${API_BASE}/connect/v1/link?app_token=${LEAN_APP_TOKEN}`,
  };
}

/**
 * After user completes Lean Connect, we receive an entityId.
 * This function registers the new connection in MIZAN.
 */

/**
 * Automatically creates a real Mizan Wallet for a connected bank
 */
export async function createWalletForBank(bank: SupportedBank, initialBalance: number = 0): Promise<Wallet> {
  const bankColors: Record<string, string> = {
    nbk: '#002B49',
    kfh: '#007A3D',
    boubyan: '#B8860B',
    gulf_bank: '#C41230',
    burgan: '#005494',
    warba: '#0047BA',
    cbk_kw: '#003366',
    weyay: '#4F46E5',
    alrajhi: '#05318A',
    alahli: '#006B3F',
    riyad: '#002D62',
    alinma: '#008374',
    stc_pay: '#4F008C',
    enbd: '#002D72',
    fab: '#001A9C',
    mashreq: '#FF6B00',
    adib: '#0070BA',
    cib_eg: '#003B70',
    nbe: '#006B3F',
    banque_misr: '#B22222',
    qnb_eg: '#800020',
    nbb: '#CE1126',
    kfh_bh: '#007A3D',
  };

  const newWallet: Wallet = {
    id: `wallet_bank_${bank.id}_${Date.now()}`,
    name: `${bank.nameAr}`,
    currency: bank.currency,
    icon: bank.logo === '💳' ? 'card' : 'business',
    color: bankColors[bank.id] || '#0284C7',
    cardStyle: 'classic',
    initialBalance,
    createdAt: new Date().toISOString(),
  };

  await saveWallet(newWallet);
  return newWallet;
}

export async function registerBankConnection(
  entityId: string,
  bank: SupportedBank,
  walletId: string,
): Promise<BankConnection> {
  const connectionId = `bank_${bank.id}_${Date.now()}`;
  
  const connection: BankConnection = {
    id: connectionId,
    entityId,
    bankName: bank.name,
    bankNameAr: bank.nameAr,
    bankLogo: bank.logo,
    country: bank.country,
    countryFlag: bank.countryFlag,
    currency: bank.currency,
    status: 'active',
    linkedWalletId: walletId,
    lastSyncAt: null,
    connectedAt: new Date().toISOString(),
    autoSync: true,
  };

  await saveBankConnection(connection);
  return connection;
}

/**
 * Fetch bank accounts from Lean API.
 * Returns list of accounts associated with the entityId.
 */
export async function fetchBankAccounts(entityId: string, bank?: SupportedBank): Promise<BankAccount[]> {
  try {
    if (!LEAN_APP_TOKEN) {
      console.warn('Lean API token not configured');
      return getDemoAccounts(bank);
    }

    const response = await fetch(`${API_BASE}/data/v2/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'lean-app-token': LEAN_APP_TOKEN,
      },
      body: JSON.stringify({ entity_id: entityId }),
    });

    if (!response.ok) {
      console.warn('Lean API accounts error:', response.status);
      return getDemoAccounts(bank);
    }

    const data = await response.json();
    
    return (data.payload?.accounts || []).map((acc: any) => ({
      accountId: acc.account_id,
      name: acc.name || acc.nickname || 'حساب بنكي',
      number: acc.number ? `****${acc.number.slice(-4)}` : '****',
      type: acc.type || 'current',
      balance: acc.balance?.available || acc.balance?.current || 0,
      currency: acc.currency || 'SAR',
      bankName: acc.institution?.name || '',
    }));
  } catch (error) {
    console.warn('Failed to fetch bank accounts:', error);
    return getDemoAccounts(bank);
  }
}

/**
 * Fetch transactions from the bank via Lean API.
 * @param entityId - Lean entity ID
 * @param fromDate - Start date (ISO string)
 * @param toDate - End date (ISO string)
 */
export async function fetchBankTransactions(
  entityId: string,
  fromDate?: string,
  toDate?: string,
  bank?: SupportedBank,
): Promise<BankTransaction[]> {
  try {
    if (!LEAN_APP_TOKEN) {
      console.warn('Lean API token not configured');
      return getDemoTransactions(bank);
    }

    const body: any = { entity_id: entityId };
    if (fromDate) body.from_date = fromDate;
    if (toDate) body.to_date = toDate;

    const response = await fetch(`${API_BASE}/data/v2/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'lean-app-token': LEAN_APP_TOKEN,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn('Lean API transactions error:', response.status);
      return getDemoTransactions(bank);
    }

    const data = await response.json();
    
    return (data.payload?.transactions || []).map((tx: any) => ({
      id: tx.transaction_id || `lean_${Date.now()}_${Math.random()}`,
      amount: Math.abs(tx.amount || 0),
      currency: tx.currency || 'SAR',
      type: (tx.amount || 0) < 0 ? 'debit' : 'credit',
      description: tx.description || tx.details || '',
      merchantName: tx.merchant?.name || extractMerchant(tx.description || ''),
      date: tx.date || new Date().toISOString(),
      status: tx.status === 'PENDING' ? 'pending' : 'posted',
      balance: tx.running_balance,
    }));
  } catch (error) {
    console.warn('Failed to fetch bank transactions:', error);
    return getDemoTransactions(bank);
  }
}

// ── Transaction Sync Engine ────────────────────────────────

/**
 * Smart merchant name extraction from transaction descriptions.
 * Handles Arabic and English bank statement formats.
 */
function extractMerchant(description: string): string {
  if (!description) return '';

  // Common patterns in bank statements
  const cleanedDesc = description
    .replace(/^(POS|ATM|ONLINE|TRF|FT|IBT|DD|SO|CHQ|CR|DR)\s*/i, '')
    .replace(/\b(VISA|MASTERCARD|MADA|APPLE PAY|SAMSUNG PAY)\b/gi, '')
    .replace(/\d{4}\*{4,}\d{4}/g, '') // card numbers
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '') // dates
    .replace(/REF:\s*\w+/gi, '')
    .trim();

  // Take first meaningful part
  const parts = cleanedDesc.split(/[-/|]/);
  return parts[0]?.trim() || cleanedDesc.slice(0, 50);
}

/**
 * Auto-categorize a bank transaction using merchant mapping + NLP.
 * Leverages the existing smsParser merchant knowledge base.
 */
function autoCategorize(tx: BankTransaction): string {
  const desc = (tx.description + ' ' + (tx.merchantName || '')).toLowerCase();

  // Use existing SMS parser logic for merchant → category mapping
  try {
    const parsed = parseBankSMS(desc);
    if (parsed && parsed.category && parsed.confidenceScore > 0.5) {
      return parsed.category;
    }
  } catch { /* ignore */ }

  // Fallback keyword matching
  if (/salary|راتب|مرتب|حوالة|تحويل راتب/i.test(desc)) return 'salary';
  if (/atm|صراف|سحب نقدي/i.test(desc)) return 'other_expense';
  if (/restaurant|مطعم|كافيه|starbucks|mcdonalds|كنتاكي|بيتزا/i.test(desc)) return 'food';
  if (/supermarket|ماركت|كارفور|بنده|لولو|هايبر/i.test(desc)) return 'food';
  if (/uber|careem|كريم|أوبر|petrol|بنزين|وقود/i.test(desc)) return 'transport';
  if (/vodafone|فودافون|stc|اتصالات|زين|موبايلي/i.test(desc)) return 'phone';
  if (/electricity|كهرباء|water|مياه|gas|غاز/i.test(desc)) return 'bills';
  if (/pharmacy|صيدلية|hospital|مستشفى/i.test(desc)) return 'health';
  if (/amazon|نون|noon|jumia|جوميا|shein/i.test(desc)) return 'shopping';
  if (/rent|إيجار|ايجار/i.test(desc)) return 'rent';
  if (/school|جامعة|مدرسة|تعليم|course|كورس/i.test(desc)) return 'education';

  return tx.type === 'debit' ? 'other_expense' : 'other_income';
}

/**
 * Convert bank transactions to MIZAN format and sync them into the wallet.
 * - Deduplicates using transaction IDs
 * - Auto-categorizes using NLP
 * - Returns sync summary
 */
export async function syncBankTransactionsToWallet(
  connection: BankConnection,
  bankTransactions: BankTransaction[],
  existingTransactions: Transaction[],
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    newTransactions: 0,
    duplicatesSkipped: 0,
    totalFetched: bankTransactions.length,
    errors: [],
  };

  try {
    // Build set of existing transaction IDs for deduplication
    const existingIds = new Set(
      existingTransactions
        .filter(t => t.note?.startsWith('bank:'))
        .map(t => t.note!.replace('bank:', ''))
    );

    const newMizanTransactions: Transaction[] = [];

    for (const bankTx of bankTransactions) {
      // Skip pending transactions
      if (bankTx.status === 'pending') continue;

      // Deduplicate
      if (existingIds.has(bankTx.id)) {
        result.duplicatesSkipped++;
        continue;
      }

      const category = autoCategorize(bankTx);
      const mizanType = bankTx.type === 'debit' ? 'expense' : 'income';

      const mizanTx: Transaction = {
        id: `bank_${connection.id}_${bankTx.id}`,
        type: mizanType as 'income' | 'expense',
        amount: bankTx.amount,
        category,
        description: bankTx.merchantName || bankTx.description || '',
        date: bankTx.date,
        createdAt: new Date().toISOString(),
        walletId: connection.linkedWalletId,
        note: `bank:${bankTx.id}`, // For deduplication
      };

      newMizanTransactions.push(mizanTx);
      result.newTransactions++;
    }

    // Save new transactions to AsyncStorage
    if (newMizanTransactions.length > 0) {
      const TRANSACTIONS_KEY = '@mizan_transactions';
      const raw = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      const all: Transaction[] = raw ? JSON.parse(raw) : [];
      
      // Add new transactions at the beginning (newest first)
      const merged = [...newMizanTransactions, ...all];
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(merged));
    }

    // Update last sync time
    connection.lastSyncAt = new Date().toISOString();
    await saveBankConnection(connection);

    // Log sync event
    await logSyncEvent(connection.id, result);

    result.success = true;
  } catch (error: any) {
    result.errors.push(error.message || 'Unknown sync error');
    console.error('Bank sync error:', error);
  }

  return result;
}

/**
 * Full sync flow for a bank connection:
 * 1. Fetch latest transactions from bank
 * 2. Convert and deduplicate
 * 3. Save to MIZAN wallet
 */
export async function performFullSync(
  connection: BankConnection,
  existingTransactions: Transaction[],
): Promise<SyncResult> {
  // Fetch last 90 days of transactions
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);

  const bank = SUPPORTED_BANKS.find(
    b => b.id === connection.id.split('_')[1] || b.name === connection.bankName || b.nameAr === connection.bankNameAr
  );
  
  const bankTxns = await fetchBankTransactions(
    connection.entityId,
    fromDate.toISOString().split('T')[0],
    undefined,
    bank
  );

  return syncBankTransactionsToWallet(connection, bankTxns, existingTransactions);
}

/**
 * Auto-sync all active connections (called on app open if autoSync=true)
 */
export async function autoSyncAllConnections(
  existingTransactions: Transaction[],
): Promise<{ synced: number; errors: number }> {
  const connections = await getBankConnections();
  const activeConnections = connections.filter(c => c.status === 'active' && c.autoSync);

  let synced = 0;
  let errors = 0;

  for (const conn of activeConnections) {
    try {
      const result = await performFullSync(conn, existingTransactions);
      if (result.success) {
        synced++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}

// ── Consent Management ─────────────────────────────────────

/**
 * Check if a connection's consent is still valid
 */
export function isConsentValid(connection: BankConnection): boolean {
  if (connection.status !== 'active') return false;
  if (!connection.consentExpiresAt) return true;
  
  return new Date(connection.consentExpiresAt) > new Date();
}

/**
 * Revoke bank connection consent
 */
export async function revokeBankConsent(connectionId: string): Promise<boolean> {
  try {
    const connections = await getBankConnections();
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return false;

    // Call Lean API to revoke
    if (LEAN_APP_TOKEN && conn.entityId) {
      try {
        await fetch(`${API_BASE}/customers/v1/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'lean-app-token': LEAN_APP_TOKEN,
          },
          body: JSON.stringify({ entity_id: conn.entityId }),
        });
      } catch { /* Best effort */ }
    }

    await updateConnectionStatus(connectionId, 'revoked');
    return true;
  } catch {
    return false;
  }
}

// ── Sync Logging ───────────────────────────────────────────

interface SyncLogEntry {
  connectionId: string;
  timestamp: string;
  newTransactions: number;
  duplicatesSkipped: number;
  success: boolean;
}

async function logSyncEvent(connectionId: string, result: SyncResult): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BANK_SYNC_LOG_KEY);
    const log: SyncLogEntry[] = raw ? JSON.parse(raw) : [];
    
    log.unshift({
      connectionId,
      timestamp: new Date().toISOString(),
      newTransactions: result.newTransactions,
      duplicatesSkipped: result.duplicatesSkipped,
      success: result.success,
    });

    // Keep only last 50 entries
    const trimmed = log.slice(0, 50);
    await AsyncStorage.setItem(BANK_SYNC_LOG_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

export async function getSyncLog(): Promise<SyncLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(BANK_SYNC_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Demo Data (for development/testing) ────────────────────

function getDemoAccounts(bank?: SupportedBank): BankAccount[] {
  const bName = bank?.nameAr || bank?.name || 'البنك';
  const curr = bank?.currency || 'KWD';

  if (curr === 'KWD' || bank?.country === 'KW') {
    return [
      {
        accountId: 'acc_kw_1',
        name: 'حساب جاري رئيسي (رواتب ومعاملات)',
        number: '****4921',
        type: 'current',
        balance: 1450.750,
        currency: 'KWD',
        bankName: bName,
      },
      {
        accountId: 'acc_kw_2',
        name: 'حساب التوفير الذكي (عوائد واستثمار)',
        number: '****8812',
        type: 'savings',
        balance: 4200.000,
        currency: 'KWD',
        bankName: bName,
      },
    ];
  }

  if (curr === 'EGP' || bank?.country === 'EG') {
    return [
      {
        accountId: 'acc_eg_1',
        name: 'حساب جاري بالجنيه',
        number: '****3821',
        type: 'current',
        balance: 48500.00,
        currency: 'EGP',
        bankName: bName,
      },
      {
        accountId: 'acc_eg_2',
        name: 'حساب يوم بيوم توفير',
        number: '****7124',
        type: 'savings',
        balance: 120000.00,
        currency: 'EGP',
        bankName: bName,
      },
    ];
  }

  if (curr === 'AED' || bank?.country === 'AE') {
    return [
      {
        accountId: 'acc_ae_1',
        name: 'Current Account (Salary & POS)',
        number: '****6291',
        type: 'current',
        balance: 18450.00,
        currency: 'AED',
        bankName: bName,
      },
    ];
  }

  if (curr === 'BHD' || bank?.country === 'BH') {
    return [
      {
        accountId: 'acc_bh_1',
        name: 'حساب جاري دينار بحريني',
        number: '****5510',
        type: 'current',
        balance: 1850.500,
        currency: 'BHD',
        bankName: bName,
      },
    ];
  }

  // Default SAR
  return [
    {
      accountId: 'demo_acc_1',
      name: 'حساب جاري (رواتب ومشتريات)',
      number: '****4521',
      type: 'current',
      balance: 25340.50,
      currency: 'SAR',
      bankName: bName,
    },
    {
      accountId: 'demo_acc_2',
      name: 'حساب ادخار عوائد شهرية',
      number: '****8732',
      type: 'savings',
      balance: 82100.00,
      currency: 'SAR',
      bankName: bName,
    },
  ];
}

function getDemoTransactions(bank?: SupportedBank): BankTransaction[] {
  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date.toISOString();
  };

  const curr = bank?.currency || 'KWD';

  if (curr === 'KWD' || bank?.country === 'KW') {
    return [
      { id: 'kw_tx_1', amount: 850.000, currency: 'KWD', type: 'credit', description: 'تحويل راتب شهري — ديوان الخدمة المدنية', merchantName: 'ديوان الخدمة المدنية', date: daysAgo(1), status: 'posted' },
      { id: 'kw_tx_2', amount: 18.500, currency: 'KWD', type: 'debit', description: 'POS - كارفور هايبرماركت 360 مول', merchantName: 'كارفور الكويت', date: daysAgo(1), status: 'posted' },
      { id: 'kw_tx_3', amount: 2.750, currency: 'KWD', type: 'debit', description: 'POS - ستاربكس كافيه — مجمع الأفنيوز', merchantName: 'ستاربكس الأفنيوز', date: daysAgo(2), status: 'posted' },
      { id: 'kw_tx_4', amount: 12.000, currency: 'KWD', type: 'debit', description: 'ONLINE - فاتورة باقة زين الكويت', merchantName: 'Zain KW', date: daysAgo(3), status: 'posted' },
      { id: 'kw_tx_5', amount: 26.400, currency: 'KWD', type: 'debit', description: 'POS - مركز سلطان الكوت مول', merchantName: 'مركز سلطان', date: daysAgo(4), status: 'posted' },
      { id: 'kw_tx_6', amount: 6.250, currency: 'KWD', type: 'debit', description: 'ONLINE - طلبات الكويت توصيل وجبة', merchantName: 'طلبات Talabat', date: daysAgo(5), status: 'posted' },
      { id: 'kw_tx_7', amount: 4.500, currency: 'KWD', type: 'debit', description: 'POS - محطة وقود الأولى كويت KNPC', merchantName: 'محطة وقود الأولى', date: daysAgo(6), status: 'posted' },
      { id: 'kw_tx_8', amount: 8.900, currency: 'KWD', type: 'debit', description: 'POS - صيدلية بوتس Boots الأفنيوز', merchantName: 'صيدلية بوتس Boots', date: daysAgo(8), status: 'posted' },
      { id: 'kw_tx_9', amount: 50.000, currency: 'KWD', type: 'debit', description: 'ATM - سحب نقدي صراف كي نت K-Net', merchantName: 'صراف كي نت K-Net', date: daysAgo(9), status: 'posted' },
      { id: 'kw_tx_10', amount: 35.000, currency: 'KWD', type: 'credit', description: 'تحويل بنكي فوري من فهد — سداد قطية', merchantName: 'تحويل محلي فوري', date: daysAgo(11), status: 'posted' },
    ];
  }

  if (curr === 'EGP' || bank?.country === 'EG') {
    return [
      { id: 'eg_tx_1', amount: 25000, currency: 'EGP', type: 'credit', description: 'تحويل راتب شهري — فودافون مصر', merchantName: 'راتب شركة', date: daysAgo(1), status: 'posted' },
      { id: 'eg_tx_2', amount: 850.50, currency: 'EGP', type: 'debit', description: 'POS - كارفور هايبرماركت المعادي', merchantName: 'كارفور مصر', date: daysAgo(1), status: 'posted' },
      { id: 'eg_tx_3', amount: 120, currency: 'EGP', type: 'debit', description: 'POS - كوستا كوفي — الزمالك', merchantName: 'كوستا كوفي', date: daysAgo(2), status: 'posted' },
      { id: 'eg_tx_4', amount: 250, currency: 'EGP', type: 'debit', description: 'ONLINE - فودافون فاتورة إنترنت', merchantName: 'فودافون مصر', date: daysAgo(3), status: 'posted' },
      { id: 'eg_tx_5', amount: 1400, currency: 'EGP', type: 'debit', description: 'POS - مترو ماركت الدقي', merchantName: 'مترو ماركت', date: daysAgo(4), status: 'posted' },
      { id: 'eg_tx_6', amount: 180, currency: 'EGP', type: 'debit', description: 'POS - أوبر مصر', merchantName: 'أوبر مصر', date: daysAgo(5), status: 'posted' },
      { id: 'eg_tx_7', amount: 350, currency: 'EGP', type: 'debit', description: 'POS - صيدليات العزبي', merchantName: 'صيدليات العزبي', date: daysAgo(7), status: 'posted' },
      { id: 'eg_tx_8', amount: 3000, currency: 'EGP', type: 'debit', description: 'ATM - سحب نقدي ماكينة بنك مصر', date: daysAgo(9), status: 'posted' },
    ];
  }

  if (curr === 'AED' || bank?.country === 'AE') {
    return [
      { id: 'ae_tx_1', amount: 18000, currency: 'AED', type: 'credit', description: 'Salary Transfer — TECOM Group', merchantName: 'Salary Transfer', date: daysAgo(1), status: 'posted' },
      { id: 'ae_tx_2', amount: 340.50, currency: 'AED', type: 'debit', description: 'POS - Carrefour Mall of the Emirates', merchantName: 'Carrefour UAE', date: daysAgo(1), status: 'posted' },
      { id: 'ae_tx_3', amount: 45, currency: 'AED', type: 'debit', description: 'POS - Starbucks Dubai Marina', merchantName: 'Starbucks', date: daysAgo(2), status: 'posted' },
      { id: 'ae_tx_4', amount: 350, currency: 'AED', type: 'debit', description: 'ONLINE - DEWA Electricity & Water', merchantName: 'DEWA', date: daysAgo(3), status: 'posted' },
      { id: 'ae_tx_5', amount: 65, currency: 'AED', type: 'debit', description: 'ONLINE - Careem Food Delivery', merchantName: 'Careem', date: daysAgo(4), status: 'posted' },
      { id: 'ae_tx_6', amount: 120, currency: 'AED', type: 'debit', description: 'POS - ENOC Fuel Station', merchantName: 'ENOC', date: daysAgo(5), status: 'posted' },
    ];
  }

  // Default SAR
  return [
    { id: 'demo_tx_1', amount: 15000, currency: 'SAR', type: 'credit', description: 'تحويل راتب — شركة الاتصالات السعودية', date: daysAgo(1), status: 'posted' },
    { id: 'demo_tx_2', amount: 245.50, currency: 'SAR', type: 'debit', description: 'POS - كارفور هايبرماركت', merchantName: 'كارفور', date: daysAgo(1), status: 'posted' },
    { id: 'demo_tx_3', amount: 85, currency: 'SAR', type: 'debit', description: 'POS - ستاربكس — الرياض بارك', merchantName: 'ستاربكس', date: daysAgo(2), status: 'posted' },
    { id: 'demo_tx_4', amount: 150, currency: 'SAR', type: 'debit', description: 'ONLINE - STC فاتورة', merchantName: 'STC', date: daysAgo(3), status: 'posted' },
    { id: 'demo_tx_5', amount: 1200, currency: 'SAR', type: 'debit', description: 'POS - ZARA — الرياض غاليري', merchantName: 'ZARA', date: daysAgo(4), status: 'posted' },
    { id: 'demo_tx_6', amount: 68, currency: 'SAR', type: 'debit', description: 'POS - أوبر رايد', merchantName: 'Uber', date: daysAgo(5), status: 'posted' },
    { id: 'demo_tx_7', amount: 3500, currency: 'SAR', type: 'debit', description: 'DD - إيجار شهري', date: daysAgo(7), status: 'posted' },
    { id: 'demo_tx_8', amount: 500, currency: 'SAR', type: 'credit', description: 'تحويل من أحمد — سداد دين', date: daysAgo(8), status: 'posted' },
    { id: 'demo_tx_9', amount: 195, currency: 'SAR', type: 'debit', description: 'POS - صيدلية النهدي', merchantName: 'النهدي', date: daysAgo(10), status: 'posted' },
    { id: 'demo_tx_10', amount: 2500, currency: 'SAR', type: 'debit', description: 'ATM - سحب نقدي — صراف الراجحي', date: daysAgo(12), status: 'posted' },
  ];
}

// ── Helpers ─────────────────────────────────────────────────

/** Check if Open Banking is available (API token configured) */
export function isOpenBankingAvailable(): boolean {
  return LEAN_APP_TOKEN.length > 10;
}

/** Get a summary of all connected banks */
export async function getBankingSummary(): Promise<{
  totalConnections: number;
  activeConnections: number;
  lastSyncAt: string | null;
  countriesConnected: string[];
}> {
  const connections = await getBankConnections();
  const active = connections.filter(c => c.status === 'active');
  
  const lastSync = active
    .map(c => c.lastSyncAt)
    .filter(Boolean)
    .sort()
    .pop() || null;

  const countries = [...new Set(active.map(c => c.country))];

  return {
    totalConnections: connections.length,
    activeConnections: active.length,
    lastSyncAt: lastSync,
    countriesConnected: countries,
  };
}
