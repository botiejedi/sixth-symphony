import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import { openDb, runMigrations } from '../db/client.js';

describe('auth middleware', () => {
  it('off by default — health responds without a token', async () => {
    const { db } = openDb(':memory:');
    runMigrations(db);
    const app = buildApp({ db });
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
  });
  it('on when SIDECAR_TOKEN is set — 401 without bearer', async () => {
    const { db } = openDb(':memory:');
    runMigrations(db);
    const app = buildApp({ db, requireToken: 'secret' });
    const res = await app.request('/v1/health');
    expect(res.status).toBe(401);
  });
  it('on when SIDECAR_TOKEN is set — 200 with correct bearer', async () => {
    const { db } = openDb(':memory:');
    runMigrations(db);
    const app = buildApp({ db, requireToken: 'secret' });
    const res = await app.request('/v1/health', { headers: { authorization: 'Bearer secret' } });
    expect(res.status).toBe(200);
  });
});
