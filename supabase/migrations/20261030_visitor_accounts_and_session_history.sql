-- ==============================================================================
-- GANGANATHAN PORTFOLIO: VISITOR ACCOUNTS, PASSWORD RESETS, SESSION HISTORY & STORAGE
-- Migration Date: 2026-10-30
-- ==============================================================================

-- 1. STORAGE BUCKET FOR CHAT ATTACHMENTS
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 2. VISITOR ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.visitor_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_salt VARCHAR(64) NOT NULL,
    name VARCHAR(100) NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_accounts_email ON public.visitor_accounts(email);
CREATE INDEX IF NOT EXISTS idx_visitor_accounts_is_deleted ON public.visitor_accounts(is_deleted);

-- 3. VISITOR PASSWORD RESETS TABLE
CREATE TABLE IF NOT EXISTS public.visitor_password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.visitor_accounts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_hash ON public.visitor_password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON public.visitor_password_resets(email);

-- 4. DURABLE AUTH SESSION HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.auth_session_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(64) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('admin', 'visitor')),
    account_id VARCHAR(255) NOT NULL,
    conversation_id UUID NULL REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
    login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_at TIMESTAMPTZ NULL,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'logged_out', 'expired', 'superseded')),
    invalidation_reason VARCHAR(100) NULL,
    device_type VARCHAR(50) NULL,
    browser VARCHAR(50) NULL,
    browser_version VARCHAR(50) NULL,
    browser_engine VARCHAR(50) NULL,
    os VARCHAR(50) NULL,
    os_version VARCHAR(50) NULL,
    ip_address VARCHAR(45) NULL,
    country VARCHAR(100) NULL,
    region VARCHAR(100) NULL,
    city VARCHAR(100) NULL,
    metadata JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_session_history_account ON public.auth_session_history(account_type, account_id);
CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON public.auth_session_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_status ON public.auth_session_history(status);
CREATE INDEX IF NOT EXISTS idx_session_history_login ON public.auth_session_history(login_at DESC);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.visitor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_session_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on visitor_accounts" ON public.visitor_accounts;
CREATE POLICY "Service role full access on visitor_accounts"
    ON public.visitor_accounts FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on visitor_password_resets" ON public.visitor_password_resets;
CREATE POLICY "Service role full access on visitor_password_resets"
    ON public.visitor_password_resets FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on auth_session_history" ON public.auth_session_history;
CREATE POLICY "Service role full access on auth_session_history"
    ON public.auth_session_history FOR ALL
    USING (auth.role() = 'service_role');

