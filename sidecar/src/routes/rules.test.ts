import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { openDb, runMigrations } from '../db/client.js';

function freshApp() {
  const { db } = openDb(':memory:');
  runMigrations(db);
  return buildApp({ db });
}

// Helper: create a workspace via the API so rules can FK it
async function createWorkspace(app: ReturnType<typeof buildApp>, id = 'ws-1') {
  return app.request('/v1/workspaces', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, label: 'Work', vivaldiWorkspaceId: 1 }),
  });
}

const validRule = {
  id: 'r-1',
  domain: 'github.com',
  workspaceId: 'ws-1',
  hitCount: 0,
  createdAt: '2026-06-02T00:00:00.000Z',
};

describe('POST /v1/rules', () => {
  it('creates a rule and returns 201 with body', async () => {
    const app = freshApp();
    await createWorkspace(app);
    const res = await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRule),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: 'r-1', domain: 'github.com' });
  });

  it('returns 409 on duplicate domain', async () => {
    const app = freshApp();
    await createWorkspace(app);
    await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRule),
    });
    const res = await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validRule, id: 'r-2' }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 400 for unknown workspaceId', async () => {
    const app = freshApp();
    // No workspace created — workspaceId won't exist
    const res = await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validRule, workspaceId: 'ws-missing' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'unknown workspaceId' });
  });

  it('returns 400 when domain contains a scheme (RuleSchema regex)', async () => {
    const app = freshApp();
    await createWorkspace(app);
    const res = await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validRule, id: 'r-bad', domain: 'https://github.com' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/rules', () => {
  it('lists all rules', async () => {
    const app = freshApp();
    await createWorkspace(app);
    await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRule),
    });
    const res = await app.request('/v1/rules');
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(1);
  });
});

describe('GET /v1/rules/:id', () => {
  it('returns the rule', async () => {
    const app = freshApp();
    await createWorkspace(app);
    await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRule),
    });
    const res = await app.request('/v1/rules/r-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'r-1', domain: 'github.com' });
  });

  it('404 for unknown id', async () => {
    const app = freshApp();
    const res = await app.request('/v1/rules/nope');
    expect(res.status).toBe(404);
  });
});

describe('PUT /v1/rules/:id', () => {
  it('updates workspaceId and returns updated rule', async () => {
    const app = freshApp();
    await createWorkspace(app, 'ws-1');
    await createWorkspace(app, 'ws-2');
    await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRule),
    });
    const res = await app.request('/v1/rules/r-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws-2' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json() as { workspaceId: string }).workspaceId).toBe('ws-2');
  });
});

describe('DELETE /v1/rules/:id', () => {
  it('removes the rule and returns 204', async () => {
    const app = freshApp();
    await createWorkspace(app);
    await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRule),
    });
    const res = await app.request('/v1/rules/r-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    const after = await app.request('/v1/rules');
    expect(await after.json()).toEqual([]);
  });
});

describe('POST /v1/rules/:domain/increment', () => {
  it('bumps hitCount on the rule for that domain', async () => {
    const app = freshApp();
    await createWorkspace(app);
    await app.request('/v1/rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRule),
    });
    await app.request('/v1/rules/github.com/increment', { method: 'POST' });
    const res = await app.request('/v1/rules/github.com/increment', { method: 'POST' });
    expect(res.status).toBe(200);
    expect((await res.json() as { hitCount: number }).hitCount).toBe(2);
  });

  it('returns 404 for unknown domain', async () => {
    const app = freshApp();
    const res = await app.request('/v1/rules/nope.com/increment', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
