import { useState, useEffect, useCallback } from 'react'
import type { LLMConfig, OperationProgress, TabInfo } from '@/types/domain'
import { sendMessage } from '@/background/message-handler'

interface CategorizedTab {
  tab: TabInfo
  category: string
}

export function useLLMConfig() {
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await sendMessage<LLMConfig | undefined>('GET_LLM_CONFIG')
      if (response.success) {
        setConfig(response.data ?? null)
      } else {
        setError(response.error ?? 'Failed to get config')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const testConnection = useCallback(async () => {
    const response = await sendMessage<{ success: boolean; error?: string }>('TEST_LLM_CONNECTION')
    return response.success && response.data?.success
  }, [])

  return { config, loading, error, refresh, testConnection, isConfigured: config !== null }
}

export function useCategorizeTabs() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<OperationProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CategorizedTab[]>([])

  const categorize = useCallback(async (windowId?: number) => {
    setLoading(true)
    setProgress({ current: 0, total: 1, status: 'Starting...' })
    setError(null)
    setResults([])

    try {
      const response = await sendMessage<CategorizedTab[]>('CATEGORIZE_TABS', {
        windowId,
        // Note: progress callback won't work through message passing
        // Would need to use a different mechanism for real-time progress
      })

      if (response.success && response.data) {
        setResults(response.data)
      } else {
        setError(response.error ?? 'Failed to categorize tabs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }

    setLoading(false)
    setProgress(null)
  }, [])

  return { categorize, loading, progress, error, results }
}

export function useWindowTopic() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detectTopic = useCallback(async (windowId: number) => {
    setLoading(true)
    setError(null)

    try {
      const response = await sendMessage<{ topic: string; confidence: number } | null>(
        'DETECT_WINDOW_TOPIC',
        { windowId }
      )

      if (response.success) {
        return response.data
      } else {
        setError(response.error ?? 'Failed to detect topic')
        return null
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { detectTopic, loading, error }
}

// Smart categorization with topic/subtopic extraction
interface SmartCategorizedTab {
  tab: TabInfo
  topic: string
  subtopic: string
}

export function useSmartCategorizeTabs() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<OperationProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SmartCategorizedTab[]>([])

  const categorize = useCallback(async (windowId?: number, windowTopic?: string) => {
    setLoading(true)
    setProgress({ current: 0, total: 1, status: 'Analyzing tabs with AI...' })
    setError(null)
    setResults([])

    try {
      const response = await sendMessage<SmartCategorizedTab[]>('SMART_CATEGORIZE_TABS', {
        windowId,
        windowTopic,
      })

      if (response.success && response.data) {
        setResults(response.data)
      } else {
        setError(response.error ?? 'Failed to smart categorize tabs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }

    setLoading(false)
    setProgress(null)
  }, [])

  return { categorize, loading, progress, error, results }
}

// Smart bookmark assignment to existing folders
interface BookmarkAssignment {
  bookmarkId: string
  bookmarkTitle: string
  suggestedFolderId: string
  suggestedFolderName: string
  confidence: number
}

export function useSmartAssignBookmarks() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<BookmarkAssignment[]>([])

  const assignBookmarks = useCallback(async (
    bookmarkIds?: string[],
    existingFolders?: Array<{ id: string; name: string; sampleTitles: string[] }>
  ) => {
    setLoading(true)
    setError(null)
    setResults([])

    try {
      const response = await sendMessage<BookmarkAssignment[]>('SMART_ASSIGN_BOOKMARKS', {
        bookmarkIds,
        existingFolders: existingFolders ?? [],
      })

      if (response.success && response.data) {
        setResults(response.data)
      } else {
        setError(response.error ?? 'Failed to assign bookmarks')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }

    setLoading(false)
  }, [])

  return { assignBookmarks, loading, error, results }
}

// Analyze user's folder organization patterns
interface FolderAnalysis {
  organizationStyle: string
  suggestedCategories: string[]
  patterns: string[]
}

export function useAnalyzeUserFolders() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<FolderAnalysis | null>(null)

  const analyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const response = await sendMessage<FolderAnalysis>('ANALYZE_USER_FOLDERS')

      if (response.success && response.data) {
        setAnalysis(response.data)
      } else {
        setError(response.error ?? 'Failed to analyze folders')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }

    setLoading(false)
  }, [])

  return { analyze, loading, error, analysis }
}

// Suggest reorganization for messy folders
interface ReorganizationSuggestion {
  newFolders: Array<{ name: string; itemIds: string[] }>
  moveToExisting: Array<{ itemId: string; targetFolderId: string }>
}

export function useSuggestFolderReorganization() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<ReorganizationSuggestion | null>(null)

  const suggest = useCallback(async (folderId: string) => {
    setLoading(true)
    setError(null)
    setSuggestion(null)

    try {
      const response = await sendMessage<ReorganizationSuggestion>('SUGGEST_FOLDER_REORGANIZATION', {
        folderId,
      })

      if (response.success && response.data) {
        setSuggestion(response.data)
      } else {
        setError(response.error ?? 'Failed to get reorganization suggestions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }

    setLoading(false)
  }, [])

  return { suggest, loading, error, suggestion }
}

// Generate smart group names based on tab content
export function useSuggestSmartGroupName() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestName = useCallback(async (tabIds: number[], category: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await sendMessage<{ name: string } | null>('SUGGEST_SMART_GROUP_NAME', {
        tabIds,
        category,
      })

      if (response.success) {
        return response.data?.name ?? null
      } else {
        setError(response.error ?? 'Failed to suggest group name')
        return null
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { suggestName, loading, error }
}
