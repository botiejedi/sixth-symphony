import type { TabInfo, DuplicateGroup, BookmarkNode, BookmarkDuplicateGroup } from '@/types/domain'
import { normalizeUrl, getDomain, isInternalUrl } from './url-normalizer'

/**
 * Find duplicate tabs based on normalized URLs
 */
export function findDuplicateTabs(tabs: TabInfo[]): DuplicateGroup[] {
  const groups = new Map<string, TabInfo[]>()

  for (const tab of tabs) {
    if (isInternalUrl(tab.url)) continue

    const normalized = normalizeUrl(tab.url)
    const existing = groups.get(normalized)
    if (existing) {
      existing.push(tab)
    } else {
      groups.set(normalized, [tab])
    }
  }

  return Array.from(groups.entries())
    .filter(([, tabs]) => tabs.length > 1)
    .map(([normalizedUrl, tabs]) => ({
      normalizedUrl,
      tabs: tabs.sort((a, b) => a.id - b.id),
    }))
}

/**
 * Find near-duplicate tabs (same domain, similar path)
 */
export function findNearDuplicateTabs(
  tabs: TabInfo[],
  similarityThreshold = 0.8
): DuplicateGroup[] {
  const domainGroups = new Map<string, TabInfo[]>()

  // Group by domain first
  for (const tab of tabs) {
    if (isInternalUrl(tab.url)) continue

    const domain = getDomain(tab.url)
    const existing = domainGroups.get(domain)
    if (existing) {
      existing.push(tab)
    } else {
      domainGroups.set(domain, [tab])
    }
  }

  const nearDuplicates: DuplicateGroup[] = []

  // Within each domain, find similar paths
  for (const [, domainTabs] of domainGroups) {
    if (domainTabs.length < 2) continue

    const clusters: TabInfo[][] = []

    for (const tab of domainTabs) {
      let addedToCluster = false

      for (const cluster of clusters) {
        const representative = cluster[0]
        if (representative && areSimilarUrls(tab.url, representative.url, similarityThreshold)) {
          cluster.push(tab)
          addedToCluster = true
          break
        }
      }

      if (!addedToCluster) {
        clusters.push([tab])
      }
    }

    for (const cluster of clusters) {
      if (cluster.length > 1) {
        nearDuplicates.push({
          normalizedUrl: normalizeUrl(cluster[0]?.url ?? ''),
          tabs: cluster,
        })
      }
    }
  }

  return nearDuplicates
}

/**
 * Find duplicate bookmarks
 */
export function findDuplicateBookmarks(bookmarks: BookmarkNode[]): BookmarkDuplicateGroup[] {
  const groups = new Map<string, BookmarkNode[]>()

  for (const bookmark of bookmarks) {
    if (!bookmark.url) continue

    const normalized = normalizeUrl(bookmark.url)
    const existing = groups.get(normalized)
    if (existing) {
      existing.push(bookmark)
    } else {
      groups.set(normalized, [bookmark])
    }
  }

  return Array.from(groups.entries())
    .filter(([, bookmarks]) => bookmarks.length > 1)
    .map(([normalizedUrl, bookmarks]) => ({
      normalizedUrl,
      bookmarks: bookmarks.sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0)),
    }))
}

/**
 * Group tabs by domain
 */
export function groupTabsByDomain(tabs: TabInfo[]): Map<string, TabInfo[]> {
  const groups = new Map<string, TabInfo[]>()

  for (const tab of tabs) {
    if (isInternalUrl(tab.url)) continue

    const domain = getDomain(tab.url)
    const existing = groups.get(domain)
    if (existing) {
      existing.push(tab)
    } else {
      groups.set(domain, [tab])
    }
  }

  return groups
}

/**
 * Group bookmarks by domain
 */
export function groupBookmarksByDomain(bookmarks: BookmarkNode[]): Map<string, BookmarkNode[]> {
  const groups = new Map<string, BookmarkNode[]>()

  for (const bookmark of bookmarks) {
    if (!bookmark.url) continue

    const domain = getDomain(bookmark.url)
    const existing = groups.get(domain)
    if (existing) {
      existing.push(bookmark)
    } else {
      groups.set(domain, [bookmark])
    }
  }

  return groups
}

/**
 * Check if two URLs are similar
 */
function areSimilarUrls(url1: string, url2: string, threshold: number): boolean {
  try {
    const parsed1 = new URL(url1)
    const parsed2 = new URL(url2)

    // Must be same domain
    if (parsed1.hostname !== parsed2.hostname) return false

    // Compare paths
    const path1 = parsed1.pathname.split('/').filter(Boolean)
    const path2 = parsed2.pathname.split('/').filter(Boolean)

    // If paths are very different lengths, not similar
    if (Math.abs(path1.length - path2.length) > 1) return false

    // Calculate path similarity
    const maxLen = Math.max(path1.length, path2.length)
    if (maxLen === 0) return true

    let matches = 0
    for (let i = 0; i < maxLen; i++) {
      if (path1[i] === path2[i]) matches++
    }

    return matches / maxLen >= threshold
  } catch {
    return false
  }
}

/**
 * Get tabs that should be kept (oldest/first) and removed from duplicate groups
 */
export function getDuplicateTabsToRemove(groups: DuplicateGroup[]): number[] {
  const toRemove: number[] = []

  for (const group of groups) {
    // Keep the first tab (oldest), remove the rest
    for (let i = 1; i < group.tabs.length; i++) {
      const tab = group.tabs[i]
      if (tab && !tab.pinned) {
        toRemove.push(tab.id)
      }
    }
  }

  return toRemove
}

/**
 * Get bookmarks to remove from duplicate groups
 */
export function getDuplicateBookmarksToRemove(groups: BookmarkDuplicateGroup[]): string[] {
  const toRemove: string[] = []

  for (const group of groups) {
    // Keep the first bookmark (oldest), remove the rest
    for (let i = 1; i < group.bookmarks.length; i++) {
      const bookmark = group.bookmarks[i]
      if (bookmark) {
        toRemove.push(bookmark.id)
      }
    }
  }

  return toRemove
}
