// server/db.js - PostgreSQL database wrapper for session management
// Uses node-postgres (pg) for database operations
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;

/**
 * Initialize database connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      console.warn('DATABASE_URL not set - database operations will fail');
      // Return a mock pool that throws on usage
      return null;
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
      // TODO: Add connection pool size configuration
      // TODO: Add connection timeout configuration
    });
  }
  return pool;
}

/**
 * Run database migrations from scripts/migrate.sql
 * Call this on server startup (optional)
 */
export async function initMigrations() {
  const p = getPool();
  if (!p) {
    console.warn('Skipping migrations - DATABASE_URL not configured');
    return;
  }

  try {
    const migrationPath = path.join(__dirname, '../scripts/migrate.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    await p.query(sql);
    console.log('Database migrations executed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    // TODO: Implement proper migration versioning
    // TODO: Add rollback support
  }
}

/**
 * Create a new session record
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Initial payload (brief, options, etc.)
 * @returns {Promise<object>} Created session record
 */
export async function createSession(sessionId, payload = {}) {
  const p = getPool();
  if (!p) throw new Error('Database not configured');

  const result = await p.query(
    'INSERT INTO sessions (session_id, status, payload, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
    [sessionId, 'pending', JSON.stringify(payload)]
  );
  return result.rows[0];
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Session record or null if not found
 */
export async function getSession(sessionId) {
  const p = getPool();
  if (!p) throw new Error('Database not configured');

  const result = await p.query(
    'SELECT * FROM sessions WHERE session_id = $1',
    [sessionId]
  );
  return result.rows[0] || null;
}

/**
 * Update session status and data
 * @param {string} sessionId - Session identifier
 * @param {object} updates - Fields to update (status, payload, artifact_url)
 * @returns {Promise<object>} Updated session record
 */
export async function updateSession(sessionId, updates = {}) {
  const p = getPool();
  if (!p) throw new Error('Database not configured');

  const { status, payload, artifact_url } = updates;
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(status);
  }
  if (payload !== undefined) {
    setClauses.push(`payload = $${paramIndex++}`);
    values.push(JSON.stringify(payload));
  }
  if (artifact_url !== undefined) {
    setClauses.push(`artifact_url = $${paramIndex++}`);
    values.push(artifact_url);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(sessionId);

  const result = await p.query(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE session_id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

/**
 * Close database pool (for graceful shutdown)
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// TODO: Add pagination support for session listing
// TODO: Add session cleanup for old/completed sessions
// TODO: Implement connection retry logic
// TODO: Add query performance monitoring
