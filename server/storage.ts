import {
  type User,
  type InsertUser,
  type WalletRow,
  type InsertWallet,
  type TransactionRow,
  type InsertTransaction,
  type InsertWalletShare,
  type WalletShareRow,
  users,
  wallets,
  transactions,
  walletShares,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getWallets(): Promise<WalletRow[]>;
  saveWallet(wallet: InsertWallet): Promise<WalletRow>;
  deleteWallet(id: string): Promise<void>;

  getTransactions(): Promise<TransactionRow[]>;
  saveTransaction(txn: InsertTransaction): Promise<TransactionRow>;
  deleteTransaction(id: string): Promise<void>;

  getWalletShares(walletId: string): Promise<WalletShareRow[]>;
  saveWalletShare(share: InsertWalletShare): Promise<WalletShareRow>;
  deleteWalletShare(walletId: string, userId: string): Promise<void>;
  getWalletByShareCode(code: string): Promise<WalletRow | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private wallets: Map<string, WalletRow>;
  private transactions: Map<string, TransactionRow>;
  private walletShares: Map<string, WalletShareRow>;

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.transactions = new Map();
    this.walletShares = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getWallets(): Promise<WalletRow[]> {
    return Array.from(this.wallets.values());
  }

  async saveWallet(wallet: InsertWallet): Promise<WalletRow> {
    const id = wallet.id || randomUUID();
    const newWallet: WalletRow = {
      id,
      name: wallet.name,
      currency: wallet.currency ?? "EGP",
      icon: wallet.icon ?? "account-balance-wallet",
      color: wallet.color ?? "#0D7C66",
      createdAt: wallet.createdAt,
      userId: wallet.userId ?? null,
      sharedWith: wallet.sharedWith ?? null,
      shareCode: wallet.shareCode ?? null,
    };
    this.wallets.set(id, newWallet);
    return newWallet;
  }

  async deleteWallet(id: string): Promise<void> {
    this.wallets.delete(id);
    for (const [txnId, txn] of this.transactions.entries()) {
      if (txn.walletId === id) {
        this.transactions.delete(txnId);
      }
    }
  }

  async getTransactions(): Promise<TransactionRow[]> {
    return Array.from(this.transactions.values());
  }

  async saveTransaction(txn: InsertTransaction): Promise<TransactionRow> {
    const id = txn.id || randomUUID();
    const newTxn: TransactionRow = {
      id,
      type: txn.type,
      amount: txn.amount,
      category: txn.category,
      description: txn.description ?? "",
      date: txn.date,
      createdAt: txn.createdAt,
      walletId: txn.walletId,
      toWalletId: txn.toWalletId ?? null,
      tags: txn.tags ?? null,
      receiptUri: txn.receiptUri ?? null,
      userId: txn.userId ?? null,
      addedBy: txn.addedBy ?? null,
    };
    this.transactions.set(id, newTxn);
    return newTxn;
  }

  async deleteTransaction(id: string): Promise<void> {
    this.transactions.delete(id);
  }

  async getWalletShares(walletId: string): Promise<WalletShareRow[]> {
    return Array.from(this.walletShares.values()).filter(s => s.walletId === walletId);
  }

  async saveWalletShare(share: InsertWalletShare): Promise<WalletShareRow> {
    const id = share.id || randomUUID();
    const newShare: WalletShareRow = {
      id,
      walletId: share.walletId,
      userId: share.userId,
      username: share.username,
      role: share.role ?? "member",
      joinedAt: share.joinedAt,
    };
    this.walletShares.set(id, newShare);
    return newShare;
  }

  async deleteWalletShare(walletId: string, userId: string): Promise<void> {
    for (const [key, share] of this.walletShares.entries()) {
      if (share.walletId === walletId && share.userId === userId) {
        this.walletShares.delete(key);
      }
    }
  }

  async getWalletByShareCode(code: string): Promise<WalletRow | undefined> {
    return Array.from(this.wallets.values()).find(w => w.shareCode === code);
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not initialized");
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not initialized");
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not initialized");
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getWallets(): Promise<WalletRow[]> {
    if (!db) throw new Error("Database not initialized");
    return await db.select().from(wallets);
  }

  async saveWallet(wallet: InsertWallet): Promise<WalletRow> {
    if (!db) throw new Error("Database not initialized");
    const [saved] = await db
      .insert(wallets)
      .values(wallet)
      .onConflictDoUpdate({
        target: wallets.id,
        set: {
          name: wallet.name,
          currency: wallet.currency,
          icon: wallet.icon,
          color: wallet.color,
          createdAt: wallet.createdAt,
          userId: wallet.userId,
          sharedWith: wallet.sharedWith,
          shareCode: wallet.shareCode,
        },
      })
      .returning();
    return saved || (wallet as WalletRow);
  }

  async deleteWallet(id: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    await db.delete(transactions).where(eq(transactions.walletId, id));
    await db.delete(wallets).where(eq(wallets.id, id));
  }

  async getTransactions(): Promise<TransactionRow[]> {
    if (!db) throw new Error("Database not initialized");
    return await db.select().from(transactions);
  }

  async saveTransaction(txn: InsertTransaction): Promise<TransactionRow> {
    if (!db) throw new Error("Database not initialized");
    const [saved] = await db
      .insert(transactions)
      .values(txn)
      .onConflictDoUpdate({
        target: transactions.id,
        set: {
          type: txn.type,
          amount: txn.amount,
          category: txn.category,
          description: txn.description,
          date: txn.date,
          createdAt: txn.createdAt,
          walletId: txn.walletId,
          toWalletId: txn.toWalletId,
          tags: txn.tags,
          receiptUri: txn.receiptUri,
          userId: txn.userId,
          addedBy: txn.addedBy,
        },
      })
      .returning();
    return saved || (txn as TransactionRow);
  }

  async deleteTransaction(id: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async getWalletShares(walletId: string): Promise<WalletShareRow[]> {
    if (!db) throw new Error("Database not initialized");
    return await db.select().from(walletShares).where(eq(walletShares.walletId, walletId));
  }

  async saveWalletShare(share: InsertWalletShare): Promise<WalletShareRow> {
    if (!db) throw new Error("Database not initialized");
    const [saved] = await db
      .insert(walletShares)
      .values(share)
      .onConflictDoUpdate({
        target: walletShares.id,
        set: {
          walletId: share.walletId,
          userId: share.userId,
          username: share.username,
          role: share.role,
          joinedAt: share.joinedAt,
        },
      })
      .returning();
    return saved || (share as WalletShareRow);
  }

  async deleteWalletShare(walletId: string, userId: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");
    const { and } = require("drizzle-orm");
    await db.delete(walletShares).where(and(eq(walletShares.walletId, walletId), eq(walletShares.userId, userId)));
  }

  async getWalletByShareCode(code: string): Promise<WalletRow | undefined> {
    if (!db) throw new Error("Database not initialized");
    const [wallet] = await db.select().from(wallets).where(eq(wallets.shareCode, code));
    return wallet;
  }
}

export const storage = db ? new DatabaseStorage() : new MemStorage();
