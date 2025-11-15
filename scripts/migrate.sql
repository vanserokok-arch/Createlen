-- scripts/migrate.sql — Database migration script
-- Creates the sessions table for tracking landing generation requests
-- Run this with: psql "$DATABASE_URL" -f scripts/migrate.sql

-- Create sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    payload JSONB DEFAULT '{}'::jsonb, -- Stores request data and results
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Create index on created_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Add comment to table
COMMENT ON TABLE sessions IS 'Stores landing generation session data';
COMMENT ON COLUMN sessions.session_id IS 'Unique identifier for the generation session';
COMMENT ON COLUMN sessions.status IS 'Current status of the generation process';
COMMENT ON COLUMN sessions.payload IS 'JSON data including brief, results, and S3 URLs';
COMMENT ON COLUMN sessions.created_at IS 'Timestamp when session was created';
COMMENT ON COLUMN sessions.updated_at IS 'Timestamp when session was last updated';

-- TODO: Add trigger to automatically update updated_at timestamp
-- TODO: Add function to clean up old sessions (e.g., older than 30 days)
-- TODO: Add additional columns if needed (user_id, ip_address, etc.)
-- TODO: Add function to migrate existing in-memory sessions if needed
