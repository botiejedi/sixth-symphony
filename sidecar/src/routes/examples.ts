import { Hono } from 'hono';
import { ExampleSchema } from '@symphony/shared';
import type { DB } from '../db/client.js';
import * as repo from '../db/repo.js';

export function examplesRouter() {
  const r = new Hono<{ Variables: { db: DB } }>();

  r.get('/', (c) => {
    const db = c.get('db');
    const recentParam = c.req.query('recent');
    const domainsParam = c.req.query('domains');
    if (!recentParam && !domainsParam) return c.json(repo.listExamples(db));

    const recent = recentParam ? Math.max(0, Number.parseInt(recentParam, 10) || 0) : 5;
    const domains = domainsParam ? domainsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    const recentRows = repo.listRecentExamples(db, recent);
    const byDomain = domains.flatMap(d => repo.listExamplesByDomain(db, d, recent));
    const seen = new Set<string>();
    const merged = [...recentRows, ...byDomain].filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    return c.json(merged);
  });

  r.post('/', async (c) => {
    const parsed = ExampleSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    repo.createExample(c.get('db'), parsed.data);
    return c.json(parsed.data, 201);
  });

  r.get('/:id', (c) => {
    const e = repo.getExample(c.get('db'), c.req.param('id'));
    if (!e) return c.json({ error: 'not found' }, 404);
    return c.json(e);
  });

  r.delete('/:id', (c) => {
    repo.deleteExample(c.get('db'), c.req.param('id'));
    return c.body(null, 204);
  });

  return r;
}
