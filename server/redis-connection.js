// server/redis-connection.js — Redis connection helper for BullMQ
// Supports both standard Redis and Upstash Redis

/**
 * Create Redis connection configuration for BullMQ
 * @returns {Object} Redis connection configuration
 */
export function createConnection() {
  const REDIS_URL = process.env.REDIS_URL;
  
  if (!REDIS_URL) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  // Parse Redis URL
  let config;
  
  try {
    const url = new URL(REDIS_URL);
    
    config = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
    };

    // Add authentication if present
    if (url.password) {
      config.password = url.password;
    }
    
    if (url.username) {
      config.username = url.username;
    }

    // Enable TLS for secure connections (Upstash, Redis Cloud, etc.)
    if (url.protocol === 'rediss:') {
      config.tls = {
        // Allow disabling certificate verification for development/testing
        // Set REDIS_TLS_REJECT_UNAUTHORIZED=false only if needed
        rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
      };
    }

  } catch (error) {
    throw new Error(`Invalid REDIS_URL format: ${error.message}`);
  }

  return config;
}

export default { createConnection };
