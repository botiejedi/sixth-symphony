// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { buildPlan } from './orchestrator.js';
import { applyPlan } from '../apply/apply.js';
import type { ApplyRow } from '../apply/apply.js';
import { SidecarClient } from '../lib/sidecar/client.js';
import type { RulesCache } from '../lib/sidecar/rules-cache.js';
import type { LLM } from '../classifier/classify.js';
import type { Rule } from '@symphony/shared';

// ---- MSW server setup -------------------------------------------------------
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---- Shared fixtures --------------------------------------------------------
const FIXTURE_TABS = [
  { id: 1, url: 'https://example.com', title: 'A' },
  { id: 2, url: 'https://news.ycombinator.com', title: 'B' },
] as unknown as chrome.tabs.Tab[];

const BASE_URL = 'http://127.0.0.1:8765';
const realSidecar = new SidecarClient(BASE_URL);

function makeFakeRulesCache(overrides?: Partial<RulesCache>): RulesCache {
  return {
    read: vi.fn(async () => []),
    write: vi.fn(async () => {}),
    refreshedAt: vi.fn(async () => null),
    ...overrides,
  } as unknown as RulesCache;
}

// ---- Tests ------------------------------------------------------------------

describe('safety-net integration: orchestrator + apply', () => {
  it('Model down ⇒ safe all-keep plan, zero destructive writes', async () => {
    // msw: sidecar endpoints respond OK
    server.use(
      http.get(`${BASE_URL}/v1/rules`, () => HttpResponse.json([])),
      http.get(`${BASE_URL}/v1/workspaces`, () => HttpResponse.json([])),
      http.get(`${BASE_URL}/v1/examples`, () => HttpResponse.json([])),
    );

    // llm throws every time (model offline)
    const llm: LLM = {
      call: vi.fn(async () => { throw new Error('model offline'); }),
    };

    const plan = await buildPlan({
      getTabs: async () => FIXTURE_TABS,
      sidecar: realSidecar,
      rulesCache: makeFakeRulesCache(),
      llm,
    });

    // Every row must be 'keep' — no destructive moves or closes
    expect(plan.rows.length).toBeGreaterThan(0);
    for (const row of plan.rows) {
      expect(row.action).toBe('keep');
    }

    // Map PlanRows → ApplyRows (all keep → no moves to apply, but let's feed them anyway)
    const applyRows: ApplyRow[] = plan.rows.map(r => ({
      tabId: r.tabId,
      action: r.action,
      workspaceId: r.workspaceId,
      vivaldiWorkspaceId: null,          // keeps never have a vivaldi id
      modelSuggestedWorkspaceId: r.workspaceId,
      domain: 'example.com',
      title: 'A',
      url: 'https://example.com',
    }));

    const setTabWorkspace = vi.fn(async () => {});
    const removeTab = vi.fn(async () => {});

    const result = await applyPlan(applyRows, {
      sidecar: realSidecar,
      setTabWorkspace,
      removeTab,
      learningPaused: false,
    });

    expect(setTabWorkspace).not.toHaveBeenCalled();
    expect(removeTab).not.toHaveBeenCalled();
    expect(result.moved).toBe(0);
    expect(result.closed).toBe(0);
  });

  it('Sidecar down on plan-build ⇒ cached rules + learningPaused, and apply records nothing', async () => {
    // msw: sidecar network endpoints return errors (simulates unreachable sidecar)
    server.use(
      http.get(`${BASE_URL}/v1/rules`, () => HttpResponse.error()),
      http.get(`${BASE_URL}/v1/workspaces`, () => HttpResponse.error()),
      http.get(`${BASE_URL}/v1/examples`, () => HttpResponse.error()),
    );

    const cachedRule: Rule = {
      id: 'r-cached',
      domain: 'example.com',
      workspaceId: 'ws-cached',
      hitCount: 0,
      createdAt: '2026-06-01T00:00:00.000Z',
    };

    const rulesCache = makeFakeRulesCache({
      read: vi.fn(async () => [cachedRule]),
    });

    // llm provides a trivial valid response for any remaining tabs
    const llm: LLM = {
      call: vi.fn(async () =>
        JSON.stringify([
          { tabId: 2, action: 'keep', workspace: null, confidence: 0.5, reason: 'news' },
        ])
      ),
    };

    const plan = await buildPlan({
      getTabs: async () => FIXTURE_TABS,
      sidecar: realSidecar,
      rulesCache,
      llm,
    });

    // plan must come back with learningPaused:true and a rows array
    expect(plan.learningPaused).toBe(true);
    expect(Array.isArray(plan.rows)).toBe(true);

    // Now call applyPlan with a fake sidecar to assert no calls when learningPaused:true
    const fakeSidecarForApply = {
      createExample: vi.fn(async () => ({})),
      listExamplesHybrid: vi.fn(async () => []),
      createRule: vi.fn(async () => ({})),
      listRules: vi.fn(async () => []),
      listWorkspaces: vi.fn(async () => []),
      createWorkspace: vi.fn(async () => ({})),
      incrementRule: vi.fn(async () => ({})),
    } as unknown as SidecarClient;

    // Build an ApplyRow that would be a correction (to ensure step 3+4 would run if not paused)
    const correctionRow: ApplyRow = {
      tabId: 1,
      action: 'move',
      workspaceId: 'ws-user-choice',
      vivaldiWorkspaceId: 5,
      modelSuggestedWorkspaceId: 'ws-model-suggestion',  // different → correction
      domain: 'example.com',
      title: 'Example',
      url: 'https://example.com',
    };

    await applyPlan([correctionRow], {
      sidecar: fakeSidecarForApply,
      setTabWorkspace: vi.fn(async () => {}),
      removeTab: vi.fn(async () => {}),
      learningPaused: true,  // paused because sidecar was down
    });

    // No sidecar learning calls must have been made
    expect(fakeSidecarForApply.createExample).not.toHaveBeenCalled();
    expect(fakeSidecarForApply.listExamplesHybrid).not.toHaveBeenCalled();
    expect(fakeSidecarForApply.createRule).not.toHaveBeenCalled();
  });

  it('One tab workspace write fails ⇒ others still move, failure recorded', async () => {
    // Two move rows with valid vivaldiWorkspaceIds
    const rows: ApplyRow[] = [
      {
        tabId: 10,
        action: 'move',
        workspaceId: 'ws-work',
        vivaldiWorkspaceId: 1,
        modelSuggestedWorkspaceId: 'ws-work',
        domain: 'example.com',
        title: 'Tab A',
        url: 'https://example.com',
      },
      {
        tabId: 20,
        action: 'move',
        workspaceId: 'ws-work',
        vivaldiWorkspaceId: 2,
        modelSuggestedWorkspaceId: 'ws-work',
        domain: 'news.ycombinator.com',
        title: 'Tab B',
        url: 'https://news.ycombinator.com',
      },
    ];

    // setTabWorkspace rejects for the first tabId (10), resolves for the second (20)
    const setTabWorkspace = vi.fn()
      .mockRejectedValueOnce(new Error('vivaldi write failed for tab 10'))
      .mockResolvedValueOnce(undefined);
    const removeTab = vi.fn(async () => {});

    const fakeSidecar = {
      createExample: vi.fn(async () => ({})),
      listExamplesHybrid: vi.fn(async () => []),
      createRule: vi.fn(async () => ({})),
      listRules: vi.fn(async () => []),
      listWorkspaces: vi.fn(async () => []),
      createWorkspace: vi.fn(async () => ({})),
      incrementRule: vi.fn(async () => ({})),
    } as unknown as SidecarClient;

    const result = await applyPlan(rows, {
      sidecar: fakeSidecar,
      setTabWorkspace,
      removeTab,
      learningPaused: true,  // keep it simple, no sidecar writes
    });

    // First tab failed, second succeeded
    expect(result.moved).toBe(1);
    expect(result.failures.length).toBeGreaterThanOrEqual(1);
    expect(result.failures.some(f => f.tabId === 10)).toBe(true);

    // Second tab's setTabWorkspace was still called despite the first failure
    expect(setTabWorkspace).toHaveBeenCalledWith(20, 2);
  });
});
