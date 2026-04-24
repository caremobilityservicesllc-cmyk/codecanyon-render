import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function applyBootstrapSchema() {
  const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sql', 'bootstrap.sql');
  const sql = await fs.readFile(filePath, 'utf8');
  await pool.query(sql);
}