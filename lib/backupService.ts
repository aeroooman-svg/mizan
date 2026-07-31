/**
 * Full Data Backup & Restore Engine (lib/backupService.ts)
 * 
 * Allows users to generate an encrypted/formatted JSON backup file containing all
 * wallets, transactions, savings goals, debts, budgets, recurring items, and financial plans,
 * and restore them seamlessly on any iOS, Android, or Web device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Platform } from 'react-native';

export interface FullBackupPayload {
  version: string;
  timestamp: string;
  transactions: any[];
  wallets: any[];
  goals: any[];
  debts: any[];
  budgets: any;
  customCategories: any[];
  recurring: any[];
  plans: any[];
}

/**
 * Helper: read from primary @mizan_ key first, fallback to legacy @masarif_ key.
 */
async function getWithFallback(primaryKey: string, legacyKey: string): Promise<string | null> {
  const val = await AsyncStorage.getItem(primaryKey);
  if (val) return val;
  return AsyncStorage.getItem(legacyKey);
}

export async function createFullBackup(): Promise<string> {
  const [
    txData,
    walletsData,
    goalsData,
    debtsData,
    budgetsData,
    customCatsData,
    recurringData,
    plansData,
  ] = await Promise.all([
    getWithFallback('@mizan_transactions', '@masarif_transactions'),
    getWithFallback('@mizan_wallets', '@masarif_wallets'),
    getWithFallback('@masarif_goals', '@masarif_goals'),
    getWithFallback('@masarif_debts', '@masarif_debts'),
    getWithFallback('@masarif_category_budgets', '@masarif_category_budgets'),
    getWithFallback('@masarif_custom_categories', '@masarif_custom_categories'),
    getWithFallback('@masarif_recurring_transactions', '@masarif_recurring_transactions'),
    getWithFallback('@masarif_financial_plans', '@masarif_financial_plans'),
  ]);

  const payload: FullBackupPayload = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    transactions: txData ? JSON.parse(txData) : [],
    wallets: walletsData ? JSON.parse(walletsData) : [],
    goals: goalsData ? JSON.parse(goalsData) : [],
    debts: debtsData ? JSON.parse(debtsData) : [],
    budgets: budgetsData ? JSON.parse(budgetsData) : {},
    customCategories: customCatsData ? JSON.parse(customCatsData) : [],
    recurring: recurringData ? JSON.parse(recurringData) : [],
    plans: plansData ? JSON.parse(plansData) : [],
  };

  const jsonString = JSON.stringify(payload, null, 2);

  if (Platform.OS === 'web') {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mizan_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return jsonString;
  }

  try {
    const fileUri = await Print.printToFileAsync({
      html: `<pre>${jsonString}</pre>`,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri.uri, {
        mimeType: 'application/json',
        dialogTitle: 'تصدير النسخة الاحتياطية (MIZAN Backup)',
      });
    }
  } catch (err) {
    console.error('Backup share error:', err);
  }

  return jsonString;
}

export async function restoreFullBackup(jsonPayload: string): Promise<boolean> {
  try {
    const parsed: FullBackupPayload = JSON.parse(jsonPayload);
    if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.wallets)) {
      throw new Error('Invalid backup file structure');
    }

    // Write to both primary (@mizan_) and legacy (@masarif_) keys for full compatibility
    const writes: Promise<void>[] = [];

    if (parsed.transactions) {
      const data = JSON.stringify(parsed.transactions);
      writes.push(AsyncStorage.setItem('@mizan_transactions', data));
      writes.push(AsyncStorage.setItem('@masarif_transactions', data));
    }
    if (parsed.wallets) {
      const data = JSON.stringify(parsed.wallets);
      writes.push(AsyncStorage.setItem('@mizan_wallets', data));
      writes.push(AsyncStorage.setItem('@masarif_wallets', data));
    }
    if (parsed.goals) {
      const data = JSON.stringify(parsed.goals);
      writes.push(AsyncStorage.setItem('@masarif_goals', data));
    }
    if (parsed.debts) {
      const data = JSON.stringify(parsed.debts);
      writes.push(AsyncStorage.setItem('@masarif_debts', data));
    }
    if (parsed.budgets) {
      const data = JSON.stringify(parsed.budgets);
      writes.push(AsyncStorage.setItem('@masarif_category_budgets', data));
    }
    if (parsed.customCategories) {
      const data = JSON.stringify(parsed.customCategories);
      writes.push(AsyncStorage.setItem('@masarif_custom_categories', data));
    }
    if (parsed.recurring) {
      const data = JSON.stringify(parsed.recurring);
      writes.push(AsyncStorage.setItem('@masarif_recurring_transactions', data));
    }
    if (parsed.plans) {
      const data = JSON.stringify(parsed.plans);
      writes.push(AsyncStorage.setItem('@masarif_financial_plans', data));
    }

    await Promise.all(writes);

    return true;
  } catch (err) {
    console.error('Failed to restore backup:', err);
    return false;
  }
}

