import type { LLMConfig, UserPreferences } from '@/types/domain'
import { DEFAULT_USER_PREFERENCES } from '@/types/domain'

export interface StorageSchema {
  llmConfig?: LLMConfig
  userPreferences?: UserPreferences
  windowTopics?: Record<number, string>
  lastScanResults?: {
    duplicates?: number
    timestamp?: number
  }
  settings?: {
    autoGroupTabs?: boolean
    showNotifications?: boolean
    darkMode?: 'auto' | 'light' | 'dark'
  }
}

type StorageKey = keyof StorageSchema

export async function getStorage<K extends StorageKey>(
  key: K
): Promise<StorageSchema[K] | undefined> {
  const result = await chrome.storage.local.get(key)
  return result[key] as StorageSchema[K] | undefined
}

export async function getStorageMultiple<K extends StorageKey>(
  keys: K[]
): Promise<Pick<StorageSchema, K>> {
  const result = await chrome.storage.local.get(keys)
  return result as Pick<StorageSchema, K>
}

export async function setStorage<K extends StorageKey>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

export async function setStorageMultiple(
  items: Partial<StorageSchema>
): Promise<void> {
  await chrome.storage.local.set(items)
}

export async function removeStorage(keys: StorageKey | StorageKey[]): Promise<void> {
  await chrome.storage.local.remove(keys)
}

export async function clearStorage(): Promise<void> {
  await chrome.storage.local.clear()
}

export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local') {
      callback(changes)
    }
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

// Session storage for temporary state
export async function getSessionStorage<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.session.get(key)
  return result[key] as T | undefined
}

export async function setSessionStorage<T>(key: string, value: T): Promise<void> {
  await chrome.storage.session.set({ [key]: value })
}

export async function clearSessionStorage(): Promise<void> {
  await chrome.storage.session.clear()
}

// LLM Config helpers
export async function getLLMConfig(): Promise<LLMConfig | undefined> {
  return getStorage('llmConfig')
}

export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  await setStorage('llmConfig', config)
}

// Window topics helpers
export async function getWindowTopic(windowId: number): Promise<string | undefined> {
  const topics = await getStorage('windowTopics')
  return topics?.[windowId]
}

export async function saveWindowTopic(windowId: number, topic: string): Promise<void> {
  const topics = (await getStorage('windowTopics')) ?? {}
  topics[windowId] = topic
  await setStorage('windowTopics', topics)
}

export async function removeWindowTopic(windowId: number): Promise<void> {
  const topics = (await getStorage('windowTopics')) ?? {}
  delete topics[windowId]
  await setStorage('windowTopics', topics)
}

// User preferences helpers
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    const prefs = await getStorage('userPreferences')
    if (!prefs) {
      return DEFAULT_USER_PREFERENCES
    }

    // Merge with defaults to ensure all fields are present
    return {
      sorting: { ...DEFAULT_USER_PREFERENCES.sorting, ...prefs.sorting },
      tabGroups: { ...DEFAULT_USER_PREFERENCES.tabGroups, ...prefs.tabGroups },
      merge: { ...DEFAULT_USER_PREFERENCES.merge, ...prefs.merge },
      bookmarks: { ...DEFAULT_USER_PREFERENCES.bookmarks, ...prefs.bookmarks },
    }
  } catch (error) {
    console.error('Error getting user preferences:', error)
    return DEFAULT_USER_PREFERENCES
  }
}

export async function setUserPreferences(prefs: Partial<UserPreferences>): Promise<void> {
  try {
    const currentPrefs = await getUserPreferences()
    const updatedPrefs: UserPreferences = {
      sorting: prefs.sorting ? { ...currentPrefs.sorting, ...prefs.sorting } : currentPrefs.sorting,
      tabGroups: prefs.tabGroups ? { ...currentPrefs.tabGroups, ...prefs.tabGroups } : currentPrefs.tabGroups,
      merge: prefs.merge ? { ...currentPrefs.merge, ...prefs.merge } : currentPrefs.merge,
      bookmarks: prefs.bookmarks ? { ...currentPrefs.bookmarks, ...prefs.bookmarks } : currentPrefs.bookmarks,
    }
    await setStorage('userPreferences', updatedPrefs)
  } catch (error) {
    console.error('Error setting user preferences:', error)
    throw error
  }
}

export async function resetUserPreferences(): Promise<void> {
  try {
    await setStorage('userPreferences', DEFAULT_USER_PREFERENCES)
  } catch (error) {
    console.error('Error resetting user preferences:', error)
    throw error
  }
}
