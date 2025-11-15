// server/worker-process.js — Worker process bootstrap
// TODO: Add worker metrics and monitoring
// TODO: Implement graceful shutdown with job completion
// TODO: Add worker scaling documentation

import dotenv from 'dotenv';
import { startWorker } from '../worker/worker.js';

dotenv.config();

console.log('Starting Createlen worker process...');

// Start the worker
startWorker()
  .then(() => {
    console.log('✓ Worker started successfully');
  })
  .catch((err) => {
    console.error('✗ Failed to start worker:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  // TODO: Implement graceful shutdown logic
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  // TODO: Implement graceful shutdown logic
  process.exit(0);
});
