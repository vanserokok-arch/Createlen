// server/db.js - Minimal PostgreSQL wrapper using node-postgres
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;

/**
 * Get or create database pool
 * @returns {pg.Pool}
 */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL not configured');
    }
    
    // Configure SSL for production environments
    // For services like Render or Supabase, SSL is required but self-signed certs are common
    const sslConfig = process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false;
    
    pool = new Pool({
      connectionString,
      ssl: sslConfig,
    });
  }
  return pool;
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {any[]} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const client = getPool();
  return client.query(text, params);
}

/**
 * Initialize database migrations
 * Executes scripts/migrate.sql
 */
export async function initMigrations() {
  try {
    const migrationPath = path.join(__dirname, '../scripts/migrate.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('Running database migrations...');
    await query(sql);
    console.log('✓ Database migrations completed successfully');
  } catch (err) {
    console.error('✗ Migration failed:', err);
    throw err;
  }
}

/**
 * Create a new session record
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Initial payload data
 * @returns {Promise<object>}
 */
export async function createSession(sessionId, payload = {}) {
  const result = await query(
    'INSERT INTO sessions (session_id, status, payload) VALUES ($1, $2, $3) RETURNING *',
    [sessionId, 'pending', JSON.stringify(payload)]
  );
  return result.rows[0];
}

/**
 * Update session status and payload
 * @param {string} sessionId - Session identifier
 * @param {string} status - New status
 * @param {object} payload - Updated payload
 * @returns {Promise<object>}
 */
export async function updateSession(sessionId, status, payload = null) {
  const result = await query(
    'UPDATE sessions SET status = $1, payload = $2 WHERE session_id = $3 RETURNING *',
    [status, payload ? JSON.stringify(payload) : null, sessionId]
  );
  return result.rows[0];
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>}
 */
export async function getSession(sessionId) {
  const result = await query('SELECT * FROM sessions WHERE session_id = $1', [sessionId]);
  return result.rows[0] || null;
}

/**
 * Close database pool (for cleanup)
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
