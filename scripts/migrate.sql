-- Migration: Create sessions table for autonomous landing generation
-- This table stores session data for async generation tasks

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  result JSONB,
  s3_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at on row update
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
