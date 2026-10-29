-- ==============================================================================
-- GANGANATHAN PORTFOLIO: COMPLETE PRODUCTION LIVE CHAT SCHEMA (IDEMPOTENT)
-- Run this migration in your Supabase SQL Editor: https://supabase.com/dashboard/project/wyqbluxtwpyuzqspdrfd/sql
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    visitor_name VARCHAR(100) DEFAULT 'Visitor',
    visitor_email VARCHAR(255) NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_notifications_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_owner_count INTEGER DEFAULT 0,
    unread_visitor_count INTEGER DEFAULT 0,
    last_owner_notification_at TIMESTAMPTZ NULL,
    last_visitor_notification_at TIMESTAMPTZ NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_at TIMESTAMPTZ NULL
);

-- Ensure all columns exist if table was partially created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'email_verified') THEN
        ALTER TABLE public.chat_conversations ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'is_archived') THEN
        ALTER TABLE public.chat_conversations ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'is_deleted') THEN
        ALTER TABLE public.chat_conversations ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'is_pinned') THEN
        ALTER TABLE public.chat_conversations ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'pinned_at') THEN
        ALTER TABLE public.chat_conversations ADD COLUMN pinned_at TIMESTAMPTZ NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_hash ON public.chat_conversations(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_msg ON public.chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_unread ON public.chat_conversations(unread_owner_count);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_pinned ON public.chat_conversations(is_pinned, last_message_at DESC);

-- 2. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('visitor', 'owner')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ NULL,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    edited_at TIMESTAMPTZ NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_message_id VARCHAR(100) NULL
);

-- Ensure all columns exist if table was partially created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_edited') THEN
        ALTER TABLE public.chat_messages ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'edited_at') THEN
        ALTER TABLE public.chat_messages ADD COLUMN edited_at TIMESTAMPTZ NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_deleted') THEN
        ALTER TABLE public.chat_messages ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.chat_messages ADD COLUMN deleted_at TIMESTAMPTZ NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'reply_to_id') THEN
        ALTER TABLE public.chat_messages ADD COLUMN reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'reactions') THEN
        ALTER TABLE public.chat_messages ADD COLUMN reactions JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'client_message_id') THEN
        ALTER TABLE public.chat_messages ADD COLUMN client_message_id VARCHAR(100) NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON public.chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON public.chat_messages(reply_to_id);

-- 3. ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS public.chat_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_conv ON public.chat_attachments(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_msg ON public.chat_attachments(message_id);

-- 4. NOTIFICATION LOGS TABLE (Cooldown and throttling tracking)
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

-- 5. EMAIL OTP VERIFICATION TABLE
CREATE TABLE IF NOT EXISTS public.chat_email_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_email_otps_lookup ON public.chat_email_otps(conversation_id, email, expires_at DESC);

-- 6. ROW LEVEL SECURITY (RLS) & PRIVILEGED SERVICE ROLE ACCESS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_email_otps ENABLE ROW LEVEL SECURITY;

-- Drop previous policies safely before recreating to avoid duplicate name conflicts
DROP POLICY IF EXISTS "Service role full access on chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Service role full access on chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Service role full access on chat_attachments" ON public.chat_attachments;
DROP POLICY IF EXISTS "Service role full access on chat_notification_logs" ON public.chat_notification_logs;
DROP POLICY IF EXISTS "Service role full access on chat_email_otps" ON public.chat_email_otps;

CREATE POLICY "Service role full access on chat_conversations" ON public.chat_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on chat_messages" ON public.chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on chat_attachments" ON public.chat_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on chat_notification_logs" ON public.chat_notification_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on chat_email_otps" ON public.chat_email_otps FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Explicitly deny anon direct client access so private conversation data can only be queried through authorized server routes
DROP POLICY IF EXISTS "Deny direct anon access on chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Deny direct anon access on chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Deny direct anon access on chat_attachments" ON public.chat_attachments;
DROP POLICY IF EXISTS "Deny direct anon access on chat_notification_logs" ON public.chat_notification_logs;
DROP POLICY IF EXISTS "Deny direct anon access on chat_email_otps" ON public.chat_email_otps;

CREATE POLICY "Deny direct anon access on chat_conversations" ON public.chat_conversations FOR ALL TO anon USING (false);
CREATE POLICY "Deny direct anon access on chat_messages" ON public.chat_messages FOR ALL TO anon USING (false);
CREATE POLICY "Deny direct anon access on chat_attachments" ON public.chat_attachments FOR ALL TO anon USING (false);
CREATE POLICY "Deny direct anon access on chat_notification_logs" ON public.chat_notification_logs FOR ALL TO anon USING (false);
CREATE POLICY "Deny direct anon access on chat_email_otps" ON public.chat_email_otps FOR ALL TO anon USING (false);

