// server/db.js — PostgreSQL database wrapper
// Minimal wrapper for node-postgres (pg) with session management
// TODO: Add connection pooling configuration
// TODO: Add query logging for debugging
// TODO: Add transaction support
// TODO: Add proper error handling and retry logic

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

// Initialize connection pool
let pool = null;

function getPool() {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }
    
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('supabase') || process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
      // TODO: Configure pool settings for production
      // max: 20,
      // idleTimeoutMillis: 30000,
      // connectionTimeoutMillis: 2000,
    });
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      // TODO: Add error tracking
    });
  }
  
  return pool;
}

/**
 * Execute migrations from scripts/migrate.sql
 * Call this on application startup
 */
export async function initMigrations() {
  const client = getPool();
  
  try {
    const migrationPath = path.join(__dirname, '../scripts/migrate.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running database migrations...');
    await client.query(migrationSQL);
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Create a new session
 * @param {string} sessionId - Unique session identifier
 * @param {object} payload - Initial payload (brief, page_type, etc.)
 * @returns {Promise<object>} - Created session
 */
export async function createSession(sessionId, payload = {}) {
  const client = getPool();
  
  try {
    const result = await client.query(
      `INSERT INTO sessions (session_id, status, payload, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (session_id) DO UPDATE
       SET status = $2, payload = $3, updated_at = NOW()
       RETURNING *`,
      [sessionId, 'pending', JSON.stringify(payload)]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Failed to create session:', error);
    throw error;
  }
}

/**
 * Update session status and payload
 * @param {string} sessionId - Session identifier
 * @param {object} updates - Updates to apply (status, payload)
 * @returns {Promise<object>} - Updated session
 */
export async function updateSession(sessionId, updates = {}) {
  const client = getPool();
  
  try {
    const { status, payload } = updates;
    
    let query = 'UPDATE sessions SET updated_at = NOW()';
    const values = [sessionId];
    let paramIndex = 2;
    
    if (status) {
      query += `, status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }
    
    if (payload) {
      // Merge with existing payload
      query += `, payload = COALESCE(payload, '{}'::jsonb) || $${paramIndex}::jsonb`;
      values.push(JSON.stringify(payload));
      paramIndex++;
    }
    
    query += ' WHERE session_id = $1 RETURNING *';
    
    const result = await client.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Failed to update session:', error);
    throw error;
  }
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} - Session data or null if not found
 */
export async function getSession(sessionId) {
  const client = getPool();
  
  try {
    const result = await client.query(
      'SELECT * FROM sessions WHERE session_id = $1',
      [sessionId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Failed to get session:', error);
    throw error;
  }
}

/**
 * Check if database is configured
 * @returns {boolean}
 */
export function isDatabaseConfigured() {
  return !!DATABASE_URL;
}

/**
 * Close database connection pool
 * Call this on application shutdown
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool closed');
  }
}

// TODO: Add function to list sessions with pagination
// TODO: Add function to delete old sessions (cleanup)
// TODO: Add indexes on session_id and status for performance
