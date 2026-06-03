import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';
import { openDb, runMigrations } from './db/client.js';

function freshApp() {
  const { db } = openDb(':memory:');
  runMigrations(db);
  return buildApp({ db });
}

describe('GET /v1/health', () => {
  it('returns 200 with ok:true', async () => {
    const app = freshApp();
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('404', () => {
  it('returns a JSON error envelope', async () => {
    const app = freshApp();
    const res = await app.request('/v1/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
  });
});
