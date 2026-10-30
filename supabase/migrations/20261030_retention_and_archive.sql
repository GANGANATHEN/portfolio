-- ==============================================================================
-- GANGANATHAN PORTFOLIO: 24-HOUR RETENTION & PERMANENT ARCHIVE SCHEMA (IDEMPOTENT)
-- Run this migration in your Supabase SQL Editor: https://supabase.com/dashboard/project/wyqbluxtwpyuzqspdrfd/sql
-- ==============================================================================

-- 1. Create Archive Batches Audit Table (Stores only non-content audit metadata)
CREATE TABLE IF NOT EXISTS public.chat_archive_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    message_ids JSONB NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'pdf_generated', 'email_submitted', 'delivered', 'deleted', 'failed')),
    pdf_storage_path TEXT NULL,
    email_message_id VARCHAR(100) NULL,
    delivery_confirmed_at TIMESTAMPTZ NULL,
    deleted_at TIMESTAMPTZ NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_chat_archive_batches_conv ON public.chat_archive_batches(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_archive_batches_status ON public.chat_archive_batches(status);
CREATE INDEX IF NOT EXISTS idx_chat_archive_batches_email_msg ON public.chat_archive_batches(email_message_id);

-- Ensure message read_at index exists for fast 24-hour retention queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_read_at ON public.chat_messages(read_at) WHERE read_at IS NOT NULL;

-- 2. Row Level Security Policies
ALTER TABLE public.chat_archive_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on chat_archive_batches" ON public.chat_archive_batches;
CREATE POLICY "Service role full access on chat_archive_batches" ON public.chat_archive_batches FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Deny direct anon access on chat_archive_batches" ON public.chat_archive_batches;
CREATE POLICY "Deny direct anon access on chat_archive_batches" ON public.chat_archive_batches FOR ALL TO anon USING (false);

