import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { parseBankSMS, ParsedBankSMS } from './smsParser';
import { saveTransaction, Transaction } from './storage';

export interface ClipboardSmsSettings {
  autoDetect: boolean;
  notifyHaptic: boolean;
  lastProcessedText: string;
}

const SETTINGS_KEY = '@mizan_clipboard_sms_settings_v1';

const DEFAULT_SETTINGS: ClipboardSmsSettings = {
  autoDetect: true,
  notifyHaptic: true,
  lastProcessedText: '',
};

/** Get current clipboard settings */
export async function getClipboardSmsSettings(): Promise<ClipboardSmsSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

/** Save updated clipboard settings */
export async function saveClipboardSmsSettings(settings: Partial<ClipboardSmsSettings>): Promise<ClipboardSmsSettings> {
  try {
    const current = await getClipboardSmsSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

/** Mark text as already processed so it won't prompt again */
export async function markClipboardTextProcessed(text: string): Promise<void> {
  try {
    const current = await getClipboardSmsSettings();
    current.lastProcessedText = text.trim();
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch (e) {
    // silent
  }
}

/**
 * Check if the current clipboard contains a valid Bank / Wallet SMS.
 * Returns { text, parsed } if valid and not processed yet, or null otherwise.
 */
export async function checkClipboardForBankSMS(): Promise<{ text: string; parsed: ParsedBankSMS } | null> {
  try {
    // In web browsers (especially iOS Safari), querying navigator.clipboard.readText()
    // without direct user interaction causes Safari to display a native OS "Paste" callout bubble
    // over whatever button the user just tapped (Close, Back, Home tabs).
    if (Platform.OS === 'web') {
      return null;
    }

    const settings = await getClipboardSmsSettings();
    if (!settings.autoDetect) return null;

    const hasString = await Clipboard.hasStringAsync();
    if (!hasString) return null;

    const clipboardText = await Clipboard.getStringAsync();
    if (!clipboardText || clipboardText.trim().length < 10) return null;

    const trimmed = clipboardText.trim();
    if (trimmed === settings.lastProcessedText) {
      return null; // already handled
    }

    const parsed = parseBankSMS(trimmed);
    if (parsed && parsed.amount !== null && parsed.amount > 0 && parsed.confidenceScore >= 0.5) {
      if (settings.notifyHaptic) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      return { text: trimmed, parsed };
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Convert a ParsedBankSMS directly into a saved Transaction in Mizan
 */
export async function saveParsedSmsTransaction(
  parsed: ParsedBankSMS,
  walletId: string,
  customCategoryId?: string,
  customDescription?: string
): Promise<Transaction> {
  const transactionId = Crypto.randomUUID();
  const desc = customDescription || (parsed.merchant ? `${parsed.merchant} (${parsed.bankName})` : parsed.bankName);
  const cat = customCategoryId || parsed.category || 'other';

  const transaction: Transaction = {
    id: transactionId,
    type: parsed.type,
    amount: parsed.amount ?? 0,
    category: cat,
    description: desc,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    walletId,
    tags: `SMS,${parsed.bankName}`,
  };

  await saveTransaction(transaction);
  await markClipboardTextProcessed(parsed.rawText);

  return transaction;
}
