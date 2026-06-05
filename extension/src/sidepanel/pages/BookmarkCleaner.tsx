import { useState } from 'react'
import type { BookmarkDuplicateGroup, FolderSuggestion, BookmarkNode } from '@/types/domain'
import { useDuplicateBookmarks, useFolderSuggestions, useDeadLinkChecker, useOrphanBookmarks, useLargeFolders, useLLMConfig } from '../hooks'
import { ConfirmDialog, SliderInput } from '../components'

interface BookmarkCleanerProps {
  onBack: () => void
}

type Tab = 'duplicates' | 'folders' | 'deadlinks' | 'orphans' | 'large'

export function BookmarkCleaner({ onBack }: BookmarkCleanerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('duplicates')
  const { isConfigured } = useLLMConfig()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <BackIcon />
        </button>
        <h2 className="text-lg font-medium">Clean Bookmarks</h2>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <TabButton
          active={activeTab === 'duplicates'}
          onClick={() => setActiveTab('duplicates')}
        >
          Duplicates
        </TabButton>
        <TabButton
          active={activeTab === 'folders'}
          onClick={() => setActiveTab('folders')}
          disabled={!isConfigured}
        >
          Folders
        </TabButton>
        <TabButton
          active={activeTab === 'deadlinks'}
          onClick={() => setActiveTab('deadlinks')}
        >
          Dead Links
        </TabButton>
        <TabButton
          active={activeTab === 'orphans'}
          onClick={() => setActiveTab('orphans')}
        >
          Orphans
        </TabButton>
        <TabButton
          active={activeTab === 'large'}
          onClick={() => setActiveTab('large')}
        >
          Large Folders
        </TabButton>
      </div>

      {activeTab === 'duplicates' && <DuplicateBookmarks />}
      {activeTab === 'folders' && <FolderRename />}
      {activeTab === 'deadlinks' && <DeadLinks />}
      {activeTab === 'orphans' && <OrphanBookmarks />}
      {activeTab === 'large' && <LargeFolders />}
    </div>
  )
}

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 text-sm font-medium border-b-2 transition-colors
        ${active
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  )
}

