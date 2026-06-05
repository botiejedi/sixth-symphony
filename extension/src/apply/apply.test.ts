import { describe, it, expect, vi } from 'vitest';
import { applyPlan } from './apply.js';
import type { ApplyRow, ApplyDeps } from './apply.js';
import type { SidecarClient } from '../lib/sidecar/client.js';
import type { Example } from '@symphony/shared';

// ---- Helpers ----------------------------------------------------------------

function makeRow(overrides: Partial<ApplyRow> & { tabId: number }): ApplyRow {
  return {
    action: 'move',
    workspaceId: 'ws-work',
    vivaldiWorkspaceId: 1,
    modelSuggestedWorkspaceId: 'ws-work',
    domain: 'example.com',
    title: 'Example',
    url: 'https://example.com',
    ...overrides,
  };
}

function makeSidecar(overrides?: Partial<{
  createExample: ReturnType<typeof vi.fn>;
  createRule: ReturnType<typeof vi.fn>;
  listExamplesHybrid: ReturnType<typeof vi.fn>;
}>): SidecarClient {
  return {
    createExample: vi.fn().mockResolvedValue({}),
    createRule: vi.fn().mockResolvedValue({}),
    listExamplesHybrid: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as SidecarClient;
}

function makeDeps(overrides?: Partial<ApplyDeps>): ApplyDeps {
  return {
    sidecar: makeSidecar(),
    setTabWorkspace: vi.fn().mockResolvedValue(undefined),
    removeTab: vi.fn().mockResolvedValue(undefined),
    learningPaused: false,
    now: () => '2026-06-03T00:00:00.000Z',
    ...overrides,
  };
}

// ---- Tests ------------------------------------------------------------------

describe('applyPlan', () => {
  describe('moves and closes', () => {
    it('calls setTabWorkspace for each move row with a vivaldiWorkspaceId and counts moved', async () => {
      const deps = makeDeps();
      const rows: ApplyRow[] = [
        makeRow({ tabId: 1, action: 'move', vivaldiWorkspaceId: 10 }),
        makeRow({ tabId: 2, action: 'move', vivaldiWorkspaceId: 20 }),
      ];
      const result = await applyPlan(rows, deps);
      expect(deps.setTabWorkspace).toHaveBeenCalledWith(1, 10);
      expect(deps.setTabWorkspace).toHaveBeenCalledWith(2, 20);
      expect(result.moved).toBe(2);
      expect(result.closed).toBe(0);
    });

    it('calls removeTab for each close row and counts closed', async () => {
      const deps = makeDeps();
      const rows: ApplyRow[] = [
        makeRow({ tabId: 3, action: 'close', workspaceId: null, vivaldiWorkspaceId: null, modelSuggestedWorkspaceId: null }),
        makeRow({ tabId: 4, action: 'close', workspaceId: null, vivaldiWorkspaceId: null, modelSuggestedWorkspaceId: null }),
      ];
      const result = await applyPlan(rows, deps);
      expect(deps.removeTab).toHaveBeenCalledWith(3);
      expect(deps.removeTab).toHaveBeenCalledWith(4);
      expect(result.closed).toBe(2);
      expect(result.moved).toBe(0);
    });

    it('skips move rows whose vivaldiWorkspaceId is null', async () => {
      const deps = makeDeps();
      const rows: ApplyRow[] = [
        makeRow({ tabId: 5, action: 'move', vivaldiWorkspaceId: null }),
      ];
      const result = await applyPlan(rows, deps);
      expect(deps.setTabWorkspace).not.toHaveBeenCalled();
      expect(result.moved).toBe(0);
    });
  });

  describe('per-tab failure isolation', () => {
    it('one setTabWorkspace rejection records in failures but other move still succeeds', async () => {
      const setTabWorkspace = vi.fn()
        .mockRejectedValueOnce(new Error('vivaldi error'))
        .mockResolvedValueOnce(undefined);
      const deps = makeDeps({ setTabWorkspace });
      const rows: ApplyRow[] = [
        makeRow({ tabId: 10, action: 'move', vivaldiWorkspaceId: 1 }),
        makeRow({ tabId: 11, action: 'move', vivaldiWorkspaceId: 2 }),
      ];
      const result = await applyPlan(rows, deps);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.tabId).toBe(10);
      expect(result.failures[0]?.error).toContain('vivaldi error');
      expect(result.moved).toBe(1);
    });

    it('one removeTab rejection records in failures but other close still succeeds', async () => {
      const removeTab = vi.fn()
        .mockRejectedValueOnce(new Error('remove error'))
        .mockResolvedValueOnce(undefined);
      const deps = makeDeps({ removeTab });
      const rows: ApplyRow[] = [
        makeRow({ tabId: 20, action: 'close', workspaceId: null, vivaldiWorkspaceId: null, modelSuggestedWorkspaceId: null }),
        makeRow({ tabId: 21, action: 'close', workspaceId: null, vivaldiWorkspaceId: null, modelSuggestedWorkspaceId: null }),
      ];
      const result = await applyPlan(rows, deps);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.tabId).toBe(20);
      expect(result.closed).toBe(1);
    });
  });

  describe('learningPaused', () => {
    it('when learningPaused=true, moves and closes still happen but NO sidecar calls at all', async () => {
      const sidecar = makeSidecar();
      const deps = makeDeps({ sidecar, learningPaused: true });
      const rows: ApplyRow[] = [
        makeRow({ tabId: 30, action: 'move', vivaldiWorkspaceId: 5 }),
        makeRow({ tabId: 31, action: 'close', workspaceId: null, vivaldiWorkspaceId: null, modelSuggestedWorkspaceId: null }),
      ];
      const result = await applyPlan(rows, deps);
      expect(result.moved).toBe(1);
      expect(result.closed).toBe(1);
      expect((sidecar.createExample as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      expect((sidecar.listExamplesHybrid as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      expect((sidecar.createRule as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    });
  });

  describe('learning — corrections', () => {
    it('calls createExample for a correction (workspaceId !== modelSuggestedWorkspaceId)', async () => {
      const sidecar = makeSidecar();
      const deps = makeDeps({ sidecar });
      const rows: ApplyRow[] = [
        makeRow({
          tabId: 40,
          action: 'move',
          workspaceId: 'ws-work',
          modelSuggestedWorkspaceId: 'ws-other',  // correction!
          vivaldiWorkspaceId: 1,
          domain: 'github.com',
          title: 'GitHub',
          url: 'https://github.com/x',
        }),
      ];
      const result = await applyPlan(rows, deps);
      expect((sidecar.createExample as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      const call = (sidecar.createExample as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Example;
      expect(call.domain).toBe('github.com');
      expect(call.userChoseWorkspaceId).toBe('ws-work');
      expect(call.modelSuggestedWorkspaceId).toBe('ws-other');
      expect(call.userChoseAction).toBe('move');
      expect(result.examplesRecorded).toBe(1);
    });

    it('does NOT call createExample when workspaceId === modelSuggestedWorkspaceId (no correction)', async () => {
      const sidecar = makeSidecar();
      const deps = makeDeps({ sidecar });
      const rows: ApplyRow[] = [
        makeRow({
          tabId: 41,
          action: 'move',
          workspaceId: 'ws-work',
          modelSuggestedWorkspaceId: 'ws-work',  // same — no correction
          vivaldiWorkspaceId: 1,
        }),
      ];
      const result = await applyPlan(rows, deps);
      expect((sidecar.createExample as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      expect(result.examplesRecorded).toBe(0);
    });

    it('sidecar createExample failure is non-fatal — result still accumulates correctly', async () => {
      const sidecar = makeSidecar({
        createExample: vi.fn().mockRejectedValue(new Error('sidecar down')),
        listExamplesHybrid: vi.fn().mockResolvedValue([]),
      });
      const deps = makeDeps({ sidecar });
      const rows: ApplyRow[] = [
        makeRow({
          tabId: 42,
          action: 'move',
          workspaceId: 'ws-work',
          modelSuggestedWorkspaceId: 'ws-other',
          vivaldiWorkspaceId: 1,
        }),
      ];
      // Should not throw; examplesRecorded remains 0 since createExample threw
      const result = await applyPlan(rows, deps);
      expect(result.examplesRecorded).toBe(0);
      expect(result.moved).toBe(1);
    });
  });

  describe('rule promotion', () => {
    it('calls createRule when listExamplesHybrid returns >=3 matching move+same-workspace examples for the domain', async () => {
      const existingExamples: Partial<Example>[] = [
        { domain: 'github.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
        { domain: 'github.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
        { domain: 'github.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
      ];
      const sidecar = makeSidecar({
        listExamplesHybrid: vi.fn().mockResolvedValue(existingExamples),
        createRule: vi.fn().mockResolvedValue({}),
      });
      const deps = makeDeps({ sidecar });
      const rows: ApplyRow[] = [
        makeRow({
          tabId: 50,
          action: 'move',
          workspaceId: 'ws-work',
          modelSuggestedWorkspaceId: 'ws-other',  // correction → triggers promotion check
          vivaldiWorkspaceId: 1,
          domain: 'github.com',
        }),
      ];
      const result = await applyPlan(rows, deps);
      expect((sidecar.createRule as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      const ruleCall = (sidecar.createRule as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(ruleCall.domain).toBe('github.com');
      expect(ruleCall.workspaceId).toBe('ws-work');
      expect(result.rulesPromoted).toBe(1);
    });

    it('does NOT call createRule when listExamplesHybrid returns <3 matching examples', async () => {
      const existingExamples: Partial<Example>[] = [
        { domain: 'news.ycombinator.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
        { domain: 'news.ycombinator.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
      ];
      const sidecar = makeSidecar({
        listExamplesHybrid: vi.fn().mockResolvedValue(existingExamples),
        createRule: vi.fn().mockResolvedValue({}),
      });
      const deps = makeDeps({ sidecar });
      const rows: ApplyRow[] = [
        makeRow({
          tabId: 51,
          action: 'move',
          workspaceId: 'ws-work',
          modelSuggestedWorkspaceId: 'ws-other',  // correction
          vivaldiWorkspaceId: 1,
          domain: 'news.ycombinator.com',
        }),
      ];
      const result = await applyPlan(rows, deps);
      expect((sidecar.createRule as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      expect(result.rulesPromoted).toBe(0);
    });

    it('does NOT promote when the >=3 examples belong to OTHER domains (hybrid global-recent contamination)', async () => {
      // listExamplesHybrid mixes global-recent rows with per-domain rows, so the
      // raw result can contain plenty of move+same-workspace examples from
      // unrelated domains. Promotion must only count examples for THIS domain.
      const existingExamples: Partial<Example>[] = [
        { domain: 'unrelated-a.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
        { domain: 'unrelated-b.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
        { domain: 'unrelated-c.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
      ];
      const sidecar = makeSidecar({
        listExamplesHybrid: vi.fn().mockResolvedValue(existingExamples),
        createRule: vi.fn().mockResolvedValue({}),
      });
      const deps = makeDeps({ sidecar });
      const rows: ApplyRow[] = [
        makeRow({
          tabId: 52,
          action: 'move',
          workspaceId: 'ws-work',
          modelSuggestedWorkspaceId: 'ws-other',
          vivaldiWorkspaceId: 1,
          domain: 'github.com',
        }),
      ];
      const result = await applyPlan(rows, deps);
      expect((sidecar.createRule as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      expect(result.rulesPromoted).toBe(0);
    });

    it('deduplicates promotion: same domain+workspaceId pair only promoted once even if multiple corrections', async () => {
      const existingExamples: Partial<Example>[] = [
        { domain: 'github.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
        { domain: 'github.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
        { domain: 'github.com', userChoseAction: 'move', userChoseWorkspaceId: 'ws-work' },
      ];
      const sidecar = makeSidecar({
        listExamplesHybrid: vi.fn().mockResolvedValue(existingExamples),
        createRule: vi.fn().mockResolvedValue({}),
      });
      const deps = makeDeps({ sidecar });
      const rows: ApplyRow[] = [
        makeRow({ tabId: 60, action: 'move', workspaceId: 'ws-work', modelSuggestedWorkspaceId: 'ws-other', vivaldiWorkspaceId: 1, domain: 'github.com' }),
        makeRow({ tabId: 61, action: 'move', workspaceId: 'ws-work', modelSuggestedWorkspaceId: 'ws-other', vivaldiWorkspaceId: 1, domain: 'github.com' }),
      ];
      const result = await applyPlan(rows, deps);
      expect((sidecar.createRule as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect(result.rulesPromoted).toBe(1);
    });
  });
});
