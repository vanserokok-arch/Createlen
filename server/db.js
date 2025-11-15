// server/db.js — PostgreSQL wrapper for session management
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let pool = null;

/**
 * Initialize database connection pool
 * @returns {Pool} PostgreSQL pool instance
 */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString,
      // SSL configuration for production databases (Supabase, etc.)
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

/**
 * Run database migrations from scripts/migrate.sql
 * TODO: In production, use a proper migration tool like node-pg-migrate or db-migrate
 */
export async function initMigrations() {
  const pool = getPool();
  const migrationPath = path.join(__dirname, '../scripts/migrate.sql');
  
  try {
    const sql = await fs.readFile(migrationPath, 'utf-8');
    await pool.query(sql);
    console.log('✓ Database migrations completed successfully');
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    throw err;
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
 * Update session status and optionally result URL
 * @param {string} sessionId - Session identifier
 * @param {string} status - New status (pending, processing, completed, failed)
 * @param {string} [resultUrl] - Optional S3 URL to generated result
 * @returns {Promise<object>} Updated session record
 */
export async function updateSession(sessionId, status, resultUrl = null) {
  const pool = getPool();
  const query = `
    UPDATE sessions
    SET status = $1, result_url = $2
    WHERE session_id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [status, resultUrl, sessionId]);
  return result.rows[0];
}

/**
 * Get session by ID
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
 * Close database connection pool
 * Call this when shutting down the server
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
