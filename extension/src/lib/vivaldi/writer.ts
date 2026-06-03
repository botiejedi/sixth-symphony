import { parseVivExtData } from './workspaces.js';

export async function setTabWorkspace(
  tabId: number,
  workspaceId: number,
  api: typeof chrome = chrome,
): Promise<void> {
  const tab = await api.tabs.get(tabId);
  const existing = parseVivExtData((tab as unknown as { vivExtData?: string }).vivExtData) ?? {};
  const next = { ...existing, workspaceId: Math.trunc(workspaceId) };
  await api.tabs.update(tabId, { vivExtData: JSON.stringify(next) } as chrome.tabs.UpdateProperties);
}
