-- ==============================================================================
-- GANGANATHAN PORTFOLIO: VISITOR MESSAGE DELETION & VISITOR METADATA (2026-10-30)
-- 1. Adds deleted_by to chat_messages to preserve admin visibility of deleted messages
-- 2. Adds metadata JSONB to chat_conversations for non-invasive admin telemetry
-- ==============================================================================

DO $$
BEGIN
    -- 1. chat_messages: deleted_by column ('visitor' | 'owner')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE public.chat_messages ADD COLUMN deleted_by VARCHAR(20) NULL;
    END IF;

    -- 2. chat_conversations: metadata JSONB column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_conversations' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.chat_conversations ADD COLUMN metadata JSONB NULL;
    END IF;
END $$;
