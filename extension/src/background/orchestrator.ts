import type { Workspace, Example } from '@symphony/shared';
import { applyHardRules, extractDomain } from '../classifier/hard-rules.js';
import { classifyTabs, type ClassifierRow, type LLM } from '../classifier/classify.js';
import { SidecarClient, SidecarUnreachable } from '../lib/sidecar/client.js';
import { RulesCache } from '../lib/sidecar/rules-cache.js';
import type { Rule } from '@symphony/shared';

export interface PlanRow {
  tabId: number;
  action: 'move' | 'close' | 'keep';
  workspaceId: string | null;
  confidence: number;
  reason: string;
  source: 'rule' | 'model';
}

export interface Plan {
  rows: PlanRow[];
  workspaces: Workspace[];
  learningPaused: boolean;
}

export interface OrchestratorDeps {
  getTabs(): Promise<chrome.tabs.Tab[]>;
  sidecar: SidecarClient;
  rulesCache: RulesCache;
  llm: LLM;
}

export async function buildPlan(deps: OrchestratorDeps): Promise<Plan> {
  const tabs = await deps.getTabs();

  let rules: Rule[] = [];
  let workspaces: Workspace[] = [];
  let learningPaused = false;
  let examples: Example[] = [];

  try {
    [rules, workspaces] = await Promise.all([
      deps.sidecar.listRules(),
      deps.sidecar.listWorkspaces(),
    ]);
    await deps.rulesCache.write(rules);
  } catch (e) {
    if (!(e instanceof SidecarUnreachable)) throw e;
    rules = await deps.rulesCache.read();
    workspaces = []; // no fresh list; UI will warn
    learningPaused = true;
  }

  const { assigned, remaining } = applyHardRules(tabs, rules);

  // Fetch hybrid few-shot examples for remaining domains (skipped when paused)
  if (!learningPaused) {
    const remainingDomains = [
      ...new Set(
        remaining
          .map(t => extractDomain(t.url))
          .filter((d): d is string => Boolean(d))
      ),
    ].slice(0, 10);

    try {
      examples = await deps.sidecar.listExamplesHybrid({ recent: 5, domains: remainingDomains });
    } catch (e) {
      if (!(e instanceof SidecarUnreachable)) throw e;
      learningPaused = true;
    }
  }

  const modelRows: ClassifierRow[] = remaining.length
    ? await classifyTabs(
        {
          workspaces,
          examples,
          tabs: remaining.map(t => ({ id: t.id!, title: t.title, url: t.url })),
        },
        deps.llm
      )
    : [];

  const rows: PlanRow[] = [
    ...assigned.map(a => ({
      tabId: a.tabId,
      action: 'move' as const,
      workspaceId: a.workspaceId,
      confidence: 1,
      reason: 'matched a hard rule',
      source: 'rule' as const,
    })),
    ...modelRows.map(m => ({
      tabId: m.tabId,
      action: m.action,
      workspaceId: m.workspace,
      confidence: m.confidence,
      reason: m.reason,
      source: 'model' as const,
    })),
  ];

  return { rows, workspaces, learningPaused };
}
