import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import { openDb, runMigrations } from '../db/client.js';

function freshApp() {
  const { db } = openDb(':memory:');
  runMigrations(db);
  return buildApp({ db });
}

describe('POST /v1/workspaces', () => {
  it('creates a workspace and returns it', async () => {
    const app = freshApp();
    const res = await app.request('/v1/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 100 }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 100 });
  });
  it('400 on invalid body', async () => {
    const app = freshApp();
    const res = await app.request('/v1/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '', label: '', vivaldiWorkspaceId: 'oops' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/workspaces', () => {
  it('lists workspaces', async () => {
    const app = freshApp();
    await app.request('/v1/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 }) });
    const res = await app.request('/v1/workspaces');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 }]);
  });
});

describe('GET /v1/workspaces/:id', () => {
  it('returns workspace', async () => {
    const app = freshApp();
    await app.request('/v1/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 }) });
    const res = await app.request('/v1/workspaces/ws-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'ws-1' });
  });
  it('404 on unknown id', async () => {
    const app = freshApp();
    const res = await app.request('/v1/workspaces/nope');
    expect(res.status).toBe(404);
  });
});

describe('PUT /v1/workspaces/:id', () => {
  it('updates label', async () => {
    const app = freshApp();
    await app.request('/v1/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'ws-1', label: 'Old', vivaldiWorkspaceId: 1 }) });
    const res = await app.request('/v1/workspaces/ws-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'New' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).label).toBe('New');
  });
});

describe('DELETE /v1/workspaces/:id', () => {
  it('removes the workspace', async () => {
    const app = freshApp();
    await app.request('/v1/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'ws-1', label: 'X', vivaldiWorkspaceId: 1 }) });
    const res = await app.request('/v1/workspaces/ws-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    const after = await app.request('/v1/workspaces');
    expect(await after.json()).toEqual([]);
  });
});
