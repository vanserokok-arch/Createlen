-- Migration script for autonomous generation sessions
-- Run this manually or automatically via initMigrations() in server/db.js

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  artifact_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by session_id
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- TODO: Add updated_at trigger for automatic timestamp updates
-- TODO: Consider adding error_message column for failed generations
-- TODO: Add retry_count column for failure handling
