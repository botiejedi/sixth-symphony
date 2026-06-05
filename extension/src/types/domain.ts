export interface TabInfo {
  id: number
  windowId: number
  index: number
  url: string
  title: string
  favIconUrl?: string
  pinned: boolean
  groupId: number
  active: boolean
  discarded: boolean
}

export interface WindowInfo {
  id: number
  tabs: TabInfo[]
  focused: boolean
  type: string
  state: string
  topic?: string
}

export interface BookmarkNode {
  id: string
  parentId?: string
  index?: number
  title: string
  url?: string
  dateAdded?: number
  children?: BookmarkNode[]
}

export interface DuplicateGroup {
  normalizedUrl: string
  tabs: TabInfo[]
}

export interface BookmarkDuplicateGroup {
  normalizedUrl: string
  bookmarks: BookmarkNode[]
}

export interface TabCategory {
  name: string
  color: chrome.tabGroups.ColorEnum
  tabs: TabInfo[]
}

export interface WindowMergeSuggestion {
  source: WindowInfo
  target: WindowInfo
  overlap: number
  reason: string
}

export interface FolderSuggestion {
  folder: BookmarkNode
  suggestedName: string
  confidence: number
}

export type OperationProgress = {
  current: number
  total: number
  status: string
}

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'custom'

export interface LLMConfig {
  provider: LLMProvider
  apiKey?: string
  baseUrl: string
  model: string
  maxContextTokens: number
  temperature: number
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface CategoryResult {
  index: number
  category: string
}

export interface TopicResult {
  topic: string
  confidence: number
}

export interface FolderNameResult {
  name: string
}

// ===== Sorting Options =====

export type SortBy = 'domain' | 'title' | 'dateOpened'
export type SortDirection = 'asc' | 'desc'
export type SortScope = 'current' | 'all'

export interface SortOptions {
  scope: SortScope
  sortBy: SortBy
  sortDirection: SortDirection
  groupSubdomains: boolean
}

export const DEFAULT_SORT_OPTIONS: SortOptions = {
  scope: 'current',
  sortBy: 'domain',
  sortDirection: 'asc',
  groupSubdomains: false,
}

// ===== Tab Group Options =====

export interface TabGroupOptions {
  minTabsForGroup: number
  useAISubtopics: boolean
  collapseGroupsOnCreate: boolean
}

export const DEFAULT_TAB_GROUP_OPTIONS: TabGroupOptions = {
  minTabsForGroup: 2,
  useAISubtopics: false,
  collapseGroupsOnCreate: false,
}

// ===== Window Merge Options =====

export interface MergeOptions {
  overlapThreshold: number
}

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  overlapThreshold: 0.5,
}

// ===== Bookmark Options =====

export interface BookmarkOptions {
  largeFolderThreshold: number
  genericFolderPatterns: string[]
}

export const DEFAULT_BOOKMARK_OPTIONS: BookmarkOptions = {
  largeFolderThreshold: 100,
  genericFolderPatterns: ['New Folder', 'Untitled', 'New folder', 'Folder'],
}

// ===== User Preferences =====

export interface UserPreferences {
  sorting: SortOptions
  tabGroups: TabGroupOptions
  merge: MergeOptions
  bookmarks: BookmarkOptions
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  sorting: DEFAULT_SORT_OPTIONS,
  tabGroups: DEFAULT_TAB_GROUP_OPTIONS,
  merge: DEFAULT_MERGE_OPTIONS,
  bookmarks: DEFAULT_BOOKMARK_OPTIONS,
}
