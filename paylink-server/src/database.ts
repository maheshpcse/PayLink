import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, { type Pool, type PoolOptions, type RowDataPacket } from 'mysql2/promise';
import type { AppConfig } from './config.js';

const migrationsDirectory = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations');

function statements(sql: string): string[] {
  return sql.split(';').map((statement) => statement.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
}

export function createDatabasePool(config: AppConfig): Pool {
  const options: PoolOptions = {
    host: config.mysqlHost,
    port: config.mysqlPort,
    database: config.mysqlDatabase,
    user: config.mysqlUser,
    password: config.mysqlPassword,
    waitForConnections: true,
    connectionLimit: 5,
    decimalNumbers: true,
    ...(config.mysqlSsl ? { ssl: {} } : {}),
  };
  return mysql.createPool(options);
}

async function migrationFiles(): Promise<string[]> {
  const files = await readdir(migrationsDirectory);
  return files.filter((file) => /^\d{3}_.*\.sql$/.test(file) && !file.includes('seed')).sort();
}

export async function migrateDatabase(pool: Pool): Promise<string[]> {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(120) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))');
  const [rows] = await pool.query<(RowDataPacket & { version: string })[]>('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.version));
  const completed: string[] = [];
  for (const file of await migrationFiles()) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(migrationsDirectory, file), 'utf8');
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const statement of statements(sql)) await connection.query(statement);
      await connection.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
      await connection.commit();
      completed.push(file);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return completed;
}

export async function seedDatabase(pool: Pool): Promise<void> {
  await migrateDatabase(pool);
  const sql = await readFile(join(migrationsDirectory, '002_seed_demo.sql'), 'utf8');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const statement of statements(sql)) await connection.query(statement);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
