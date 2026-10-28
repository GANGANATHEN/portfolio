-- ==============================================================================
-- GANGANATHAN PORTFOLIO: LIVE VISITOR CHAT SYSTEM SCHEMA
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    visitor_name VARCHAR(100) DEFAULT 'Visitor',
    visitor_email VARCHAR(255) NULL,
    email_notifications_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_owner_count INTEGER DEFAULT 0,
    unread_visitor_count INTEGER DEFAULT 0,
    last_owner_notification_at TIMESTAMPTZ NULL,
    last_visitor_notification_at TIMESTAMPTZ NULL
);

-- Indexes for lightning fast session resolution and inbox queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_hash ON public.chat_conversations(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_msg ON public.chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_unread ON public.chat_conversations(unread_owner_count);

-- 2. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('visitor', 'owner')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ NULL
);

-- Index for conversation message stream
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON public.chat_messages(conversation_id, created_at ASC);

-- 3. NOTIFICATION LOGS TABLE (For throttling and durable delivery tracking)
CREATE TABLE IF NOT EXISTS public.chat_notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('owner', 'visitor')),
    recipient_email VARCHAR(255) NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'throttled')),
    message_preview VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_chat_notification_logs_conv ON public.chat_notification_logs(conversation_id, sent_at DESC);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notification_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full permissions for server-side route handlers
CREATE POLICY "Service role full access on chat_conversations"
    ON public.chat_conversations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on chat_messages"
    ON public.chat_messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on chat_notification_logs"
    ON public.chat_notification_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow public anon client read/write strictly through the secure server route handlers
-- (Direct database exposure to anonymous client is locked down)
CREATE POLICY "Deny direct public table access"
    ON public.chat_conversations
    FOR ALL
    TO anon
    USING (false);

-- 5. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_conversation ON public.chat_conversations;
CREATE TRIGGER trigger_update_chat_conversation
    BEFORE UPDATE ON public.chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_timestamp();

