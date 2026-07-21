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
    AsyncStorage.getItem('@masarif_transactions'),
    AsyncStorage.getItem('@masarif_wallets'),
    AsyncStorage.getItem('@masarif_goals'),
    AsyncStorage.getItem('@masarif_debts'),
    AsyncStorage.getItem('@masarif_category_budgets'),
    AsyncStorage.getItem('@masarif_custom_categories'),
    AsyncStorage.getItem('@masarif_recurring_transactions'),
    AsyncStorage.getItem('@masarif_financial_plans'),
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

    if (parsed.transactions) await AsyncStorage.setItem('@masarif_transactions', JSON.stringify(parsed.transactions));
    if (parsed.wallets) await AsyncStorage.setItem('@masarif_wallets', JSON.stringify(parsed.wallets));
    if (parsed.goals) await AsyncStorage.setItem('@masarif_goals', JSON.stringify(parsed.goals));
    if (parsed.debts) await AsyncStorage.setItem('@masarif_debts', JSON.stringify(parsed.debts));
    if (parsed.budgets) await AsyncStorage.setItem('@masarif_category_budgets', JSON.stringify(parsed.budgets));
    if (parsed.customCategories) await AsyncStorage.setItem('@masarif_custom_categories', JSON.stringify(parsed.customCategories));
    if (parsed.recurring) await AsyncStorage.setItem('@masarif_recurring_transactions', JSON.stringify(parsed.recurring));
    if (parsed.plans) await AsyncStorage.setItem('@masarif_financial_plans', JSON.stringify(parsed.plans));

    return true;
  } catch (err) {
    console.error('Failed to restore backup:', err);
    return false;
  }
}
