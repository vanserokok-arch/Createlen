-- Migration: Create sessions table for autonomous landing page generation
-- This table stores session information, status, and generated content

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    brief TEXT,
    page_type VARCHAR(100),
    payload_json JSONB,
    s3_json_url TEXT,
    s3_html_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on row update
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE sessions IS 'Stores landing page generation sessions with status tracking';

-- Add comments to columns
COMMENT ON COLUMN sessions.session_id IS 'Unique identifier for the session (user-provided or auto-generated)';
COMMENT ON COLUMN sessions.status IS 'Current status: pending, processing, completed, failed';
COMMENT ON COLUMN sessions.brief IS 'User-provided brief for landing page generation';
COMMENT ON COLUMN sessions.page_type IS 'Type of landing page (e.g., invest, service, product)';
COMMENT ON COLUMN sessions.payload_json IS 'Generated JSON structure from OpenAI';
COMMENT ON COLUMN sessions.s3_json_url IS 'S3 URL for the generated JSON file';
COMMENT ON COLUMN sessions.s3_html_url IS 'S3 URL for the generated HTML file';
COMMENT ON COLUMN sessions.error_message IS 'Error message if generation failed';
