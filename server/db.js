// server/db.js — Postgres wrapper for session management
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL not configured');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

/**
 * Initialize database migrations
 * Executes scripts/migrate.sql if it exists
 * TODO: Use proper migration tool (e.g., node-pg-migrate) for production
 */
export async function initMigrations() {
  const migrationPath = path.join(__dirname, '..', 'scripts', 'migrate.sql');
  try {
    const sql = readFileSync(migrationPath, 'utf-8');
    const client = await getPool().connect();
    try {
      await client.query(sql);
      console.log('Database migrations applied successfully');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('Migration warning (may already be applied):', err.message);
    // Don't throw - migrations might already be applied
  }
}

/**
 * Create a new session record
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Initial payload data
 * @returns {Promise<object>} - Created session record
 */
export async function createSession(sessionId, payload = {}) {
  const sql = `
    INSERT INTO sessions (session_id, status, payload, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *
  `;
  const result = await getPool().query(sql, [sessionId, 'pending', JSON.stringify(payload)]);
  return result.rows[0];
}

/**
 * Update an existing session record
 * @param {string} sessionId - Session identifier
 * @param {object} updates - Fields to update (status, payload, artifact_url)
 * @returns {Promise<object>} - Updated session record
 */
export async function updateSession(sessionId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.payload !== undefined) {
    fields.push(`payload = $${paramIndex++}`);
    values.push(JSON.stringify(updates.payload));
  }
  if (updates.artifact_url !== undefined) {
    fields.push(`artifact_url = $${paramIndex++}`);
    values.push(updates.artifact_url);
  }

  fields.push(`updated_at = NOW()`);
  values.push(sessionId);

  const sql = `
    UPDATE sessions
    SET ${fields.join(', ')}
    WHERE session_id = $${paramIndex}
    RETURNING *
  `;

  const result = await getPool().query(sql, values);
  return result.rows[0];
}

/**
 * Get session by sessionId
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} - Session record or null
 */
export async function getSession(sessionId) {
  const sql = 'SELECT * FROM sessions WHERE session_id = $1';
  const result = await getPool().query(sql, [sessionId]);
  return result.rows[0] || null;
}

/**
 * Close database connection pool
 * Call this on shutdown
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
