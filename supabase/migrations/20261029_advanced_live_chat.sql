-- ==============================================================================
-- GANGANATHAN PORTFOLIO: ADVANCED LIVE CHAT SYSTEM MIGRATION (2026-10-29)
-- Message operations (edit, delete, reactions, replies) & private attachments
-- ==============================================================================

-- 1. EXTEND CHAT MESSAGES
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

-- 2. EXTEND CHAT CONVERSATIONS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'is_archived') THEN
        ALTER TABLE public.chat_conversations ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_conversations' AND column_name = 'is_deleted') THEN
        ALTER TABLE public.chat_conversations ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- 3. CREATE ATTACHMENTS TABLE
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

-- 4. ROW LEVEL SECURITY (RLS) FOR ATTACHMENTS
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on chat_attachments"
    ON public.chat_attachments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Deny direct public table access attachments"
    ON public.chat_attachments
    FOR ALL
    TO anon
    USING (false);

