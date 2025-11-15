// server/db.js — PostgreSQL client for sessions management
// TODO: Add connection pooling configuration
// TODO: Add retry logic for transient failures
// TODO: Add database connection health checks

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL not set. Database operations will fail.');
}

// Create connection pool
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL && DATABASE_URL.includes('postgres://') && !DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

/**
 * Create a new session record
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Request payload
 * @returns {Promise<object>} Created session record
 */
export async function createSession(sessionId, payload) {
  const query = `
    INSERT INTO sessions (session_id, status, payload)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const result = await pool.query(query, [sessionId, 'queued', JSON.stringify(payload)]);
  return result.rows[0];
}

/**
 * Update session status and optionally set artifact URL
 * @param {string} sessionId - Session identifier
 * @param {string} status - New status (processing, completed, failed)
 * @param {string} artifactUrl - Optional S3 URL for generated artifact
 * @returns {Promise<object>} Updated session record
 */
export async function updateSession(sessionId, status, artifactUrl = null) {
  const query = `
    UPDATE sessions
    SET status = $1, artifact_url = $2, updated_at = NOW()
    WHERE session_id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [status, artifactUrl, sessionId]);
  return result.rows[0];
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Session record or null
 */
export async function getSession(sessionId) {
  const query = 'SELECT * FROM sessions WHERE session_id = $1';
  const result = await pool.query(query, [sessionId]);
  return result.rows[0] || null;
}

/**
 * Check database health
 * @returns {Promise<boolean>} True if database is healthy
 */
export async function checkHealth() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Database health check failed:', err);
    return false;
  }
}
