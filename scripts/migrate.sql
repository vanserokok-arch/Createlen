-- Database migration for Createlen autonomous landing generator
-- Creates sessions table for tracking generation requests and results

-- Sessions table: stores generation requests and their status
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  result_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by session_id
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Index for sorting by created_at
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row update
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- TODO: Add indexes for specific query patterns as needed
-- TODO: Consider partitioning by created_at for large datasets
-- TODO: Add foreign key constraints if adding users table
