import { describe, it, expect } from 'vitest';
import { parseVivExtData, discoverWorkspaces } from './workspaces.js';

describe('parseVivExtData', () => {
  it('returns null for undefined/empty', () => {
    expect(parseVivExtData(undefined)).toBeNull();
    expect(parseVivExtData('')).toBeNull();
  });
  it('returns parsed object with numeric workspaceId', () => {
    expect(parseVivExtData(JSON.stringify({ workspaceId: 12345 }))).toEqual({ workspaceId: 12345 });
  });
  it('returns parsed object even when workspaceId is a float', () => {
    expect(parseVivExtData(JSON.stringify({ workspaceId: 12345.0 }))?.workspaceId).toBe(12345);
  });
  it('returns null on malformed JSON', () => {
    expect(parseVivExtData('{bad')).toBeNull();
  });
});

describe('discoverWorkspaces', () => {
  it('dedupes workspaceIds across tabs and ignores tabs without one', () => {
    const tabs = [
      { id: 1, vivExtData: JSON.stringify({ workspaceId: 100 }) },
      { id: 2, vivExtData: JSON.stringify({ workspaceId: 100 }) },
      { id: 3, vivExtData: JSON.stringify({ workspaceId: 200 }) },
      { id: 4, vivExtData: undefined },
      { id: 5, vivExtData: JSON.stringify({ pinned: true }) },
    ] as unknown as chrome.tabs.Tab[];
    expect(discoverWorkspaces(tabs).sort()).toEqual([100, 200]);
  });
});
