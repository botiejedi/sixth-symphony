import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serve, type ServerType } from '@hono/node-server';
import { buildApp } from './app.js';
import { openDb, runMigrations } from './db/client.js';

let server: ServerType;
let baseUrl: string;

beforeAll(async () => {
  const { db } = openDb(':memory:');
  runMigrations(db);
  const app = buildApp({ db });
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => {
      baseUrl = `http://127.0.0.1:${info.port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

async function post(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('e2e', () => {
  it('writes a workspace, a rule, examples; reads hybrid ranking', async () => {
    expect((await post('/v1/workspaces', { id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 })).status).toBe(201);
    expect((await post('/v1/rules', { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' })).status).toBe(201);
    for (let i = 0; i < 3; i++) {
      await post('/v1/examples', {
        id: `e-${i}`, domain: 'github.com', title: `t${i}`, url: 'https://github.com',
        modelSuggestedWorkspaceId: 'ws-1', userChoseWorkspaceId: 'ws-1', userChoseAction: 'move',
        createdAt: `2026-06-0${i + 1}T00:00:00.000Z`,
      });
    }
    await post('/v1/examples', {
      id: 'other', domain: 'gitlab.com', title: 't', url: 'https://gitlab.com',
      modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep',
      createdAt: '2026-06-09T00:00:00.000Z',
    });

    const res = await fetch(`${baseUrl}/v1/examples?recent=2&domains=github.com`);
    const rows = (await res.json()) as { id: string; domain: string }[];
    const ids = rows.map(r => r.id);
    expect(ids).toContain('other');
    expect(ids).toContain('e-2');
    // dedup: no id appears twice
    expect(new Set(ids).size).toBe(ids.length);
  });
});
