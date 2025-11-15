// server/db.js — Postgres database wrapper for session management
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let pool = null;

/**
 * Get or create database connection pool
 */
export function getPool() {
  if (!pool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    });
  }
  return pool;
}

/**
 * Initialize database migrations
 * Executes scripts/migrate.sql
 */
export async function initMigrations() {
  const migrationPath = path.join(__dirname, '..', 'scripts', 'migrate.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(migrationSQL);
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
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
    INSERT INTO sessions (session_id, status, payload, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *
  `;
  const values = [sessionId, 'pending', JSON.stringify(payload)];
  
  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Create session error:', error);
    throw error;
  }
}

/**
 * Update an existing session
 * @param {string} sessionId - Session identifier
 * @param {object} updates - Fields to update (status, result, error_message, s3_url)
 * @returns {Promise<object>} Updated session record
 */
export async function updateSession(sessionId, updates) {
  const pool = getPool();
  
  // Build dynamic update query
  const fields = [];
  const values = [];
  let paramIndex = 1;
  
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.result !== undefined) {
    fields.push(`result = $${paramIndex++}`);
    values.push(JSON.stringify(updates.result));
  }
  if (updates.error_message !== undefined) {
    fields.push(`error_message = $${paramIndex++}`);
    values.push(updates.error_message);
  }
  if (updates.s3_url !== undefined) {
    fields.push(`s3_url = $${paramIndex++}`);
    values.push(updates.s3_url);
  }
  
  fields.push(`updated_at = NOW()`);
  values.push(sessionId);
  
  const query = `
    UPDATE sessions
    SET ${fields.join(', ')}
    WHERE session_id = $${paramIndex}
    RETURNING *
  `;
  
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return result.rows[0];
  } catch (error) {
    console.error('Update session error:', error);
    throw error;
  }
}

/**
 * Get session by sessionId
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Session record or null if not found
 */
export async function getSession(sessionId) {
  const pool = getPool();
  const query = 'SELECT * FROM sessions WHERE session_id = $1';
  
  try {
    const result = await pool.query(query, [sessionId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Get session error:', error);
    throw error;
  }
}

/**
 * Close database connection pool
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// TODO: Add pagination support for listing sessions
// TODO: Add cleanup job for old sessions (e.g., delete after 7 days)
// TODO: Add retry logic for transient database errors
