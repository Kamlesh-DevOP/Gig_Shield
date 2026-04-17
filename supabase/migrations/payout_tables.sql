-- ============================================================================
-- GIC Razorpay Payout Integration — Supabase Migration
-- Run this SQL in your Supabase SQL Editor.
-- ============================================================================

-- 1. Create the payout_transactions table to log all payouts
CREATE TABLE IF NOT EXISTS payout_transactions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id       INTEGER NOT NULL,
    claim_trace_id  TEXT NOT NULL,
    razorpay_payout_id       TEXT,
    razorpay_contact_id      TEXT,
    razorpay_fund_account_id TEXT,
    amount          NUMERIC(12, 2) NOT NULL,
    mode            TEXT DEFAULT 'UPI',           -- UPI / IMPS / NEFT
    status          TEXT DEFAULT 'processing',    -- processing / processed / failed / demo_success
    utr             TEXT,                         -- Bank UTR reference number
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by worker and claim
CREATE INDEX IF NOT EXISTS idx_payout_worker   ON payout_transactions (worker_id);
CREATE INDEX IF NOT EXISTS idx_payout_trace    ON payout_transactions (claim_trace_id);
CREATE INDEX IF NOT EXISTS idx_payout_rzp_id   ON payout_transactions (razorpay_payout_id);


-- 2. Add Razorpay IDs to gic_workers for caching
--    These prevent re-creating contacts/fund accounts on every payout.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gic_workers' AND column_name = 'razorpay_contact_id'
    ) THEN
        ALTER TABLE gic_workers ADD COLUMN razorpay_contact_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gic_workers' AND column_name = 'razorpay_fund_account_id'
    ) THEN
        ALTER TABLE gic_workers ADD COLUMN razorpay_fund_account_id TEXT;
    END IF;
END $$;


-- 3. Enable Row Level Security (optional but recommended)
ALTER TABLE payout_transactions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on payout_transactions"
    ON payout_transactions
    FOR ALL
    USING (true)
    WITH CHECK (true);
