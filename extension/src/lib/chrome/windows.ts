import type { WindowInfo, TabInfo } from '@/types/domain'

export async function getAllWindows(): Promise<WindowInfo[]> {
  const windows = await chrome.windows.getAll({ populate: true })
  return windows
    .filter((w) => w.id !== undefined && w.type === 'normal')
    .map(mapWindow)
}

export async function getCurrentWindow(): Promise<WindowInfo | null> {
  const window = await chrome.windows.getCurrent({ populate: true })
  if (!window.id) return null
  return mapWindow(window)
}

export async function getWindow(windowId: number): Promise<WindowInfo | null> {
  try {
    const window = await chrome.windows.get(windowId, { populate: true })
    return mapWindow(window)
  } catch {
    return null
  }
}

export async function focusWindow(windowId: number): Promise<void> {
  await chrome.windows.update(windowId, { focused: true })
}

export async function closeWindow(windowId: number): Promise<void> {
  await chrome.windows.remove(windowId)
}

export async function createWindow(
  urls?: string[],
  options?: chrome.windows.CreateData
): Promise<WindowInfo | null> {
  const window = await chrome.windows.create({
    ...options,
    url: urls,
  })
  if (!window?.id) return null
  return mapWindow(window)
}

export async function mergeWindows(
  sourceWindowId: number,
  targetWindowId: number
): Promise<void> {
  const sourceWindow = await getWindow(sourceWindowId)
  if (!sourceWindow) return

  const tabIds = sourceWindow.tabs
    .filter((t) => !t.pinned)
    .map((t) => t.id)

  if (tabIds.length > 0) {
    await chrome.tabs.move(tabIds, { windowId: targetWindowId, index: -1 })
  }

  const remainingTabs = await chrome.tabs.query({ windowId: sourceWindowId })
  if (remainingTabs.length === 0) {
    await closeWindow(sourceWindowId)
  }
}

function mapWindow(window: chrome.windows.Window): WindowInfo {
  const tabs: TabInfo[] = (window.tabs ?? [])
    .filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } =>
      tab.id !== undefined && tab.url !== undefined
    )
    .map((tab) => ({
      id: tab.id,
      windowId: tab.windowId ?? window.id ?? -1,
      index: tab.index,
      url: tab.url,
      title: tab.title ?? tab.url,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned ?? false,
      groupId: tab.groupId ?? -1,
      active: tab.active ?? false,
      discarded: tab.discarded ?? false,
    }))

  return {
    id: window.id ?? -1,
    tabs,
    focused: window.focused ?? false,
    type: window.type ?? 'normal',
    state: window.state ?? 'normal',
  }
}
