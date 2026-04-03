import pg from 'pg';
import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'augustus',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  max: Number(process.env.DB_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

/**
 * Run all SQL migration files in order on startup.
 * Uses a migrations tracking table to skip already-applied migrations.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const __dir = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = join(__dir, 'migrations');

    let files: string[];
    try {
      files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    } catch {
      console.warn('[Migrations] No migrations directory found, skipping.');
      return;
    }

    for (const file of files) {
      const applied = await client.query(
        `SELECT 1 FROM _migrations WHERE name = $1`,
        [file],
      );
      if (applied.rows.length > 0) continue;

      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        console.log(`[Migrations] Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrations] Failed to apply ${file}:`, err);
        // Don't throw — let the server start even if a migration fails
      }
    }
  } finally {
    client.release();
  }
}
