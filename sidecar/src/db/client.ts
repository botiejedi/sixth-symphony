import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

export type DB = BetterSQLite3Database<typeof schema>;

export function openDb(dbPath: string): { db: DB; close: () => void } {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return {
    db,
    close: () => sqlite.close(),
  };
}

export function runMigrations(db: DB): void {
  const here = fileURLToPath(new URL('.', import.meta.url));
  migrate(db, { migrationsFolder: resolve(here, '../../drizzle') });
}
