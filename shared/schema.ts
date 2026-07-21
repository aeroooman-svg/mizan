import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
  icon: text("icon").notNull().default("account-balance-wallet"),
  color: text("color").notNull().default("#0D7C66"),
  createdAt: text("created_at").notNull(),
  userId: varchar("user_id"), // Optional: linked to user for sync
  sharedWith: text("shared_with"),
  shareCode: varchar("share_code", { length: 8 }), // Unique 6-char code for sharing
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 10 }).notNull(), // 'income', 'expense', or 'transfer'
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
  walletId: varchar("wallet_id").notNull(),
  toWalletId: varchar("to_wallet_id"), // Optional target wallet for transfers
  tags: text("tags"), // Comma-separated tags
  receiptUri: text("receipt_uri"), // scanned receipt file URI
  userId: varchar("user_id"), // Optional: linked to user for sync
  addedBy: text("added_by"), // Username of who added this transaction (for shared wallets)
});

// Shared wallet memberships
export const walletShares = pgTable("wallet_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull(),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  role: varchar("role", { length: 10 }).notNull().default("member"), // 'owner' | 'member'
  joinedAt: text("joined_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertWalletSchema = createInsertSchema(wallets).pick({
  id: true,
  name: true,
  currency: true,
  icon: true,
  color: true,
  createdAt: true,
  userId: true,
  sharedWith: true,
  shareCode: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  id: true,
  type: true,
  amount: true,
  category: true,
  description: true,
  date: true,
  createdAt: true,
  walletId: true,
  toWalletId: true,
  tags: true,
  receiptUri: true,
  userId: true,
  addedBy: true,
});

export const insertWalletShareSchema = createInsertSchema(walletShares).pick({
  id: true,
  walletId: true,
  userId: true,
  username: true,
  role: true,
  joinedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type WalletRow = typeof wallets.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TransactionRow = typeof transactions.$inferSelect;
export type InsertWalletShare = z.infer<typeof insertWalletShareSchema>;
export type WalletShareRow = typeof walletShares.$inferSelect;
