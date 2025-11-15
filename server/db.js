// server/db.js — minimal PostgreSQL wrapper using node-postgres
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;

/**
 * Get or create PostgreSQL connection pool
 */
export function getPool() {
  if (!pool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

/**
 * Execute migrations from scripts/migrate.sql
 * 
 * TODO: Implement proper migration tracking to avoid re-running migrations
 * Current implementation runs all migrations on every call, which is not ideal for production.
 * Consider adding a 'migrations' table to track executed migrations, or use a migration
 * library like knex, typeorm, or db-migrate for better migration management.
 */
export async function initMigrations() {
  const pool = getPool();
  const migrationPath = path.join(__dirname, '..', 'scripts', 'migrate.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.warn('Migration file not found at', migrationPath);
    return;
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  try {
    await pool.query(sql);
    console.log('Database migrations executed successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  }
}

/**
 * Create a new session record
 */
export async function createSession(sessionId, payload = {}) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO sessions (session_id, status, payload, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING *`,
    [sessionId, 'pending', JSON.stringify(payload)]
  );
  return result.rows[0];
}

/**
 * Update session status and payload
 */
export async function updateSession(sessionId, status, payload = null) {
  const pool = getPool();
  const updates = ['status = $2', 'updated_at = NOW()'];
  const values = [sessionId, status];
  
  if (payload !== null) {
    updates.push('payload = $3');
    values.push(JSON.stringify(payload));
  }
  
  const result = await pool.query(
    `UPDATE sessions SET ${updates.join(', ')}
     WHERE session_id = $1
     RETURNING *`,
    values
  );
  return result.rows[0];
}

/**
 * Get session by session_id
 */
export async function getSession(sessionId) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM sessions WHERE session_id = $1',
    [sessionId]
  );
  return result.rows[0] || null;
}

/**
 * Close the connection pool (for graceful shutdown)
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
