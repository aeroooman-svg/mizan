import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { wallets, transactions } from "@shared/schema";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Auth: Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });

      res.json({ id: user.id, username: user.username });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== hashPassword(password)) {
        return res.status(400).json({ error: "Invalid username or password" });
      }

      res.json({ id: user.id, username: user.username });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Consolidated Cloud Sync Endpoint
  app.post("/api/sync", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userId = authHeader.split(" ")[1];
      
      const { wallets: clientWallets, transactions: clientTransactions } = req.body;

      // 1. Save all incoming wallets for this user
      if (Array.isArray(clientWallets)) {
        for (const w of clientWallets) {
          await storage.saveWallet({ ...w, userId });
        }
      }

      // 2. Save all incoming transactions for this user
      if (Array.isArray(clientTransactions)) {
        for (const t of clientTransactions) {
          await storage.saveTransaction({ ...t, userId });
        }
      }

      // 3. Retrieve all wallets and transactions for this user from DB (if DB exists)
      let allWallets = [];
      let allTransactions = [];

      if (db) {
        allWallets = await db.select().from(wallets).where(eq(wallets.userId, userId));
        allTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));
      } else {
        // Fallback for MemStorage
        const totalWallets = await storage.getWallets();
        const totalTxns = await storage.getTransactions();
        allWallets = totalWallets.filter(w => w.userId === userId);
        allTransactions = totalTxns.filter(t => t.userId === userId);
      }

      res.json({
        wallets: allWallets,
        transactions: allTransactions,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/wallets", async (_req, res) => {
    try {
      const result = await storage.getWallets();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/wallets", async (req, res) => {
    try {
      const wallet = req.body;
      const result = await storage.saveWallet(wallet);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/wallets/:id", async (req, res) => {
    try {
      await storage.deleteWallet(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/transactions", async (_req, res) => {
    try {
      const result = await storage.getTransactions();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const txn = req.body;
      const result = await storage.saveTransaction(txn);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      await storage.deleteTransaction(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Wallet Sharing Endpoints ────────────────────────

  // Share a wallet: generate code
  app.post("/api/wallets/:id/share", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userId = authHeader.split(" ")[1];
      const walletId = req.params.id;

      // Find all wallets and check owner
      const allWallets = await storage.getWallets();
      const wallet = allWallets.find(w => w.id === walletId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      // Check if user is owner
      if (wallet.userId !== userId) {
        return res.status(403).json({ error: "Only the owner can share this wallet" });
      }

      // Generate code if none exists
      let code = wallet.shareCode;
      if (!code) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        code = "";
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(crypto.randomInt(0, chars.length));
        }
        await storage.saveWallet({
          ...wallet,
          shareCode: code,
        });
      }

      // Ensure owner is added to wallet shares
      const shares = await storage.getWalletShares(walletId);
      const ownerShare = shares.find(s => s.userId === userId);
      if (!ownerShare) {
        const user = await storage.getUser(userId);
        if (user) {
          const newShare = await storage.saveWalletShare({
            walletId,
            userId,
            username: user.username,
            role: "owner",
            joinedAt: new Date().toISOString(),
          });
          shares.push(newShare);
        }
      }

      // Update sharedWith string JSON
      const members = shares.map(s => ({ userId: s.userId, username: s.username, role: s.role }));
      await storage.saveWallet({
        ...wallet,
        shareCode: code,
        sharedWith: JSON.stringify(members),
      });

      res.json({ shareCode: code });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Join a wallet by code
  app.post("/api/wallets/join", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userId = authHeader.split(" ")[1];
      const { shareCode } = req.body;

      if (!shareCode) {
        return res.status(400).json({ error: "Share code required" });
      }

      const wallet = await storage.getWalletByShareCode(shareCode);
      if (!wallet) {
        return res.status(404).json({ error: "Invalid share code" });
      }

      // Add user to wallet shares
      const shares = await storage.getWalletShares(wallet.id);
      const existing = shares.find(s => s.userId === userId);
      if (existing) {
        return res.status(400).json({ error: "You are already a member of this wallet" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const newShare = await storage.saveWalletShare({
        walletId: wallet.id,
        userId,
        username: user.username,
        role: "member",
        joinedAt: new Date().toISOString(),
      });

      shares.push(newShare);

      // Update sharedWith serialized JSON
      const members = shares.map(s => ({ userId: s.userId, username: s.username, role: s.role }));
      await storage.saveWallet({
        ...wallet,
        sharedWith: JSON.stringify(members),
      });

      res.json({ walletName: wallet.name });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get members
  app.get("/api/wallets/:id/members", async (req, res) => {
    try {
      const shares = await storage.getWalletShares(req.params.id);
      res.json(shares);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove a member
  app.delete("/api/wallets/:id/members/:userId", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const callerId = authHeader.split(" ")[1];
      const walletId = req.params.id;
      const targetUserId = req.params.userId;

      // Verify caller is owner of the wallet
      const shares = await storage.getWalletShares(walletId);
      const callerShare = shares.find(s => s.userId === callerId);
      if (!callerShare || callerShare.role !== "owner") {
        return res.status(403).json({ error: "Only the owner can remove members" });
      }

      await storage.deleteWalletShare(walletId, targetUserId);

      // Update sharedWith JSON
      const updatedShares = shares.filter(s => s.userId !== targetUserId);
      const allWallets = await storage.getWallets();
      const wallet = allWallets.find(w => w.id === walletId);
      if (wallet) {
        const members = updatedShares.map(s => ({ userId: s.userId, username: s.username, role: s.role }));
        await storage.saveWallet({
          ...wallet,
          sharedWith: JSON.stringify(members),
        });
      }

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Leave a shared wallet
  app.post("/api/wallets/:id/leave", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userId = authHeader.split(" ")[1];
      const walletId = req.params.id;

      const shares = await storage.getWalletShares(walletId);
      const userShare = shares.find(s => s.userId === userId);
      if (!userShare) {
        return res.status(400).json({ error: "You are not a member of this wallet" });
      }

      if (userShare.role === "owner") {
        return res.status(400).json({ error: "The owner cannot leave. Delete the wallet instead" });
      }

      await storage.deleteWalletShare(walletId, userId);

      // Update sharedWith JSON
      const updatedShares = shares.filter(s => s.userId !== userId);
      const allWallets = await storage.getWallets();
      const wallet = allWallets.find(w => w.id === walletId);
      if (wallet) {
        const members = updatedShares.map(s => ({ userId: s.userId, username: s.username, role: s.role }));
        await storage.saveWallet({
          ...wallet,
          sharedWith: JSON.stringify(members),
        });
      }

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
