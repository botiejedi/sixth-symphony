import { Hono } from 'hono';
import { WorkspaceSchema } from '@symphony/shared';
import type { DB } from '../db/client.js';
import * as repo from '../db/repo.js';

const PatchSchema = WorkspaceSchema.partial().omit({ id: true });

export function workspacesRouter() {
  const r = new Hono<{ Variables: { db: DB } }>();

  r.get('/', (c) => c.json(repo.listWorkspaces(c.get('db'))));

  r.post('/', async (c) => {
    const parsed = WorkspaceSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    repo.createWorkspace(c.get('db'), parsed.data);
    return c.json(parsed.data, 201);
  });

  r.get('/:id', (c) => {
    const w = repo.getWorkspace(c.get('db'), c.req.param('id'));
    if (!w) return c.json({ error: 'not found' }, 404);
    return c.json(w);
  });

  r.put('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = repo.getWorkspace(c.get('db'), id);
    if (!existing) return c.json({ error: 'not found' }, 404);
    const parsed = PatchSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    repo.updateWorkspace(c.get('db'), id, parsed.data);
    return c.json(repo.getWorkspace(c.get('db'), id));
  });

  r.delete('/:id', (c) => {
    repo.deleteWorkspace(c.get('db'), c.req.param('id'));
    return c.body(null, 204);
  });

  return r;
}
