// server/db.js — PostgreSQL database wrapper using node-postgres (pg)
// Provides connection pooling and migration utilities for Createlen

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;

/**
 * Initialize PostgreSQL connection pool
 * Uses DATABASE_URL environment variable for connection
 */
export function initPool() {
  if (pool) return pool;
  
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      // Allow disabling certificate verification for development/testing
      // Set DB_SSL_REJECT_UNAUTHORIZED=false only if needed
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error', err);
  });

  return pool;
}

/**
 * Get database pool instance
 */
export function getPool() {
  if (!pool) {
    return initPool();
  }
  return pool;
}

/**
 * Execute database query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
export async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

/**
 * Execute migrations from scripts/migrate.sql
 * Run this on server startup or via CLI
 */
export async function initMigrations() {
  try {
    const migrationPath = path.join(__dirname, '..', 'scripts', 'migrate.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    console.log('Running database migrations...');
    await query(migrationSQL);
    console.log('Database migrations completed successfully');
    
    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error(`Migration failed: ${error.message}`);
  }
}

/**
 * Session management functions
 */

/**
 * Create a new session record
 */
export async function createSession(sessionId, payload) {
  const result = await query(
    'INSERT INTO sessions (session_id, status, payload) VALUES ($1, $2, $3) RETURNING *',
    [sessionId, 'pending', JSON.stringify(payload)]
  );
  return result.rows[0];
}

/**
 * Get session by session_id
 */
export async function getSession(sessionId) {
  const result = await query(
    'SELECT * FROM sessions WHERE session_id = $1',
    [sessionId]
  );
  return result.rows[0] || null;
}

/**
 * Update session status and result
 */
export async function updateSession(sessionId, updates) {
  const { status, result_url, error_message } = updates;
  const result = await query(
    'UPDATE sessions SET status = COALESCE($2, status), result_url = COALESCE($3, result_url), error_message = COALESCE($4, error_message) WHERE session_id = $1 RETURNING *',
    [sessionId, status, result_url, error_message]
  );
  return result.rows[0] || null;
}

/**
 * List recent sessions (for debugging/monitoring)
 */
export async function listSessions(limit = 100) {
  const result = await query(
    'SELECT * FROM sessions ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
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

// TODO: Add connection retry logic
// TODO: Add query timeout configuration
// TODO: Add transaction support helpers
// TODO: Add prepared statement caching for frequently used queries

export default {
  initPool,
  getPool,
  query,
  initMigrations,
  createSession,
  getSession,
  updateSession,
  listSessions,
  closePool,
};
