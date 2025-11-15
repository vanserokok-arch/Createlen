-- scripts/migrate.sql — Database migration for sessions table
-- This script creates the sessions table for tracking landing generation tasks

-- Create sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- TODO: Implement proper migration tracking system
-- Current approach uses "CREATE TABLE IF NOT EXISTS" which is safe for idempotent
-- migrations but doesn't track which migrations have been executed.
-- For production, consider implementing a migrations table with versioning:
--   CREATE TABLE IF NOT EXISTS migrations (
--     id SERIAL PRIMARY KEY,
--     version TEXT UNIQUE NOT NULL,
--     executed_at TIMESTAMPTZ DEFAULT NOW()
--   );
-- Or use a migration library like knex, typeorm, or db-migrate.
