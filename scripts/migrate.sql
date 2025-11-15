-- Migration script for Createlen sessions table
-- Run with: psql "$DATABASE_URL" -f scripts/migrate.sql

-- Create sessions table for tracking landing page generation jobs
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB,
  artifact_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- Add a comment to the table
COMMENT ON TABLE sessions IS 'Stores landing page generation session metadata';
COMMENT ON COLUMN sessions.session_id IS 'Unique identifier for the generation session';
COMMENT ON COLUMN sessions.status IS 'Job status: queued, processing, completed, failed';
COMMENT ON COLUMN sessions.payload IS 'Original request payload (brief, page_type, etc.)';
COMMENT ON COLUMN sessions.artifact_url IS 'S3 URL of the generated HTML landing page';

-- Optional: Add trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Display confirmation
DO $$
BEGIN
  RAISE NOTICE 'Sessions table created successfully!';
END $$;
