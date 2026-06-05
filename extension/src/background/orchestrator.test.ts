import { describe, it, expect, vi } from 'vitest';
import { buildPlan } from './orchestrator.js';
import { SidecarUnreachable } from '../lib/sidecar/client.js';
import type { SidecarClient } from '../lib/sidecar/client.js';
import type { RulesCache } from '../lib/sidecar/rules-cache.js';
import type { LLM } from '../classifier/classify.js';
import type { Rule } from '@symphony/shared';

// Fixture tabs
const GITHUB_TAB: chrome.tabs.Tab = {
  id: 1,
  url: 'https://github.com/user/repo',
  title: 'My Repo',
  index: 0,
  pinned: false,
  highlighted: false,
  active: true,
  discarded: false,
  autoDiscardable: true,
  windowId: 1,
  incognito: false,
  groupId: -1,
  selected: false,
};

const HN_TAB: chrome.tabs.Tab = {
  id: 2,
  url: 'https://news.ycombinator.com/item?id=1',
  title: 'HN Post',
  index: 1,
  pinned: false,
  highlighted: false,
  active: false,
  discarded: false,
  autoDiscardable: true,
  windowId: 1,
  incognito: false,
  groupId: -1,
  selected: false,
};

const GITHUB_RULE: Rule = {
  id: 'r-1',
  domain: 'github.com',
  workspaceId: 'ws-code',
  hitCount: 0,
  createdAt: '2026-06-02T00:00:00.000Z',
};

function makeFakeSidecar(overrides?: Partial<SidecarClient>): SidecarClient {
  return {
    listRules: vi.fn().mockResolvedValue([GITHUB_RULE]),
    listWorkspaces: vi.fn().mockResolvedValue([{ id: 'ws-code', label: 'Code', vivaldiWorkspaceId: 1 }]),
    listExamplesHybrid: vi.fn().mockResolvedValue([]),
    createRule: vi.fn(),
    incrementRule: vi.fn(),
    createWorkspace: vi.fn(),
    createExample: vi.fn(),
    ...overrides,
  } as unknown as SidecarClient;
}

function makeFakeRulesCache(overrides?: Partial<RulesCache>): RulesCache {
  return {
    read: vi.fn().mockResolvedValue([]),
    write: vi.fn().mockResolvedValue(undefined),
    refreshedAt: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as RulesCache;
}

function makeFakeLlm(result: object[]): LLM {
  return {
    call: vi.fn().mockResolvedValue(JSON.stringify(result)),
  };
}

describe('buildPlan', () => {
  it('tab matching a hard rule appears in plan.rows with source "rule"', async () => {
    const modelResult = [
      { tabId: 2, action: 'keep', workspace: null, confidence: 0.5, reason: 'news' },
    ];
    const deps = {
      getTabs: vi.fn().mockResolvedValue([GITHUB_TAB, HN_TAB]),
      sidecar: makeFakeSidecar(),
      rulesCache: makeFakeRulesCache(),
      llm: makeFakeLlm(modelResult),
    };

    const plan = await buildPlan(deps);

    const ruleRow = plan.rows.find(r => r.tabId === 1);
    const modelRow = plan.rows.find(r => r.tabId === 2);

    expect(ruleRow).toBeDefined();
    expect(ruleRow?.source).toBe('rule');
    expect(ruleRow?.workspaceId).toBe('ws-code');

    expect(modelRow).toBeDefined();
    expect(modelRow?.source).toBe('model');
  });

  it('with no matching rules, all tabs are classified by llm with source "model"', async () => {
    const modelResult = [
      { tabId: 1, action: 'move', workspace: 'ws-code', confidence: 0.9, reason: 'github' },
      { tabId: 2, action: 'keep', workspace: null, confidence: 0.5, reason: 'news' },
    ];
    const sidecar = makeFakeSidecar({
      listRules: vi.fn().mockResolvedValue([]), // no rules
    });
    const deps = {
      getTabs: vi.fn().mockResolvedValue([GITHUB_TAB, HN_TAB]),
      sidecar,
      rulesCache: makeFakeRulesCache(),
      llm: makeFakeLlm(modelResult),
    };

    const plan = await buildPlan(deps);

    expect(plan.rows).toHaveLength(2);
    expect(plan.rows.every(r => r.source === 'model')).toBe(true);
  });

  it('when sidecar.listRules rejects with SidecarUnreachable and cache has rules, returns a plan with learningPaused:true and does not call listExamplesHybrid', async () => {
    const cachedRules: Rule[] = [GITHUB_RULE];
    const sidecar = makeFakeSidecar({
      listRules: vi.fn().mockRejectedValue(new SidecarUnreachable()),
      listWorkspaces: vi.fn().mockRejectedValue(new SidecarUnreachable()),
      listExamplesHybrid: vi.fn().mockResolvedValue([]),
    });
    const rulesCache = makeFakeRulesCache({
      read: vi.fn().mockResolvedValue(cachedRules),
    });
    const modelResult = [
      { tabId: 2, action: 'keep', workspace: null, confidence: 0.5, reason: 'news' },
    ];
    const deps = {
      getTabs: vi.fn().mockResolvedValue([GITHUB_TAB, HN_TAB]),
      sidecar,
      rulesCache,
      llm: makeFakeLlm(modelResult),
    };

    const plan = await buildPlan(deps);

    expect(plan.learningPaused).toBe(true);
    // github tab should still be handled by hard rule from cache
    const ruleRow = plan.rows.find(r => r.tabId === 1);
    expect(ruleRow?.source).toBe('rule');
    // listExamplesHybrid should NOT have been called
    expect(sidecar.listExamplesHybrid).not.toHaveBeenCalled();
  });
});
