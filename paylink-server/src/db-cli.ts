import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabasePool, migrateDatabase, seedDatabase } from './database.js';
import { loadConfig } from './config.js';
import type { RowDataPacket } from 'mysql2/promise';

if (existsSync(resolve('.env'))) {
  for (const line of readFileSync(resolve('.env'), 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const command = process.argv[2] ?? 'setup';
const config = loadConfig({ ...process.env, PAYLINK_PERSISTENCE: 'mysql' });
const pool = createDatabasePool(config);

try {
  if (command === 'migrate') {
    const applied = await migrateDatabase(pool);
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is already current.');
  } else if (command === 'seed') {
    await seedDatabase(pool);
    console.log('Seeded PayLink demo data.');
  } else if (command === 'setup') {
    const applied = await migrateDatabase(pool);
    await seedDatabase(pool);
    console.log(`${applied.length ? `Applied migrations: ${applied.join(', ')}. ` : ''}Seeded PayLink demo data.`);
  } else if (command === 'verify') {
    const tables = ['users', 'checkout_sessions', 'payment_methods', 'payments', 'support_tickets', 'support_ticket_messages', 'notifications'];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const [rows] = await pool.query<(RowDataPacket & { count: number })[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
      counts[table] = Number(rows[0]?.count ?? 0);
    }
    console.log(JSON.stringify(counts));
  } else {
    throw new Error(`Unknown database command: ${command}. Use migrate, seed, setup, or verify.`);
  }
} finally {
  await pool.end();
}
