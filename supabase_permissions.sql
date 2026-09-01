-- ============================================================
-- MIZAN: Enable Row Level Security (RLS) & Security Policies
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- 1. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Allow all operations on wallets" ON public.wallets;
DROP POLICY IF EXISTS "Allow all operations on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all operations on wallet_shares" ON public.wallet_shares;
DROP POLICY IF EXISTS "Allow all operations on users" ON public.users;

-- 3. Create RLS Policies allowing application access (anon + authenticated)
CREATE POLICY "Allow all operations on wallets"
  ON public.wallets
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on transactions"
  ON public.transactions
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on wallet_shares"
  ON public.wallet_shares
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on users"
  ON public.users
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Grant CRUD permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.wallets TO anon, authenticated;
GRANT ALL ON TABLE public.transactions TO anon, authenticated;
GRANT ALL ON TABLE public.wallet_shares TO anon, authenticated;
GRANT ALL ON TABLE public.users TO anon, authenticated;
