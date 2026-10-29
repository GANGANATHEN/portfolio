-- ==============================================================================
-- GANGANATHAN PORTFOLIO: COMMANDS SYSTEM SCHEMA & MIGRATION (2026-10-29)
-- Stores community terminal commands, scripts, metadata, and admin moderation state
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMMANDS TABLE
CREATE TABLE IF NOT EXISTS public.commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NULL,
    command TEXT NOT NULL,
    description TEXT NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'General',
    author_name VARCHAR(100) NOT NULL DEFAULT 'Developer',
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NULL
);

-- Ensure all columns exist if table was partially created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'title') THEN
        ALTER TABLE public.commands ADD COLUMN title VARCHAR(200) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'category') THEN
        ALTER TABLE public.commands ADD COLUMN category VARCHAR(80) NOT NULL DEFAULT 'General';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'is_hidden') THEN
        ALTER TABLE public.commands ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'is_deleted') THEN
        ALTER TABLE public.commands ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'metadata') THEN
        ALTER TABLE public.commands ADD COLUMN metadata JSONB NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'updated_at') THEN
        ALTER TABLE public.commands ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_commands_visible ON public.commands(created_at DESC) WHERE is_hidden = FALSE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_commands_category ON public.commands(category);
CREATE INDEX IF NOT EXISTS idx_commands_author ON public.commands(author_name);

-- 2. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

-- Public can read visible non-deleted commands
CREATE POLICY "Public users can view visible commands"
ON public.commands FOR SELECT
USING (is_hidden = FALSE AND is_deleted = FALSE);

-- Public can insert new commands (moderation metadata captured server-side)
CREATE POLICY "Public users can submit commands"
ON public.commands FOR INSERT
WITH CHECK (TRUE);

-- Service role has full access
CREATE POLICY "Service role full access to commands"
ON public.commands FOR ALL
USING (auth.role() = 'service_role');