function DuplicateBookmarks() {
  const { duplicates, loading, error, scan, removeBookmarks } = useDuplicateBookmarks()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [removing, setRemoving] = useState(false)

  const totalDuplicates = duplicates.reduce(
    (acc, group) => acc + group.bookmarks.length - 1,
    0
  )

  const handleSelectAllDuplicates = () => {
    const ids = duplicates.flatMap(g => g.bookmarks.slice(1).map(b => b.id))
    setSelectedIds(new Set(ids))
  }

  const handleRemove = async () => {
    setRemoving(true)
    await removeBookmarks(Array.from(selectedIds))
    setSelectedIds(new Set())
    setRemoving(false)
    setShowConfirm(false)
  }

  if (!duplicates.length && !loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Scan your bookmarks for duplicates</p>
        <button
          onClick={scan}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Scan for Duplicates'}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Scanning bookmarks...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Found {totalDuplicates} duplicate{totalDuplicates !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <button onClick={scan} className="text-sm text-primary-600 hover:text-primary-700">
            Rescan
          </button>
          <button onClick={handleSelectAllDuplicates} className="text-sm text-primary-600 hover:text-primary-700">
            Select All
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {duplicates.map((group, idx) => (
          <DuplicateGroupCard
            key={idx}
            group={group}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 -mx-4">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={removing}
            className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Remove {selectedIds.size} Bookmark{selectedIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Remove Duplicate Bookmarks"
        message={`Remove ${selectedIds.size} duplicate bookmark${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

function DuplicateGroupCard({
  group,
  selectedIds,
  onSelectionChange,
}: {
  group: BookmarkDuplicateGroup
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
}) {
  const keepBookmark = group.bookmarks[0]
  const duplicateBookmarks = group.bookmarks.slice(1)

  const toggleBookmark = (id: string) => {
    const newSelection = new Set(selectedIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    onSelectionChange(newSelection)
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium truncate">{group.normalizedUrl}</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {keepBookmark && (
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded">
                Keep
              </span>
              <span className="text-sm truncate">{keepBookmark.title}</span>
            </div>
          </div>
        )}
        {duplicateBookmarks.map((bookmark) => (
          <div key={bookmark.id} className="px-4 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.has(bookmark.id)}
                onChange={() => toggleBookmark(bookmark.id)}
                className="rounded"
              />
              <span className="text-sm truncate">{bookmark.title}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

function FolderRename() {
  const { suggestions, loading, error, scan, renameFolder } = useFolderSuggestions()
  const [renaming, setRenaming] = useState<string | null>(null)

  const handleRename = async (id: string, name: string) => {
    setRenaming(id)
    await renameFolder(id, name)
    setRenaming(null)
  }

  if (!suggestions.length && !loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Scan for folders with generic names</p>
        <button
          onClick={scan}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Find Generic Folders'}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Analyzing folders...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <p className="text-sm text-gray-500">
        Found {suggestions.length} folder{suggestions.length !== 1 ? 's' : ''} to rename
      </p>

      {suggestions.map((suggestion) => (
        <FolderSuggestionCard
          key={suggestion.folder.id}
          suggestion={suggestion}
          onRename={handleRename}
          renaming={renaming === suggestion.folder.id}
        />
      ))}
    </div>
  )
}

function FolderSuggestionCard({
  suggestion,
  onRename,
  renaming,
}: {
  suggestion: FolderSuggestion
  onRename: (id: string, name: string) => void
  renaming: boolean
}) {
  const [editedName, setEditedName] = useState(suggestion.suggestedName)

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <FolderIcon />
        <span className="font-medium">{suggestion.folder.title}</span>
        <span className="text-gray-400">→</span>
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onRename(suggestion.folder.id, editedName)}
          disabled={renaming}
          className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {renaming ? 'Renaming...' : 'Rename'}
        </button>
      </div>
    </div>
  )
}

function DeadLinks() {
  const { deadLinks, loading, error, scan } = useDeadLinkChecker()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { removeBookmarks } = useDuplicateBookmarks()
  const [showConfirm, setShowConfirm] = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    await removeBookmarks(Array.from(selectedIds))
    setSelectedIds(new Set())
    setRemoving(false)
    setShowConfirm(false)
    scan()
  }

  if (!deadLinks.length && !loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-2">Check bookmarks for broken links</p>
        <p className="text-xs text-gray-400 mb-4">This may take a while and checks up to 50 bookmarks</p>
        <button
          onClick={scan}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Dead Links'}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Checking links...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <p className="text-sm text-gray-500">
        Found {deadLinks.length} potentially broken link{deadLinks.length !== 1 ? 's' : ''}
      </p>

      <div className="space-y-2">
        {deadLinks.map((bookmark) => (
          <label key={bookmark.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.has(bookmark.id)}
              onChange={() => {
                const newSelection = new Set(selectedIds)
                if (newSelection.has(bookmark.id)) {
                  newSelection.delete(bookmark.id)
                } else {
                  newSelection.add(bookmark.id)
                }
                setSelectedIds(newSelection)
              }}
              className="rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{bookmark.title}</p>
              <p className="text-xs text-gray-500 truncate">{bookmark.url}</p>
            </div>
          </label>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={removing}
          className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          Remove {selectedIds.size} Bookmark{selectedIds.size !== 1 ? 's' : ''}
        </button>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Remove Dead Links"
        message={`Remove ${selectedIds.size} bookmark${selectedIds.size !== 1 ? 's' : ''} with broken links?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

function OrphanBookmarks() {
  const { orphans, loading, error, scan } = useOrphanBookmarks()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { removeBookmarks } = useDuplicateBookmarks()
  const [showConfirm, setShowConfirm] = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    await removeBookmarks(Array.from(selectedIds))
    setSelectedIds(new Set())
    setRemoving(false)
    setShowConfirm(false)
    scan()
  }

  const groupedByDomain = orphans.reduce((acc, bookmark) => {
    if (!bookmark.url) return acc
    try {
      const domain = new URL(bookmark.url).hostname
      if (!acc[domain]) acc[domain] = []
      acc[domain].push(bookmark)
    } catch {
      if (!acc['other']) acc['other'] = []
      acc['other'].push(bookmark)
    }
    return acc
  }, {} as Record<string, BookmarkNode[]>)

  if (!orphans.length && !loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Find bookmarks in root folders that need organizing</p>
        <button
          onClick={scan}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Find Orphan Bookmarks'}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Scanning bookmarks...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Found {orphans.length} orphan bookmark{orphans.length !== 1 ? 's' : ''}
        </p>
        <button onClick={scan} className="text-sm text-primary-600 hover:text-primary-700">
          Rescan
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedByDomain).map(([domain, bookmarks]) => (
          <div key={domain} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{domain}</p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {bookmarks.map((bookmark) => (
                <label
                  key={bookmark.id}
                  className="flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(bookmark.id)}
                    onChange={() => {
                      const newSelection = new Set(selectedIds)
                      if (newSelection.has(bookmark.id)) {
                        newSelection.delete(bookmark.id)
                      } else {
                        newSelection.add(bookmark.id)
                      }
                      setSelectedIds(newSelection)
                    }}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{bookmark.title}</p>
                    <p className="text-xs text-gray-500 truncate">{bookmark.url}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 -mx-4">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={removing}
            className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Remove {selectedIds.size} Bookmark{selectedIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Remove Orphan Bookmarks"
        message={`Remove ${selectedIds.size} orphan bookmark${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

function LargeFolders() {
  const { largeFolders, loading, error, scan } = useLargeFolders()
  const [threshold, setThreshold] = useState(100)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const toggleFolder = (id: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedFolders(newExpanded)
  }

  if (!largeFolders.length && !loading) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-gray-500 mb-4">Find folders with many items that should be split</p>

        <div className="max-w-md mx-auto px-4">
          <SliderInput
            value={threshold}
            min={50}
            max={200}
            step={10}
            label="Folder size threshold"
            minLabel="50 items"
            maxLabel="200 items"
            valueFormatter={(v) => `${v} items`}
            onChange={setThreshold}
          />
        </div>

        <button
          onClick={() => scan(threshold)}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Find Large Folders'}
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Scanning folders...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Found {largeFolders.length} large folder{largeFolders.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => scan(threshold)} className="text-sm text-primary-600 hover:text-primary-700">
          Rescan
        </button>
      </div>

      <div className="max-w-md px-4">
        <SliderInput
          value={threshold}
          min={50}
          max={200}
          step={10}
          label="Folder size threshold"
          minLabel="50 items"
          maxLabel="200 items"
          valueFormatter={(v) => `${v} items`}
          onChange={setThreshold}
        />
      </div>

      <div className="space-y-3">
        {largeFolders.map(({ folder, itemCount }) => (
          <div key={folder.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFolder(folder.id)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderIcon />
                  <span className="font-medium">{folder.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {itemCount} items
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedFolders.has(folder.id) ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </button>

            {expandedFolders.has(folder.id) && folder.children && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
                {folder.children.slice(0, 50).map((child) => (
                  <div key={child.id} className="px-4 py-2">
                    <div className="flex items-start gap-2">
                      {child.url ? (
                        <>
                          <svg className="w-4 h-4 mt-0.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{child.title}</p>
                            <p className="text-xs text-gray-500 truncate">{child.url}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <FolderIcon />
                          <p className="text-sm">{child.title}</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {folder.children.length > 50 && (
                  <div className="px-4 py-2 text-sm text-gray-500 text-center">
                    and {folder.children.length - 50} more items...
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function BackIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  )
}
