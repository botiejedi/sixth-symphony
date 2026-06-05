import { describe, it, expect } from 'vitest';
import { applyHardRules, extractDomain } from './hard-rules.js';
import type { Rule } from '@symphony/shared';

describe('extractDomain', () => {
  it('strips scheme and www.', () => {
    expect(extractDomain('https://www.github.com/foo')).toBe('github.com');
    expect(extractDomain('http://news.ycombinator.com/item?id=1')).toBe('news.ycombinator.com');
  });
  it('returns null on malformed URL', () => {
    expect(extractDomain('not a url')).toBeNull();
  });
});

describe('applyHardRules', () => {
  const rules: Rule[] = [
    { id: 'r-1', domain: 'github.com', workspaceId: 'ws-code', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' },
  ];
  it('assigns matching tabs and leaves the rest', () => {
    const tabs = [
      { id: 1, url: 'https://github.com/x' },
      { id: 2, url: 'https://news.ycombinator.com' },
    ] as chrome.tabs.Tab[];
    const { assigned, remaining } = applyHardRules(tabs, rules);
    expect(assigned).toEqual([{ tabId: 1, workspaceId: 'ws-code' }]);
    expect(remaining.map(t => t.id)).toEqual([2]);
  });
  it('ignores rules whose domain has no matching tab', () => {
    const tabs = [{ id: 1, url: 'https://news.ycombinator.com' }] as chrome.tabs.Tab[];
    const { assigned, remaining } = applyHardRules(tabs, rules);
    expect(assigned).toEqual([]);
    expect(remaining).toHaveLength(1);
  });
});
