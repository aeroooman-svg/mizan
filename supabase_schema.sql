-- MIZAN Database Schema for Supabase
-- Run this in Supabase SQL Editor to create all tables instantly

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
  icon TEXT NOT NULL DEFAULT 'account-balance-wallet',
  color TEXT NOT NULL DEFAULT '#0D7C66',
  created_at TEXT NOT NULL,
  user_id VARCHAR,
  shared_with TEXT,
  share_code VARCHAR(8)
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  wallet_id VARCHAR NOT NULL,
  to_wallet_id VARCHAR,
  tags TEXT,
  receipt_uri TEXT,
  user_id VARCHAR,
  added_by TEXT
);

CREATE TABLE IF NOT EXISTS wallet_shares (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  username TEXT NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL
);
