export interface TabGroupInfo {
  id: number
  windowId: number
  title?: string
  color: chrome.tabGroups.ColorEnum
  collapsed: boolean
}

export const TAB_GROUP_COLORS: chrome.tabGroups.ColorEnum[] = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]

export const CATEGORY_COLORS: Record<string, chrome.tabGroups.ColorEnum> = {
  Technology: 'blue',
  Shopping: 'orange',
  News: 'red',
  Entertainment: 'pink',
  Social: 'purple',
  Finance: 'green',
  Reference: 'cyan',
  Productivity: 'yellow',
  Other: 'grey',
}

export async function getAllTabGroups(): Promise<TabGroupInfo[]> {
  const groups = await chrome.tabGroups.query({})
  return groups.map(mapTabGroup)
}

export async function getTabGroupsInWindow(windowId: number): Promise<TabGroupInfo[]> {
  const groups = await chrome.tabGroups.query({ windowId })
  return groups.map(mapTabGroup)
}

export async function getTabGroup(groupId: number): Promise<TabGroupInfo | null> {
  try {
    const group = await chrome.tabGroups.get(groupId)
    return mapTabGroup(group)
  } catch {
    return null
  }
}

export async function updateTabGroup(
  groupId: number,
  options: { title?: string; color?: chrome.tabGroups.ColorEnum; collapsed?: boolean }
): Promise<TabGroupInfo> {
  const group = await chrome.tabGroups.update(groupId, options)
  return mapTabGroup(group)
}

export async function collapseTabGroup(groupId: number): Promise<void> {
  await chrome.tabGroups.update(groupId, { collapsed: true })
}

export async function expandTabGroup(groupId: number): Promise<void> {
  await chrome.tabGroups.update(groupId, { collapsed: false })
}

export function getCategoryColor(category: string): chrome.tabGroups.ColorEnum {
  return CATEGORY_COLORS[category] ?? 'grey'
}

export function getNextColor(usedColors: chrome.tabGroups.ColorEnum[]): chrome.tabGroups.ColorEnum {
  for (const color of TAB_GROUP_COLORS) {
    if (!usedColors.includes(color)) {
      return color
    }
  }
  return 'grey'
}

function mapTabGroup(group: chrome.tabGroups.TabGroup): TabGroupInfo {
  return {
    id: group.id,
    windowId: group.windowId,
    title: group.title,
    color: group.color,
    collapsed: group.collapsed,
  }
}
