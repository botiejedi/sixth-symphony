import { Hono } from 'hono';
import { RuleSchema } from '@symphony/shared';
import type { DB } from '../db/client.js';
import * as repo from '../db/repo.js';

export function rulesRouter() {
  const r = new Hono<{ Variables: { db: DB } }>();

  r.get('/', (c) => c.json(repo.listRules(c.get('db'))));

  r.post('/', async (c) => {
    const parsed = RuleSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    const db = c.get('db');
    if (!repo.getWorkspace(db, parsed.data.workspaceId)) {
      return c.json({ error: 'unknown workspaceId' }, 400);
    }
    if (repo.getRuleByDomain(db, parsed.data.domain)) {
      return c.json({ error: 'domain already has a rule' }, 409);
    }
    repo.createRule(db, parsed.data);
    return c.json(parsed.data, 201);
  });

  r.get('/:id', (c) => {
    const rule = repo.getRule(c.get('db'), c.req.param('id'));
    if (!rule) return c.json({ error: 'not found' }, 404);
    return c.json(rule);
  });

  r.put('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = repo.getRule(c.get('db'), id);
    if (!existing) return c.json({ error: 'not found' }, 404);
    const body = await c.req.json();
    const parsed = RuleSchema.partial().omit({ id: true }).safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    repo.updateRule(c.get('db'), id, parsed.data);
    return c.json(repo.getRule(c.get('db'), id));
  });

  r.delete('/:id', (c) => {
    repo.deleteRule(c.get('db'), c.req.param('id'));
    return c.body(null, 204);
  });

  r.post('/:domain/increment', (c) => {
    const domain = c.req.param('domain');
    if (!repo.getRuleByDomain(c.get('db'), domain)) {
      return c.json({ error: 'not found' }, 404);
    }
    repo.incrementRuleHitCount(c.get('db'), domain);
    return c.json(repo.getRuleByDomain(c.get('db'), domain));
  });

  return r;
}
