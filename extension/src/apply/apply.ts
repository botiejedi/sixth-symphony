import type { Action } from '@symphony/shared';
import type { SidecarClient } from '../lib/sidecar/client.js';

export interface ApplyRow {
  tabId: number;
  action: Action;                        // 'move' | 'close' | 'keep'
  workspaceId: string | null;            // user's FINAL sidecar workspace id (move target)
  vivaldiWorkspaceId: number | null;     // resolved numeric Vivaldi id for the move target
  modelSuggestedWorkspaceId: string | null;  // what the model/rule originally proposed
  domain: string;
  title: string;
  url: string;
}

export interface ApplyDeps {
  sidecar: SidecarClient;
  setTabWorkspace: (tabId: number, vivaldiWorkspaceId: number) => Promise<void>;
  removeTab: (tabId: number) => Promise<void>;
  learningPaused: boolean;
  now?: () => string;  // defaults to () => new Date().toISOString()
}

export interface ApplyResult {
  moved: number;
  closed: number;
  examplesRecorded: number;
  rulesPromoted: number;
  failures: { tabId: number; error: string }[];
}

async function maybePromote(
  sidecar: SidecarClient,
  domain: string,
  workspaceId: string,
  now: () => string,
): Promise<boolean> {
  const history = await sidecar.listExamplesHybrid({ recent: 100, domains: [domain] });
  const sameWs = history.filter(
    e => e.domain === domain && e.userChoseAction === 'move' && e.userChoseWorkspaceId === workspaceId,
  );
  if (sameWs.length >= 3) {
    try {
      await sidecar.createRule({
        id: `r-${domain}`,
        domain,
        workspaceId,
        hitCount: 0,
        createdAt: now(),
      });
      return true;
    } catch {
      // domain may already have a rule — swallow conflict
    }
  }
  return false;
}

export async function applyPlan(rows: ApplyRow[], deps: ApplyDeps): Promise<ApplyResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const result: ApplyResult = {
    moved: 0,
    closed: 0,
    examplesRecorded: 0,
    rulesPromoted: 0,
    failures: [],
  };

  // Step 1: moves
  for (const row of rows) {
    if (row.action === 'move' && row.vivaldiWorkspaceId !== null) {
      try {
        await deps.setTabWorkspace(row.tabId, row.vivaldiWorkspaceId);
        result.moved++;
      } catch (err) {
        result.failures.push({
          tabId: row.tabId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Step 2: closes
  for (const row of rows) {
    if (row.action === 'close') {
      try {
        await deps.removeTab(row.tabId);
        result.closed++;
      } catch (err) {
        result.failures.push({
          tabId: row.tabId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Steps 3 & 4: learning (only when not paused)
  if (!deps.learningPaused) {
    // Step 3: record corrections as examples
    for (const row of rows) {
      const isCorrection = row.workspaceId !== row.modelSuggestedWorkspaceId;
      if (isCorrection) {
        try {
          const timestamp = now().replace(/[^0-9]/g, '').slice(0, 14);
          await deps.sidecar.createExample({
            id: `e-${row.tabId}-${timestamp}`,
            domain: row.domain,
            title: row.title,
            url: row.url,
            modelSuggestedWorkspaceId: row.modelSuggestedWorkspaceId,
            userChoseWorkspaceId: row.workspaceId,
            userChoseAction: row.action,
            createdAt: now(),
          });
          result.examplesRecorded++;
        } catch {
          // sidecar failure is non-fatal for learning — continue
        }
      }
    }

    // Step 4: promote repeat-corrected domains to hard rules
    // Collect distinct (domain, workspaceId) pairs among move corrections
    const promotionCandidates = new Map<string, string>();
    for (const row of rows) {
      if (
        row.action === 'move' &&
        row.workspaceId !== null &&
        row.workspaceId !== row.modelSuggestedWorkspaceId
      ) {
        const key = `${row.domain}::${row.workspaceId}`;
        promotionCandidates.set(key, row.workspaceId);
      }
    }

    for (const [key, workspaceId] of promotionCandidates) {
      const domain = key.split('::')[0];
      if (!domain) continue;
      try {
        const promoted = await maybePromote(deps.sidecar, domain, workspaceId, now);
        if (promoted) result.rulesPromoted++;
      } catch {
        // non-fatal
      }
    }
  }

  return result;
}
