import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, runMigrations, type DB } from './client.js';
import * as repo from './repo.js';

let db: DB;
let close: () => void;

beforeEach(() => {
  const opened = openDb(':memory:');
  db = opened.db;
  close = opened.close;
  runMigrations(db);
});

describe('workspaces', () => {
  it('round-trips create → list', () => {
    repo.createWorkspace(db, { id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 100 });
    expect(repo.listWorkspaces(db)).toEqual([{ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 100 }]);
  });
  it('returns null for unknown id', () => {
    expect(repo.getWorkspace(db, 'nope')).toBeNull();
  });
  it('updates label', () => {
    repo.createWorkspace(db, { id: 'ws-1', label: 'Old', vivaldiWorkspaceId: 1 });
    repo.updateWorkspace(db, 'ws-1', { label: 'New' });
    expect(repo.getWorkspace(db, 'ws-1')?.label).toBe('New');
  });
  it('deletes', () => {
    repo.createWorkspace(db, { id: 'ws-1', label: 'X', vivaldiWorkspaceId: 1 });
    repo.deleteWorkspace(db, 'ws-1');
    expect(repo.listWorkspaces(db)).toEqual([]);
  });
});

describe('rules', () => {
  beforeEach(() => {
    repo.createWorkspace(db, { id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 });
  });
  it('round-trips create → list', () => {
    repo.createRule(db, { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' });
    expect(repo.listRules(db)).toHaveLength(1);
  });
  it('rejects duplicate domain', () => {
    repo.createRule(db, { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' });
    expect(() =>
      repo.createRule(db, { id: 'r-2', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' }),
    ).toThrow();
  });
  it('rejects unknown workspaceId', () => {
    expect(() =>
      repo.createRule(db, { id: 'r-x', domain: 'gitlab.com', workspaceId: 'ws-missing', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' }),
    ).toThrow();
  });
  it('increments hitCount', () => {
    repo.createRule(db, { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' });
    repo.incrementRuleHitCount(db, 'github.com');
    repo.incrementRuleHitCount(db, 'github.com');
    expect(repo.getRuleByDomain(db, 'github.com')?.hitCount).toBe(2);
  });
});

describe('examples', () => {
  it('returns recent first', () => {
    repo.createExample(db, { id: 'e-1', domain: 'a.com', title: 'a', url: 'https://a.com', modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep', createdAt: '2026-06-01T00:00:00.000Z' });
    repo.createExample(db, { id: 'e-2', domain: 'b.com', title: 'b', url: 'https://b.com', modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep', createdAt: '2026-06-02T00:00:00.000Z' });
    const recent = repo.listRecentExamples(db, 5);
    expect(recent.map(e => e.id)).toEqual(['e-2', 'e-1']);
  });
  it('filters by domain and limits', () => {
    for (let i = 0; i < 7; i++) {
      repo.createExample(db, { id: `e-${i}`, domain: 'a.com', title: 't', url: 'https://a.com', modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep', createdAt: `2026-06-0${i + 1}T00:00:00.000Z` });
    }
    repo.createExample(db, { id: 'other', domain: 'b.com', title: 't', url: 'https://b.com', modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep', createdAt: '2026-06-09T00:00:00.000Z' });
    const filtered = repo.listExamplesByDomain(db, 'a.com', 3);
    expect(filtered).toHaveLength(3);
    expect(filtered.every(e => e.domain === 'a.com')).toBe(true);
  });
});
