import { useState, useCallback } from 'react'
import type { BookmarkNode, BookmarkDuplicateGroup, FolderSuggestion } from '@/types/domain'
import { sendMessage } from '@/background/message-handler'

export function useBookmarks() {
  const [tree, setTree] = useState<BookmarkNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTree = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await sendMessage<BookmarkNode[]>('GET_BOOKMARK_TREE')
      if (response.success && response.data) {
        setTree(response.data)
      } else {
        setError(response.error ?? 'Failed to load bookmarks')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [])

  return { tree, loading, error, loadTree }
}

export function useDuplicateBookmarks() {
  const [duplicates, setDuplicates] = useState<BookmarkDuplicateGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await sendMessage<BookmarkDuplicateGroup[]>('FIND_DUPLICATE_BOOKMARKS')
      if (response.success && response.data) {
        setDuplicates(response.data)
      } else {
        setError(response.error ?? 'Failed to find duplicates')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [])

  const removeBookmarks = useCallback(async (ids: string[]) => {
    const response = await sendMessage('REMOVE_BOOKMARKS', { ids })
    if (response.success) {
      await scan()
    }
    return response
  }, [scan])

  return { duplicates, loading, error, scan, removeBookmarks }
}

export function useFolderSuggestions() {
  const [suggestions, setSuggestions] = useState<FolderSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await sendMessage<FolderSuggestion[]>('GET_FOLDER_SUGGESTIONS')
      if (response.success && response.data) {
        setSuggestions(response.data)
      } else {
        setError(response.error ?? 'Failed to get suggestions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [])

  const renameFolder = useCallback(async (id: string, title: string) => {
    const response = await sendMessage('RENAME_BOOKMARK', { id, title })
    if (response.success) {
      setSuggestions(prev => prev.filter(s => s.folder.id !== id))
    }
    return response
  }, [])

  return { suggestions, loading, error, scan, renameFolder }
}

export function useDeadLinkChecker() {
  const [deadLinks, setDeadLinks] = useState<BookmarkNode[]>([])
  const [loading, setLoading] = useState(false)
  const [progress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async () => {
    setLoading(true)
    setError(null)
    setDeadLinks([])
    try {
      const response = await sendMessage<BookmarkNode[]>('CHECK_DEAD_LINKS')
      if (response.success && response.data) {
        setDeadLinks(response.data)
      } else {
        setError(response.error ?? 'Failed to check links')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [])

  return { deadLinks, loading, progress, error, scan }
}

export function useOrphanBookmarks() {
  const [orphans, setOrphans] = useState<BookmarkNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await sendMessage<BookmarkNode[]>('FIND_ORPHAN_BOOKMARKS')
      if (response.success && response.data) {
        setOrphans(response.data)
      } else {
        setError(response.error ?? 'Failed to find orphan bookmarks')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [])

  return { orphans, loading, error, scan }
}

export function useLargeFolders() {
  const [largeFolders, setLargeFolders] = useState<Array<{ folder: BookmarkNode; itemCount: number }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = useCallback(async (threshold?: number) => {
    setLoading(true)
    setError(null)
    try {
      const response = await sendMessage<Array<{ folder: BookmarkNode; itemCount: number }>>(
        'FIND_LARGE_FOLDERS',
        { threshold }
      )
      if (response.success && response.data) {
        setLargeFolders(response.data)
      } else {
        setError(response.error ?? 'Failed to find large folders')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
    setLoading(false)
  }, [])

  return { largeFolders, loading, error, scan }
}
