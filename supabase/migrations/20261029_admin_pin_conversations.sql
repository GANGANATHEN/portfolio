-- ==============================================================================
-- MIGRATION: ADD PIN CONVERSATIONS SUPPORT FOR ADMIN INBOX
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_conversations' AND column_name = 'is_pinned'
    ) THEN
        ALTER TABLE public.chat_conversations ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_conversations' AND column_name = 'pinned_at'
    ) THEN
        ALTER TABLE public.chat_conversations ADD COLUMN pinned_at TIMESTAMPTZ NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_pinned 
ON public.chat_conversations(is_pinned, last_message_at DESC);

