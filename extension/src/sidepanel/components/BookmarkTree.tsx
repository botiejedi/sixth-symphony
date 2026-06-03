import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { BookmarkNode } from '@/types/domain'

interface BookmarkTreeProps {
  nodes: BookmarkNode[]
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  onRename?: (id: string, newName: string) => void
  expandedByDefault?: boolean
  showFolderActions?: boolean
}

export function BookmarkTree({
  nodes,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  onRename,
  expandedByDefault = false,
  showFolderActions = false,
}: BookmarkTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    expandedByDefault ? new Set(getAllFolderIds(nodes)) : new Set()
  )

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelection = useCallback(
    (id: string) => {
      if (!onSelectionChange) return
      const next = new Set(selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      onSelectionChange(next)
    },
    [selectedIds, onSelectionChange]
  )

  const expandAll = () => {
    setExpandedFolders(new Set(getAllFolderIds(nodes)))
  }

  const collapseAll = () => {
    setExpandedFolders(new Set())
  }

  if (nodes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="empty-state py-8"
      >
        <FolderIcon className="empty-state-icon" />
        <p className="empty-state-title">No bookmarks found</p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={expandAll}
          className="btn-ghost text-xs px-2 py-1"
        >
          <ChevronDoubleDownIcon className="w-3 h-3 mr-1 inline" />
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="btn-ghost text-xs px-2 py-1"
        >
          <ChevronDoubleUpIcon className="w-3 h-3 mr-1 inline" />
          Collapse All
        </button>
        {selectable && selectedIds.size > 0 && (
          <span className="ml-auto text-xs text-surface-400">
            {selectedIds.size} selected
          </span>
        )}
      </div>

      {/* Tree */}
      <div className="space-y-1">
        {nodes.map((node) => (
          <BookmarkNodeItem
            key={node.id}
            node={node}
            depth={0}
            expanded={expandedFolders.has(node.id)}
            onToggleFolder={toggleFolder}
            selectable={selectable}
            selected={selectedIds.has(node.id)}
            onToggleSelection={toggleSelection}
            expandedFolders={expandedFolders}
            selectedIds={selectedIds}
            onRename={onRename}
            showFolderActions={showFolderActions}
          />
        ))}
      </div>
    </div>
  )
}

interface BookmarkNodeItemProps {
  node: BookmarkNode
  depth: number
  expanded: boolean
  onToggleFolder: (id: string) => void
  selectable: boolean
  selected: boolean
  onToggleSelection: (id: string) => void
  expandedFolders: Set<string>
  selectedIds: Set<string>
  onRename?: (id: string, newName: string) => void
  showFolderActions: boolean
}

function BookmarkNodeItem({
  node,
  depth,
  expanded,
  onToggleFolder,
  selectable,
  selected,
  onToggleSelection,
  expandedFolders,
  selectedIds,
  onRename,
  showFolderActions,
}: BookmarkNodeItemProps) {
  const [imgError, setImgError] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(node.title)

  const isFolder = !!node.children
  const hasChildren = isFolder && node.children!.length > 0
  const domain = node.url ? getDomain(node.url) : null

  const handleSaveRename = () => {
    if (onRename && editName.trim() && editName !== node.title) {
      onRename(node.id, editName.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename()
    } else if (e.key === 'Escape') {
      setEditName(node.title)
      setIsEditing(false)
    }
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.02 }}
        style={{ paddingLeft: `${depth * 16}px` }}
        className={`
          flex items-center gap-2 p-2 rounded-lg transition-all
          ${selected
            ? 'bg-brand-500/10 ring-1 ring-brand-500/30'
            : 'hover:bg-surface-800/50'
          }
        `}
      >
        {/* Selection checkbox */}
        {selectable && (
          <button
            onClick={() => onToggleSelection(node.id)}
            className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
              selected
                ? 'bg-brand-500 border-brand-500'
                : 'border-surface-600 bg-transparent hover:border-surface-500'
            }`}
          >
            {selected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
          </button>
        )}

        {/* Folder expand/collapse or spacer */}
        {isFolder ? (
          <button
            onClick={() => onToggleFolder(node.id)}
            className="w-5 h-5 flex items-center justify-center text-surface-400 hover:text-white transition-colors"
          >
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </motion.div>
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Icon */}
        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
          {isFolder ? (
            <motion.div
              animate={{ scale: expanded ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
            >
              {expanded ? (
                <FolderOpenIcon className="w-4 h-4 text-amber-400" />
              ) : (
                <FolderIcon className="w-4 h-4 text-amber-400/70" />
              )}
            </motion.div>
          ) : (
            <div className="w-4 h-4 rounded overflow-hidden bg-surface-800">
              {node.url && !imgError ? (
                <img
                  src={getFaviconUrl(node.url)}
                  alt=""
                  className="w-4 h-4 object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <GlobeIcon className="w-4 h-4 text-surface-500 p-0.5" />
              )}
            </div>
          )}
        </div>

        {/* Title/URL */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full bg-surface-800 border border-surface-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          ) : (
            <>
              <p className="text-sm font-medium text-white truncate">
                {node.title || 'Untitled'}
              </p>
              {domain && (
                <p className="text-xs text-surface-500 truncate">{domain}</p>
              )}
            </>
          )}
        </div>

        {/* Folder info & actions */}
        {isFolder && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-surface-500">
              {node.children!.length} items
            </span>
            {showFolderActions && onRename && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-icon-sm opacity-0 group-hover:opacity-100 transition-opacity"
                title="Rename folder"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Bookmark link action */}
        {!isFolder && node.url && (
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-surface-700 transition-colors"
            title="Open bookmark"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLinkIcon className="w-3.5 h-3.5 text-surface-400" />
          </a>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isFolder && expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children!.map((child) => (
              <BookmarkNodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                expanded={expandedFolders.has(child.id)}
                onToggleFolder={onToggleFolder}
                selectable={selectable}
                selected={selectedIds.has(child.id)}
                onToggleSelection={onToggleSelection}
                expandedFolders={expandedFolders}
                selectedIds={selectedIds}
                onRename={onRename}
                showFolderActions={showFolderActions}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Helper functions
function getAllFolderIds(nodes: BookmarkNode[]): string[] {
  const ids: string[] = []
  const traverse = (node: BookmarkNode) => {
    if (node.children) {
      ids.push(node.id)
      node.children.forEach(traverse)
    }
  }
  nodes.forEach(traverse)
  return ids
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

// Icons
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  )
}

function FolderOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z"
        clipRule="evenodd"
      />
      <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ChevronDoubleDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
    </svg>
  )
}

function ChevronDoubleUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}
