// @vitest-environment node
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { SidecarClient, SidecarUnreachable } from './client.js';

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = new SidecarClient('http://127.0.0.1:8765');

describe('SidecarClient', () => {
  it('listRules returns parsed rows', async () => {
    server.use(http.get('http://127.0.0.1:8765/v1/rules', () =>
      HttpResponse.json([{ id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' }])));
    const rules = await client.listRules();
    expect(rules[0].domain).toBe('github.com');
  });
  it('throws SidecarUnreachable when fetch rejects after one retry', async () => {
    server.use(http.get('http://127.0.0.1:8765/v1/rules', () => HttpResponse.error()));
    await expect(client.listRules()).rejects.toBeInstanceOf(SidecarUnreachable);
  });
  it('hybrid examples query encodes domains correctly', async () => {
    let receivedUrl = '';
    server.use(http.get('http://127.0.0.1:8765/v1/examples', ({ request }) => {
      receivedUrl = request.url;
      return HttpResponse.json([]);
    }));
    await client.listExamplesHybrid({ recent: 5, domains: ['github.com', 'news.ycombinator.com'] });
    expect(receivedUrl).toContain('recent=5');
    expect(receivedUrl).toContain('domains=github.com%2Cnews.ycombinator.com');
  });
});
