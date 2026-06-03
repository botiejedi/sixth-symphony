import { openDb, runMigrations } from './client.js';

const path = process.env.SIDECAR_DB_PATH ?? 'memory.db';
const { db, close } = openDb(path);
runMigrations(db);
close();
console.log(`migrated ${path}`);
