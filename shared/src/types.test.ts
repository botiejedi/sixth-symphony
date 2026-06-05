import { describe, it, expect } from 'vitest';
import { WorkspaceSchema, RuleSchema, ExampleSchema } from './types.js';

describe('WorkspaceSchema', () => {
  it('accepts a valid workspace', () => {
    const v = WorkspaceSchema.parse({ id: 'ws-12345', label: 'Work', vivaldiWorkspaceId: 12345 });
    expect(v.label).toBe('Work');
  });
  it('rejects empty label', () => {
    expect(() => WorkspaceSchema.parse({ id: 'ws-1', label: '', vivaldiWorkspaceId: 1 })).toThrow();
  });
});

describe('RuleSchema', () => {
  it('accepts a valid domain rule', () => {
    const r = RuleSchema.parse({ id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 5, createdAt: '2026-06-02T00:00:00.000Z' });
    expect(r.domain).toBe('github.com');
  });
  it('rejects a domain with a scheme', () => {
    expect(() => RuleSchema.parse({ id: 'r-1', domain: 'https://github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' })).toThrow();
  });
});

describe('ExampleSchema', () => {
  it('accepts a valid correction example', () => {
    const e = ExampleSchema.parse({
      id: 'e-1',
      domain: 'news.ycombinator.com',
      title: 'Show HN: ...',
      url: 'https://news.ycombinator.com/item?id=1',
      modelSuggestedWorkspaceId: 'ws-2',
      userChoseWorkspaceId: 'ws-3',
      userChoseAction: 'move',
      createdAt: '2026-06-02T00:00:00.000Z',
    });
    expect(e.userChoseAction).toBe('move');
  });
  it('rejects an invalid action', () => {
    expect(() => ExampleSchema.parse({
      id: 'e-1', domain: 'x.com', title: 't', url: 'https://x.com',
      modelSuggestedWorkspaceId: 'ws-1', userChoseWorkspaceId: 'ws-2',
      userChoseAction: 'banish', createdAt: '2026-06-02T00:00:00.000Z',
    })).toThrow();
  });
});
