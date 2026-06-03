import { describe, it, expect, vi } from 'vitest';
import { classifyTabs } from './classify.js';
import type { Workspace } from '@symphony/shared';

const workspaces: Workspace[] = [{ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 }];
const tabs = [{ id: 10, title: 't', url: 'https://example.com' }];

describe('classifyTabs', () => {
  it('parses a valid model response', async () => {
    const llm = vi.fn().mockResolvedValue(JSON.stringify([
      { tabId: 10, action: 'move', workspace: 'ws-1', confidence: 0.9, reason: 'example.com → work' },
    ]));
    const out = await classifyTabs({ workspaces, examples: [], tabs }, { call: llm });
    expect(out[0]!.action).toBe('move');
  });
  it('retries once on malformed JSON, then defaults unclassified to keep', async () => {
    const llm = vi.fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce('still not json');
    const out = await classifyTabs({ workspaces, examples: [], tabs }, { call: llm });
    expect(llm).toHaveBeenCalledTimes(2);
    expect(out).toEqual([{ tabId: 10, action: 'keep', workspace: null, confidence: 0, reason: 'model output unparseable; defaulted to keep' }]);
  });
});
