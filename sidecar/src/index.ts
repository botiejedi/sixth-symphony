import { serve } from '@hono/node-server';
import { buildApp } from './app.js';
import { openDb, runMigrations } from './db/client.js';

const port = Number(process.env.SIDECAR_PORT ?? 8765);
const dbPath = process.env.SIDECAR_DB_PATH ?? 'memory.db';

const requireToken = process.env.SIDECAR_TOKEN || undefined;

const { db } = openDb(dbPath);
runMigrations(db);
const app = buildApp({ db, requireToken });

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`sidecar listening on http://127.0.0.1:${info.port} (db: ${dbPath})`);
});
