import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { wallets, transactions } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {

  app.get("/api/wallets", async (_req, res) => {
    try {
      const result = await db.select().from(wallets);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/wallets", async (req, res) => {
    try {
      const wallet = req.body;
      await db.insert(wallets).values(wallet).onConflictDoUpdate({
        target: wallets.id,
        set: {
          name: wallet.name,
          currency: wallet.currency,
          icon: wallet.icon,
          color: wallet.color,
          createdAt: wallet.createdAt,
        },
      });
      res.json(wallet);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/wallets/:id", async (req, res) => {
    try {
      await db.delete(transactions).where(eq(transactions.walletId, req.params.id));
      await db.delete(wallets).where(eq(wallets.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/transactions", async (_req, res) => {
    try {
      const result = await db.select().from(transactions);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const txn = req.body;
      await db.insert(transactions).values(txn).onConflictDoUpdate({
        target: transactions.id,
        set: {
          type: txn.type,
          amount: txn.amount,
          category: txn.category,
          description: txn.description,
          date: txn.date,
          createdAt: txn.createdAt,
          walletId: txn.walletId,
        },
      });
      res.json(txn);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      await db.delete(transactions).where(eq(transactions.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
