import type { TabInfo, SortOptions } from '@/types/domain'
import { DEFAULT_SORT_OPTIONS } from '@/types/domain'

export async function getAllTabs(): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query({})
  return tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } =>
      tab.id !== undefined && tab.url !== undefined
    )
    .map(mapTab)
}

export async function getTabsInWindow(windowId: number): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query({ windowId })
  return tabs
    .filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } =>
      tab.id !== undefined && tab.url !== undefined
    )
    .map(mapTab)
}

export async function getActiveTab(): Promise<TabInfo | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) return null
  return mapTab(tab as chrome.tabs.Tab & { id: number; url: string })
}

export async function closeTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return
  await chrome.tabs.remove(tabIds)
}

export async function moveTabs(
  tabIds: number[],
  windowId: number,
  index = -1
): Promise<void> {
  if (tabIds.length === 0) return
  await chrome.tabs.move(tabIds, { windowId, index })
}

export async function moveTabsToIndex(
  tabIds: number[],
  index: number
): Promise<void> {
  if (tabIds.length === 0) return
  for (let i = 0; i < tabIds.length; i++) {
    const tabId = tabIds[i]
    if (tabId !== undefined) {
      await chrome.tabs.move(tabId, { index: index + i })
    }
  }
}

/**
 * Sort tabs in a single window with configurable options
 */
export async function sortTabs(
  windowId: number,
  options: Partial<SortOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_SORT_OPTIONS, ...options }
  const tabs = await getTabsInWindow(windowId)
  const pinnedTabs = tabs.filter((t) => t.pinned)
  const unpinnedTabs = tabs.filter((t) => !t.pinned)

  unpinnedTabs.sort((a, b) => {
    let comparison = 0

    switch (opts.sortBy) {
      case 'domain':
        const domainA = opts.groupSubdomains ? getBaseDomain(a.url) : getDomain(a.url)
        const domainB = opts.groupSubdomains ? getBaseDomain(b.url) : getDomain(b.url)
        comparison = domainA.localeCompare(domainB)
        // Secondary sort by full domain when grouping subdomains
        if (comparison === 0 && opts.groupSubdomains) {
          comparison = getDomain(a.url).localeCompare(getDomain(b.url))
        }
        break

      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '')
        break

      case 'dateOpened':
        // Note: Chrome doesn't expose tab creation time directly
        // We use index as a proxy (lower index = opened earlier)
        comparison = a.index - b.index
        break
    }

    return opts.sortDirection === 'desc' ? -comparison : comparison
  })

  const startIndex = pinnedTabs.length
  for (let i = 0; i < unpinnedTabs.length; i++) {
    const tab = unpinnedTabs[i]
    if (tab) {
      await chrome.tabs.move(tab.id, { index: startIndex + i })
    }
  }
}

/**
 * Sort tabs in all windows
 */
export async function sortAllTabs(options: Partial<SortOptions> = {}): Promise<void> {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] })
  for (const window of windows) {
    if (window.id !== undefined) {
      await sortTabs(window.id, options)
    }
  }
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use sortTabs() instead
 */
export async function sortTabsByDomain(windowId: number): Promise<void> {
  await sortTabs(windowId, { sortBy: 'domain', sortDirection: 'asc' })
}

// Check if tab groups are supported (Chrome only, not Firefox)
const supportsTabGroups = typeof chrome !== 'undefined' && 'tabGroups' in chrome

export async function groupTabs(
  tabIds: number[],
  options: { title?: string; color?: chrome.tabGroups.ColorEnum; windowId?: number }
): Promise<number> {
  if (tabIds.length === 0) return -1

  // Firefox doesn't support tab groups
  if (!supportsTabGroups) {
    console.warn('Tab groups not supported in this browser')
    return -1
  }

  const groupId = await chrome.tabs.group({
    tabIds,
    createProperties: options.windowId ? { windowId: options.windowId } : undefined,
  })

  if (options.title || options.color) {
    await chrome.tabGroups.update(groupId, {
      title: options.title,
      color: options.color,
    })
  }

  return groupId
}

export async function ungroupTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return
  // Firefox doesn't support tab groups
  if (!supportsTabGroups) return
  await chrome.tabs.ungroup(tabIds)
}

function mapTab(tab: chrome.tabs.Tab & { id: number; url: string }): TabInfo {
  return {
    id: tab.id,
    windowId: tab.windowId ?? -1,
    index: tab.index,
    url: tab.url,
    title: tab.title ?? tab.url,
    favIconUrl: tab.favIconUrl,
    pinned: tab.pinned ?? false,
    groupId: tab.groupId ?? -1,
    active: tab.active ?? false,
    discarded: tab.discarded ?? false,
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Get the base domain (parent domain) for subdomain grouping
 * e.g., docs.github.com -> github.com
 */
function getBaseDomain(url: string): string {
  const domain = getDomain(url)
  const parts = domain.split('.')

  // Handle common TLDs (co.uk, com.au, etc.)
  const commonMultiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in']
  const lastTwo = parts.slice(-2).join('.')

  if (commonMultiPartTLDs.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join('.')
  }

  // Standard domain: take last 2 parts
  if (parts.length > 2) {
    return parts.slice(-2).join('.')
  }

  return domain
}
