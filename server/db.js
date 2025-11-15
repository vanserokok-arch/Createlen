// server/db.js — Minimal PostgreSQL wrapper for session management
// Uses node-postgres (pg) to interact with Supabase PostgreSQL database

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pool = null;

/**
 * Get or create PostgreSQL connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }
  
  return pool;
}

/**
 * Run database migrations from scripts/migrate.sql
 * @returns {Promise<void>}
 */
export async function initMigrations() {
  const pool = getPool();
  const migrationPath = join(__dirname, '..', 'scripts', 'migrate.sql');
  
  try {
    const sql = readFileSync(migrationPath, 'utf-8');
    await pool.query(sql);
    console.log('✓ Database migrations completed successfully');
  } catch (err) {
    console.error('✗ Database migration failed:', err);
    throw err;
  }
}

/**
 * Create a new session record
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Initial payload data
 * @returns {Promise<object>} Created session record
 */
export async function createSession(sessionId, payload = {}) {
  const pool = getPool();
  const query = `
    INSERT INTO sessions (session_id, status, payload, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *
  `;
  
  try {
    const result = await pool.query(query, [sessionId, 'pending', JSON.stringify(payload)]);
    return result.rows[0];
  } catch (err) {
    console.error('Error creating session:', err);
    throw err;
  }
}

/**
 * Update session with result data
 * @param {string} sessionId - Session identifier
 * @param {object} updates - Fields to update (status, result, s3_url, error)
 * @returns {Promise<object>} Updated session record
 */
export async function updateSession(sessionId, updates = {}) {
  const pool = getPool();
  
  const fields = [];
  const values = [];
  let paramCounter = 1;
  
  if (updates.status !== undefined) {
    fields.push(`status = $${paramCounter++}`);
    values.push(updates.status);
  }
  
  if (updates.result !== undefined) {
    fields.push(`result = $${paramCounter++}`);
    values.push(JSON.stringify(updates.result));
  }
  
  if (updates.s3_url !== undefined) {
    fields.push(`s3_url = $${paramCounter++}`);
    values.push(updates.s3_url);
  }
  
  if (updates.error !== undefined) {
    fields.push(`error = $${paramCounter++}`);
    values.push(updates.error);
  }
  
  fields.push(`updated_at = NOW()`);
  
  values.push(sessionId);
  
  const query = `
    UPDATE sessions
    SET ${fields.join(', ')}
    WHERE session_id = $${paramCounter}
    RETURNING *
  `;
  
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return result.rows[0];
  } catch (err) {
    console.error('Error updating session:', err);
    throw err;
  }
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} Session record or null if not found
 */
export async function getSession(sessionId) {
  const pool = getPool();
  const query = 'SELECT * FROM sessions WHERE session_id = $1';
  
  try {
    const result = await pool.query(query, [sessionId]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error getting session:', err);
    throw err;
  }
}

/**
 * List sessions with optional filters
 * @param {object} options - Query options (status, limit, offset)
 * @returns {Promise<Array>} Array of session records
 */
export async function listSessions(options = {}) {
  const pool = getPool();
  const { status, limit = 50, offset = 0 } = options;
  
  let query = 'SELECT * FROM sessions';
  const values = [];
  
  if (status) {
    query += ' WHERE status = $1';
    values.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);
  
  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (err) {
    console.error('Error listing sessions:', err);
    throw err;
  }
}

/**
 * Close database connection pool
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// CLI support for running migrations
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'migrate') {
    console.log('Running database migrations...');
    try {
      await initMigrations();
      await closePool();
      console.log('Migrations completed successfully');
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  } else {
    console.log('Usage: node server/db.js migrate');
    process.exit(1);
  }
}
