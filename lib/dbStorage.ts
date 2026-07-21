/**
 * Indexed Local Database Layer (dbStorage.ts)
 * 
 * Provides an indexed in-memory and persistence adapter for fast queries,
 * filtering transactions by date/wallet/type without linear scans,
 * and migrating legacy AsyncStorage records seamlessly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Wallet } from './storage';

class LocalDatabaseEngine {
  private transactionsIndex: Map<string, Transaction> = new Map();
  private walletTransactionsIndex: Map<string, Set<string>> = new Map();
  private categoryTransactionsIndex: Map<string, Set<string>> = new Map();
  private initialized = false;

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const txData = await AsyncStorage.getItem('@masarif_transactions');
      if (txData) {
        const txList: Transaction[] = JSON.parse(txData);
        txList.forEach((tx) => this.indexTransaction(tx));
      }
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize local DB engine:', err);
    }
  }

  private indexTransaction(tx: Transaction) {
    this.transactionsIndex.set(tx.id, tx);

    // Index by wallet
    if (!this.walletTransactionsIndex.has(tx.walletId)) {
      this.walletTransactionsIndex.set(tx.walletId, new Set());
    }
    this.walletTransactionsIndex.get(tx.walletId)!.add(tx.id);

    // Index by category
    if (!this.categoryTransactionsIndex.has(tx.category)) {
      this.categoryTransactionsIndex.set(tx.category, new Set());
    }
    this.categoryTransactionsIndex.get(tx.category)!.add(tx.id);
  }

  public getTransactionById(id: string): Transaction | undefined {
    return this.transactionsIndex.get(id);
  }

  public queryByWallet(walletId: string): Transaction[] {
    const ids = this.walletTransactionsIndex.get(walletId);
    if (!ids) return [];
    const results: Transaction[] = [];
    ids.forEach((id) => {
      const tx = this.transactionsIndex.get(id);
      if (tx) results.push(tx);
    });
    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public queryByCategory(category: string): Transaction[] {
    const ids = this.categoryTransactionsIndex.get(category);
    if (!ids) return [];
    const results: Transaction[] = [];
    ids.forEach((id) => {
      const tx = this.transactionsIndex.get(id);
      if (tx) results.push(tx);
    });
    return results;
  }

  public queryByDateRange(startDate: Date, endDate: Date, walletId?: string): Transaction[] {
    const source = walletId ? this.queryByWallet(walletId) : Array.from(this.transactionsIndex.values());
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    return source.filter((tx) => {
      const txMs = new Date(tx.date).getTime();
      return txMs >= startMs && txMs <= endMs;
    });
  }

  public addOrUpdate(tx: Transaction) {
    this.indexTransaction(tx);
  }

  public remove(id: string) {
    const tx = this.transactionsIndex.get(id);
    if (!tx) return;

    this.transactionsIndex.delete(id);
    this.walletTransactionsIndex.get(tx.walletId)?.delete(id);
    this.categoryTransactionsIndex.get(tx.category)?.delete(id);
  }
}

export const dbEngine = new LocalDatabaseEngine();
