export interface VivExtData {
  workspaceId?: number;
  [k: string]: unknown;
}

export function parseVivExtData(raw: string | undefined): VivExtData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as VivExtData;
    return null;
  } catch {
    return null;
  }
}

export function discoverWorkspaces(tabs: chrome.tabs.Tab[]): number[] {
  const seen = new Set<number>();
  for (const t of tabs) {
    const v = parseVivExtData((t as unknown as { vivExtData?: string }).vivExtData);
    if (v?.workspaceId != null) seen.add(Math.trunc(v.workspaceId));
  }
  return [...seen];
}
