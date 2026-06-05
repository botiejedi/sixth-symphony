import type { Rule } from '@symphony/shared';

export function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export interface HardAssignment {
  tabId: number;
  workspaceId: string;
}

export interface HardRulePartition {
  assigned: HardAssignment[];
  remaining: chrome.tabs.Tab[];
}

export function applyHardRules(tabs: chrome.tabs.Tab[], rules: Rule[]): HardRulePartition {
  const byDomain = new Map(rules.map(r => [r.domain, r]));
  const assigned: HardAssignment[] = [];
  const remaining: chrome.tabs.Tab[] = [];
  for (const t of tabs) {
    const domain = extractDomain(t.url);
    const rule = domain ? byDomain.get(domain) : undefined;
    if (rule && t.id != null) assigned.push({ tabId: t.id, workspaceId: rule.workspaceId });
    else remaining.push(t);
  }
  return { assigned, remaining };
}
