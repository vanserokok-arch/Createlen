// server/db.js — PostgreSQL database connection and queries
import pg from 'pg';
const { Pool } = pg;

// TODO: Add connection pooling configuration options
// TODO: Add retry logic for transient database errors
// TODO: Add query logging for debugging
// TODO: Add prepared statements for better performance

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Create a new session in the database
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Request payload (brief, page_type, etc.)
 * @returns {Promise<object>} Created session record
 */
export async function createSession(sessionId, payload) {
  const query = `
    INSERT INTO sessions (session_id, status, payload)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const values = [sessionId, 'queued', JSON.stringify(payload)];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Update session status and optionally set artifact URL
 * @param {string} sessionId - Session identifier
 * @param {string} status - New status (processing, completed, failed)
 * @param {string} [artifactUrl] - Optional S3 URL of generated artifact
 * @returns {Promise<object>} Updated session record
 */
export async function updateSession(sessionId, status, artifactUrl = null) {
  const query = artifactUrl
    ? `UPDATE sessions SET status = $1, artifact_url = $2 WHERE session_id = $3 RETURNING *`
    : `UPDATE sessions SET status = $1 WHERE session_id = $2 RETURNING *`;
  
  const values = artifactUrl 
    ? [status, artifactUrl, sessionId]
    : [status, sessionId];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Session record or null
 */
export async function getSession(sessionId) {
  const query = `SELECT * FROM sessions WHERE session_id = $1`;
  const result = await pool.query(query, [sessionId]);
  return result.rows[0] || null;
}

/**
 * Health check for database connection
 * @returns {Promise<boolean>} True if database is reachable
 */
export async function checkDbHealth() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Export pool for advanced usage
export { pool };
