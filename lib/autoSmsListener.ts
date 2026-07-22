import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { parseBankSMS, ParsedBankSMS } from './smsParser';
import { sendImmediateNotification } from './NotificationService';
import { Transaction } from './storage';
import * as Crypto from 'expo-crypto';

const AUTO_SMS_ENABLED_KEY = '@daily_expense_auto_sms_enabled';
const AUTO_SMS_AUTOSAVE_KEY = '@daily_expense_auto_sms_autosave';
const PROCESSED_SMS_HASHES_KEY = '@daily_expense_processed_sms_hashes';

export interface AutoSmsSettings {
  enabled: boolean;
  autoSave: boolean;
}

/**
 * Get current Auto SMS settings
 */
export async function getAutoSmsSettings(): Promise<AutoSmsSettings> {
  try {
    const enabledStr = await AsyncStorage.getItem(AUTO_SMS_ENABLED_KEY);
    const autoSaveStr = await AsyncStorage.getItem(AUTO_SMS_AUTOSAVE_KEY);
    return {
      enabled: enabledStr !== null ? JSON.parse(enabledStr) : true, // enabled by default
      autoSave: autoSaveStr !== null ? JSON.parse(autoSaveStr) : false, // ask before saving by default
    };
  } catch (error) {
    console.error('Error reading Auto SMS settings:', error);
    return { enabled: true, autoSave: false };
  }
}

/**
 * Save Auto SMS Settings
 */
export async function setAutoSmsSettings(settings: Partial<AutoSmsSettings>): Promise<void> {
  try {
    if (settings.enabled !== undefined) {
      await AsyncStorage.setItem(AUTO_SMS_ENABLED_KEY, JSON.stringify(settings.enabled));
    }
    if (settings.autoSave !== undefined) {
      await AsyncStorage.setItem(AUTO_SMS_AUTOSAVE_KEY, JSON.stringify(settings.autoSave));
    }
  } catch (error) {
    console.error('Error saving Auto SMS settings:', error);
  }
}

/**
 * Generate a unique hash for a text to prevent duplicate processing
 */
function hashText(text: string): string {
  let hash = 0;
  const clean = text.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `sms_hash_${Math.abs(hash)}_${clean.length}`;
}

/**
 * Check if an SMS hash has already been processed
 */
export async function isSmsAlreadyProcessed(rawText: string): Promise<boolean> {
  try {
    const hash = hashText(rawText);
    const storedHashesRaw = await AsyncStorage.getItem(PROCESSED_SMS_HASHES_KEY);
    const storedHashes: string[] = storedHashesRaw ? JSON.parse(storedHashesRaw) : [];
    return storedHashes.includes(hash);
  } catch (e) {
    return false;
  }
}

/**
 * Mark an SMS hash as processed
 */
export async function markSmsAsProcessed(rawText: string): Promise<void> {
  try {
    const hash = hashText(rawText);
    const storedHashesRaw = await AsyncStorage.getItem(PROCESSED_SMS_HASHES_KEY);
    let storedHashes: string[] = storedHashesRaw ? JSON.parse(storedHashesRaw) : [];
    if (!storedHashes.includes(hash)) {
      storedHashes.push(hash);
      if (storedHashes.length > 100) {
        storedHashes = storedHashes.slice(-100);
      }
      await AsyncStorage.setItem(PROCESSED_SMS_HASHES_KEY, JSON.stringify(storedHashes));
    }
  } catch (e) {
    console.error('Failed to mark SMS as processed:', e);
  }
}

/**
 * Clear processed SMS history
 */
export async function clearProcessedSmsHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROCESSED_SMS_HASHES_KEY);
  } catch (e) {
    console.error('Error clearing processed SMS history:', e);
  }
}

export interface CheckClipboardResult {
  detected: boolean;
  parsed: ParsedBankSMS | null;
  autoSaved: boolean;
}

/**
 * Inspect clipboard text to detect new bank SMS automatically
 */
export async function checkClipboardForBankSMS(
  addTransactionFn?: (tx: Transaction) => Promise<void>,
  walletId?: string
): Promise<CheckClipboardResult> {
  // Disable automatic background clipboard reading on web to prevent OS/Browser system 'Paste' popups
  if (Platform.OS === 'web') {
    return { detected: false, parsed: null, autoSaved: false };
  }

  const settings = await getAutoSmsSettings();
  if (!settings.enabled) {
    return { detected: false, parsed: null, autoSaved: false };
  }

  try {
    const hasText = await Clipboard.hasStringAsync();
    if (!hasText) return { detected: false, parsed: null, autoSaved: false };

    const clipboardText = await Clipboard.getStringAsync();
    if (!clipboardText || clipboardText.trim().length < 8) {
      return { detected: false, parsed: null, autoSaved: false };
    }

    // Check if already processed
    const alreadyProcessed = await isSmsAlreadyProcessed(clipboardText);
    if (alreadyProcessed) {
      return { detected: false, parsed: null, autoSaved: false };
    }

    // Try parsing
    const parsed = parseBankSMS(clipboardText);
    if (!parsed || parsed.amount === null || parsed.confidenceScore < 0.5) {
      return { detected: false, parsed: null, autoSaved: false };
    }

    // Valid new SMS detected!
    let autoSaved = false;

    // If autoSave mode is ON and we have addTransaction function & walletId
    if (settings.autoSave && addTransactionFn && walletId) {
      const newTransaction: Transaction = {
        id: Crypto.randomUUID(),
        walletId: walletId,
        type: parsed.type,
        amount: parsed.amount,
        category: parsed.category || 'other',
        description: `${parsed.merchant} (${parsed.bankName})`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        note: `📱 أتمتة رسائل البنك تلقائياً\n${parsed.rawText}`,
      };

      await addTransactionFn(newTransaction);
      await markSmsAsProcessed(parsed.rawText);
      autoSaved = true;

      // Send immediate local notification confirming auto-save
      const amountFormatted = `${parsed.amount} ${parsed.currency}`;
      await sendImmediateNotification(
        '📱 تم تسجيل المعاملة تلقائياً',
        `تم تسجيل ${parsed.type === 'expense' ? 'مصروف' : 'إيداع'} بقيمة ${amountFormatted} - ${parsed.merchant}`
      );
    }

    return {
      detected: true,
      parsed,
      autoSaved,
    };
  } catch (error) {
    console.error('Error checking clipboard for Bank SMS:', error);
    return { detected: false, parsed: null, autoSaved: false };
  }
}
