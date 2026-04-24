import { applyBootstrapSchema, pool } from '../db.js';

try {
  await applyBootstrapSchema();
  console.log('Bootstrap schema applied successfully.');
  await pool.end();
} catch (error) {
  console.error(error);
  await pool.end();
  process.exit(1);
}