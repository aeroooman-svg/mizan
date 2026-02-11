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
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 10 }).notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
  walletId: varchar("wallet_id").notNull(),
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
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type WalletRow = typeof wallets.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TransactionRow = typeof transactions.$inferSelect;
