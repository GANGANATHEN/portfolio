-- ==============================================================================
-- GANGANATHAN PORTFOLIO: SINGLE ACTIVE SESSION SECURITY REGISTRY SCHEMA
-- Enforces strict one active session per account for both Admin and Visitors.
-- ==============================================================================

-- 1. ACTIVE SESSIONS TABLE (Primary key guarantees strictly 1 active session per account)
CREATE TABLE IF NOT EXISTS public.auth_active_sessions (
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('admin', 'visitor')),
    account_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    session_token_hash VARCHAR(64) NOT NULL,
    conversation_id UUID NULL REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NULL,
    PRIMARY KEY (account_type, account_id)
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_token_hash ON public.auth_active_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_active_sessions_is_active ON public.auth_active_sessions(is_active);

-- 2. SUPERSEDED / REVOKED SESSIONS AUDIT TABLE (Immediate constant-time detection of superseded devices)
CREATE TABLE IF NOT EXISTS public.auth_superseded_sessions (
    session_token_hash VARCHAR(64) PRIMARY KEY,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('admin', 'visitor')),
    account_id VARCHAR(255) NOT NULL,
    superseded_at TIMESTAMPTZ DEFAULT NOW(),
    reason VARCHAR(50) NOT NULL DEFAULT 'superseded_by_new_login'
);

CREATE INDEX IF NOT EXISTS idx_superseded_sessions_account ON public.auth_superseded_sessions(account_type, account_id);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.auth_active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_superseded_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role has full access to auth_active_sessions" ON public.auth_active_sessions;
CREATE POLICY "Service role has full access to auth_active_sessions" 
    ON public.auth_active_sessions 
    FOR ALL 
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to auth_superseded_sessions" ON public.auth_superseded_sessions;
CREATE POLICY "Service role has full access to auth_superseded_sessions" 
    ON public.auth_superseded_sessions 
    FOR ALL 
    USING (auth.role() = 'service_role');

