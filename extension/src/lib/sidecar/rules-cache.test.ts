import { describe, it, expect, vi } from 'vitest';
import { RulesCache } from './rules-cache.js';
import type { Rule } from '@symphony/shared';

function memStorage(): typeof chrome.storage.local {
  const data: Record<string, unknown> = {};
  return {
    get: vi.fn(async (keys: string | string[]) => {
      const ks = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(ks.filter(k => k in data).map(k => [k, data[k]]));
    }),
    set: vi.fn(async (kv: Record<string, unknown>) => { Object.assign(data, kv); }),
    remove: vi.fn(async (k: string) => { delete data[k]; }),
  } as unknown as typeof chrome.storage.local;
}

const RULE: Rule = { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' };

describe('RulesCache', () => {
  it('round-trips rules through storage', async () => {
    const cache = new RulesCache(memStorage());
    await cache.write([RULE]);
    expect(await cache.read()).toEqual([RULE]);
  });
  it('returns [] when nothing cached', async () => {
    const cache = new RulesCache(memStorage());
    expect(await cache.read()).toEqual([]);
  });
  it('refresh writes new rules and reports the refresh time', async () => {
    const cache = new RulesCache(memStorage());
    const t = await cache.refreshedAt();
    expect(t).toBeNull();
    await cache.write([RULE]);
    const after = await cache.refreshedAt();
    expect(after).toBeInstanceOf(Date);
  });
});
