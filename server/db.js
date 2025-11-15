// server/db.js - Minimal PostgreSQL wrapper for session management
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pool;

/**
 * Initialize PostgreSQL connection pool
 * Uses DATABASE_URL environment variable
 */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

/**
 * Run migrations from scripts/migrate.sql
 * TODO: In production, use a proper migration tool like node-pg-migrate
 */
export async function initMigrations() {
  const pool = getPool();
  const migrationPath = join(__dirname, '..', 'scripts', 'migrate.sql');
  const sql = readFileSync(migrationPath, 'utf8');
  
  try {
    await pool.query(sql);
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Create a new session record
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Request payload (brief, page_type, etc.)
 * @returns {Promise<object>} Created session record
 */
export async function createSession(sessionId, payload) {
  const pool = getPool();
  const query = `
    INSERT INTO sessions (session_id, status, payload)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const result = await pool.query(query, [sessionId, 'pending', JSON.stringify(payload)]);
  return result.rows[0];
}

/**
 * Get session by session_id
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Session record or null if not found
 */
export async function getSession(sessionId) {
  const pool = getPool();
  const query = 'SELECT * FROM sessions WHERE session_id = $1';
  const result = await pool.query(query, [sessionId]);
  return result.rows[0] || null;
}

/**
 * Update session status and optionally result/error
 * @param {string} sessionId - Session identifier
 * @param {string} status - New status (pending, processing, completed, failed)
 * @param {object} updates - Additional fields to update (result, error)
 * @returns {Promise<object>} Updated session record
 */
export async function updateSession(sessionId, status, updates = {}) {
  const pool = getPool();
  const setClauses = ['status = $2'];
  const values = [sessionId, status];
  let paramIndex = 3;

  if (updates.result !== undefined) {
    setClauses.push(`result = $${paramIndex}`);
    values.push(JSON.stringify(updates.result));
    paramIndex++;
  }

  if (updates.error !== undefined) {
    setClauses.push(`error = $${paramIndex}`);
    values.push(updates.error);
    paramIndex++;
  }

  const query = `
    UPDATE sessions
    SET ${setClauses.join(', ')}
    WHERE session_id = $1
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Close database connection pool
 * Call this on graceful shutdown
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// CLI command for running migrations
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  if (command === 'migrate') {
    console.log('Running database migrations...');
    initMigrations()
      .then(() => {
        console.log('Migrations complete');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
      });
  } else {
    console.log('Usage: node server/db.js migrate');
    process.exit(1);
  }
}
