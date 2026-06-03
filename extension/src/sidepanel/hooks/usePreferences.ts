import { useState, useEffect, useCallback } from 'react'
import type { UserPreferences, SortOptions, TabGroupOptions, MergeOptions, BookmarkOptions } from '@/types/domain'
import { DEFAULT_USER_PREFERENCES } from '@/types/domain'
import { getUserPreferences, setUserPreferences, resetUserPreferences, onStorageChange } from '@/lib/chrome/storage'

export function usePreferences() {
  const [preferences, setPreferencesState] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await getUserPreferences()
        setPreferencesState(prefs)
      } catch (error) {
        console.error('Failed to load preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()

    // Listen for storage changes
    const unsubscribe = onStorageChange((changes) => {
      if (changes.userPreferences) {
        const newPrefs = changes.userPreferences.newValue as UserPreferences | undefined
        if (newPrefs) {
          setPreferencesState(newPrefs)
        }
      }
    })

    return unsubscribe
  }, [])

  // Update sorting preferences
  const updateSorting = useCallback(async (sorting: Partial<SortOptions>) => {
    setSaving(true)
    try {
      const newSorting = { ...preferences.sorting, ...sorting }
      await setUserPreferences({ sorting: newSorting })
      setPreferencesState((prev) => ({
        ...prev,
        sorting: newSorting,
      }))
    } finally {
      setSaving(false)
    }
  }, [preferences.sorting])

  // Update tab group preferences
  const updateTabGroups = useCallback(async (tabGroups: Partial<TabGroupOptions>) => {
    setSaving(true)
    try {
      const newTabGroups = { ...preferences.tabGroups, ...tabGroups }
      await setUserPreferences({ tabGroups: newTabGroups })
      setPreferencesState((prev) => ({
        ...prev,
        tabGroups: newTabGroups,
      }))
    } finally {
      setSaving(false)
    }
  }, [preferences.tabGroups])

  // Update merge preferences
  const updateMerge = useCallback(async (merge: Partial<MergeOptions>) => {
    setSaving(true)
    try {
      const newMerge = { ...preferences.merge, ...merge }
      await setUserPreferences({ merge: newMerge })
      setPreferencesState((prev) => ({
        ...prev,
        merge: newMerge,
      }))
    } finally {
      setSaving(false)
    }
  }, [preferences.merge])

  // Update bookmark preferences
  const updateBookmarks = useCallback(async (bookmarks: Partial<BookmarkOptions>) => {
    setSaving(true)
    try {
      const newBookmarks = { ...preferences.bookmarks, ...bookmarks }
      await setUserPreferences({ bookmarks: newBookmarks })
      setPreferencesState((prev) => ({
        ...prev,
        bookmarks: newBookmarks,
      }))
    } finally {
      setSaving(false)
    }
  }, [preferences.bookmarks])

  // Reset all preferences to defaults
  const reset = useCallback(async () => {
    setSaving(true)
    try {
      await resetUserPreferences()
      setPreferencesState(DEFAULT_USER_PREFERENCES)
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    preferences,
    loading,
    saving,
    updateSorting,
    updateTabGroups,
    updateMerge,
    updateBookmarks,
    reset,
  }
}
