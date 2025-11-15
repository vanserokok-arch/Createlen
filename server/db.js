// server/db.js - Minimal PostgreSQL client wrapper using node-postgres
// Provides connection pooling and basic query methods for session management

import pg from 'pg';
const { Pool } = pg;

// Initialize connection pool
let pool = null;

/**
 * Initialize database connection pool
 * Uses DATABASE_URL environment variable for connection string
 */
export function initDB() {
  if (pool) return pool;
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL not set. Database operations will fail.');
    return null;
  }

  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  console.log('Database pool initialized');
  return pool;
}

/**
 * Get database pool instance
 * @returns {Pool} PostgreSQL connection pool
 */
export function getPool() {
  if (!pool) {
    return initDB();
  }
  return pool;
}

/**
 * Execute a query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params = []) {
  const client = getPool();
  if (!client) {
    throw new Error('Database not initialized');
  }
  
  const start = Date.now();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Create a new session
 * @param {string} sessionId - Unique session identifier
 * @param {string} brief - User brief
 * @param {string} pageType - Page type
 * @returns {Promise<Object>} Created session record
 */
export async function createSession(sessionId, brief, pageType = 'invest') {
  const text = `
    INSERT INTO sessions (session_id, status, brief, page_type)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const params = [sessionId, 'pending', brief, pageType];
  const result = await query(text, params);
  return result.rows[0];
}

/**
 * Get session by session_id
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object|null>} Session record or null
 */
export async function getSession(sessionId) {
  const text = 'SELECT * FROM sessions WHERE session_id = $1';
  const result = await query(text, [sessionId]);
  return result.rows[0] || null;
}

/**
 * Update session status
 * @param {string} sessionId - Session identifier
 * @param {string} status - New status (pending, processing, completed, failed)
 * @param {Object} updates - Additional fields to update
 * @returns {Promise<Object>} Updated session record
 */
export async function updateSession(sessionId, status, updates = {}) {
  const fields = ['status = $2'];
  const params = [sessionId, status];
  let paramIndex = 3;

  // Add optional fields
  if (updates.payload_json !== undefined) {
    fields.push(`payload_json = $${paramIndex}`);
    params.push(JSON.stringify(updates.payload_json));
    paramIndex++;
  }
  if (updates.s3_json_url !== undefined) {
    fields.push(`s3_json_url = $${paramIndex}`);
    params.push(updates.s3_json_url);
    paramIndex++;
  }
  if (updates.s3_html_url !== undefined) {
    fields.push(`s3_html_url = $${paramIndex}`);
    params.push(updates.s3_html_url);
    paramIndex++;
  }
  if (updates.error_message !== undefined) {
    fields.push(`error_message = $${paramIndex}`);
    params.push(updates.error_message);
    paramIndex++;
  }

  const text = `
    UPDATE sessions
    SET ${fields.join(', ')}
    WHERE session_id = $1
    RETURNING *
  `;
  
  const result = await query(text, params);
  return result.rows[0];
}

/**
 * List sessions with pagination
 * @param {number} limit - Maximum number of records
 * @param {number} offset - Offset for pagination
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} Array of session records
 */
export async function listSessions(limit = 50, offset = 0, status = null) {
  let text = 'SELECT * FROM sessions';
  const params = [];
  
  if (status) {
    text += ' WHERE status = $1';
    params.push(status);
    text += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);
  } else {
    text += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    params.push(limit, offset);
  }
  
  const result = await query(text, params);
  return result.rows;
}

/**
 * Close database pool
 */
export async function closeDB() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}

// TODO: Add more session management methods as needed:
// - deleteSession(sessionId)
// - getSessionStats()
// - cleanupOldSessions(days)
