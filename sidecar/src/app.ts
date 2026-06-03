import { Hono } from 'hono';
import type { DB } from './db/client.js';
import { workspacesRouter } from './routes/workspaces.js';
import { rulesRouter } from './routes/rules.js';
import { examplesRouter } from './routes/examples.js';

export interface AppDeps {
  db: DB;
}

export function buildApp(deps: AppDeps) {
  const app = new Hono<{ Variables: { db: DB } }>();

  app.use('*', async (c, next) => {
    c.set('db', deps.db);
    await next();
  });

  app.get('/v1/health', (c) => c.json({ ok: true }));

  app.route('/v1/workspaces', workspacesRouter());
  app.route('/v1/rules', rulesRouter());
  app.route('/v1/examples', examplesRouter());

  app.notFound((c) => c.json({ error: `not found: ${c.req.path}` }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message ?? 'internal error' }, 500);
  });

  return app;
}
