// server/redis-utils.js — Shared Redis connection utilities

/**
 * Parse Redis URL into connection options
 * Supports redis:// and rediss:// (TLS) URLs
 * @param {string} url - Redis connection URL
 * @returns {object} Connection options for Redis/BullMQ
 */
export function parseRedisUrl(url) {
  const parsed = new URL(url);
  const isTLS = parsed.protocol === 'rediss:';
  
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || (isTLS ? '6380' : '6379'), 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    tls: isTLS ? {} : undefined,
  };
}
