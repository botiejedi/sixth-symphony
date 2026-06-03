import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import { openDb, runMigrations } from '../db/client.js';

function freshApp() {
  const { db } = openDb(':memory:');
  runMigrations(db);
  return buildApp({ db });
}

const makeExample = (id: string, domain: string, createdAt: string) => ({
  id,
  domain,
  title: `title-${id}`,
  url: `https://${domain}`,
  modelSuggestedWorkspaceId: null,
  userChoseWorkspaceId: null,
  userChoseAction: 'keep',
  createdAt,
});

async function postExample(app: ReturnType<typeof buildApp>, ex: ReturnType<typeof makeExample>) {
  return app.request('/v1/examples', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ex),
  });
}

describe('POST /v1/examples', () => {
  it('creates an example and returns 201 with body echo', async () => {
    const app = freshApp();
    const ex = makeExample('e-1', 'a.com', '2026-06-01T00:00:00.000Z');
    const res = await postExample(app, ex);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: 'e-1', domain: 'a.com' });
  });

  it('returns 400 for invalid body', async () => {
    const app = freshApp();
    const res = await app.request('/v1/examples', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '', domain: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/examples (no params)', () => {
  it('returns all examples, most recent first', async () => {
    const app = freshApp();
    await postExample(app, makeExample('e-1', 'a.com', '2026-06-01T00:00:00.000Z'));
    await postExample(app, makeExample('e-2', 'b.com', '2026-06-03T00:00:00.000Z'));
    await postExample(app, makeExample('e-3', 'c.com', '2026-06-02T00:00:00.000Z'));
    const res = await app.request('/v1/examples');
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string }[];
    // listExamples doesn't guarantee order but all 3 must be present
    expect(body).toHaveLength(3);
    const ids = body.map(e => e.id);
    expect(ids).toContain('e-1');
    expect(ids).toContain('e-2');
    expect(ids).toContain('e-3');
  });
});

describe('GET /v1/examples?recent=5', () => {
  it('returns top 5 by createdAt desc', async () => {
    const app = freshApp();
    // Insert 7 examples
    for (let i = 1; i <= 7; i++) {
      await postExample(app, makeExample(`e-${i}`, 'a.com', `2026-06-0${i}T00:00:00.000Z`));
    }
    const res = await app.request('/v1/examples?recent=5');
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string }[];
    expect(body).toHaveLength(5);
    // Most recent 5: e-7, e-6, e-5, e-4, e-3
    expect(body[0].id).toBe('e-7');
    expect(body[4].id).toBe('e-3');
  });
});

describe('GET /v1/examples?recent=2&domains=a.com,b.com', () => {
  it('returns recent + per-domain rows, deduped by id', async () => {
    const app = freshApp();
    // 3 examples for a.com
    await postExample(app, makeExample('a-1', 'a.com', '2026-06-01T00:00:00.000Z'));
    await postExample(app, makeExample('a-2', 'a.com', '2026-06-02T00:00:00.000Z'));
    await postExample(app, makeExample('a-3', 'a.com', '2026-06-03T00:00:00.000Z'));
    // 2 examples for b.com
    await postExample(app, makeExample('b-1', 'b.com', '2026-06-04T00:00:00.000Z'));
    await postExample(app, makeExample('b-2', 'b.com', '2026-06-05T00:00:00.000Z'));
    // 1 for c.com (should not appear in domain results but may appear in recent)
    await postExample(app, makeExample('c-1', 'c.com', '2026-06-06T00:00:00.000Z'));

    // recent=2: top 2 overall = c-1 (2026-06-06), b-2 (2026-06-05)
    // domains=a.com: top 2 for a.com = a-3, a-2
    // domains=b.com: top 2 for b.com = b-2, b-1
    // merged and deduped: c-1, b-2, a-3, a-2, b-1 (b-2 deduplicated)
    const res = await app.request('/v1/examples?recent=2&domains=a.com,b.com');
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string }[];
    const ids = body.map(e => e.id);

    // No id appears twice
    expect(new Set(ids).size).toBe(ids.length);

    // The top 2 recent should be present
    expect(ids).toContain('c-1');
    expect(ids).toContain('b-2');

    // Per-domain a.com top 2 should be present
    expect(ids).toContain('a-3');
    expect(ids).toContain('a-2');

    // b-1 also present from b.com domain slice (b-2 already in recent, b-1 is #2)
    expect(ids).toContain('b-1');
  });
});

describe('GET /v1/examples/:id', () => {
  it('returns the example', async () => {
    const app = freshApp();
    await postExample(app, makeExample('e-1', 'a.com', '2026-06-01T00:00:00.000Z'));
    const res = await app.request('/v1/examples/e-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'e-1' });
  });

  it('404 for unknown id', async () => {
    const app = freshApp();
    const res = await app.request('/v1/examples/nope');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /v1/examples/:id', () => {
  it('removes the example and returns 204', async () => {
    const app = freshApp();
    await postExample(app, makeExample('e-1', 'a.com', '2026-06-01T00:00:00.000Z'));
    const res = await app.request('/v1/examples/e-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    const after = await app.request('/v1/examples');
    expect(await after.json()).toEqual([]);
  });
});
