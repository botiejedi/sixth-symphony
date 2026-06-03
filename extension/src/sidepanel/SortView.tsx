import { useState, useEffect, useMemo, useCallback } from 'react'
import { SidecarClient } from '../lib/sidecar/client.js'
import { discoverWorkspaces } from '../lib/vivaldi/workspaces.js'
import { setTabWorkspace } from '../lib/vivaldi/writer.js'
import { extractDomain } from '../classifier/hard-rules.js'
import { applyPlan, type ApplyRow, type ApplyResult } from '../apply/apply.js'
import { Onboarding } from './Onboarding.js'
import { ReviewPanel, type ReviewRow } from './ReviewPanel.js'
import { usePlan } from './usePlan.js'

type Phase = 'loading' | 'offline' | 'onboarding' | 'review'

export function SortView({ onBack }: { onBack: () => void }) {
  const sidecar = useMemo(() => new SidecarClient('http://127.0.0.1:8765'), [])
  const [phase, setPhase] = useState<Phase>('loading')
  const [discoveredIds, setDiscoveredIds] = useState<number[]>([])

  const runInit = useCallback(async () => {
    setPhase('loading')
    try {
      const ws = await sidecar.listWorkspaces()
      if (ws.length === 0) {
        const tabs = await chrome.tabs.query({ currentWindow: true })
        setDiscoveredIds(discoverWorkspaces(tabs))
        setPhase('onboarding')
      } else {
        setPhase('review')
      }
    } catch {
      setPhase('offline')
    }
  }, [sidecar])

  useEffect(() => {
    void runInit()
  }, [runInit])

  const handleSave = async (items: { vivaldiWorkspaceId: number; label: string }[]) => {
    for (const it of items) {
      await sidecar.createWorkspace({
        id: `ws-${it.vivaldiWorkspaceId}`,
        label: it.label,
        vivaldiWorkspaceId: it.vivaldiWorkspaceId,
      })
    }
    await sidecar.listWorkspaces()
    setPhase('review')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          <BackArrowIcon className="w-5 h-5" />
        </button>
        <h1 className="font-display font-semibold text-white text-lg">Sort Tabs</h1>
      </div>

      {/* Phase content */}
      {phase === 'loading' && (
        <div className="text-surface-400 text-sm py-8 text-center">Loading…</div>
      )}

      {phase === 'offline' && (
        <div className="flex flex-col gap-3 items-center py-8 text-center">
          <p className="text-surface-400 text-sm">
            Memory sidecar isn&apos;t reachable at{' '}
            <span className="font-mono text-surface-300">127.0.0.1:8765</span>.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runInit()}
              className="btn-primary text-sm px-4 py-2"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onBack}
              className="btn-ghost text-sm px-4 py-2"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {phase === 'onboarding' && (
        <Onboarding discoveredIds={discoveredIds} onSave={handleSave} />
      )}

      {phase === 'review' && (
        <ReviewContainer
          sidecar={sidecar}
        />
      )}
    </div>
  )
}

function ReviewContainer({
  sidecar,
}: {
  sidecar: SidecarClient
}) {
  const { plan, loading, error, refresh } = usePlan()
  const [overrides, setOverrides] = useState<Record<number, string | null>>({})
  const [tabMeta, setTabMeta] = useState<
    Record<number, { title?: string; url?: string; pinned?: boolean }>
  >({})
  const [result, setResult] = useState<ApplyResult | null>(null)

  useEffect(() => {
    void (async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true })
      const map: Record<number, { title?: string; url?: string; pinned?: boolean }> = {}
      for (const t of tabs) {
        if (t.id != null) {
          map[t.id] = { title: t.title, url: t.url, pinned: t.pinned }
        }
      }
      setTabMeta(map)
    })()
  }, [])

  // Trigger initial plan load
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return <div className="text-surface-400 text-sm py-4 text-center">Building plan…</div>
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 items-center py-4 text-center">
        <p className="text-rose-400 text-sm">{error}</p>
        <button type="button" onClick={refresh} className="btn-primary text-sm px-4 py-2">
          Retry
        </button>
      </div>
    )
  }

  // Guard: plan may be null or may have an error shape
  if (
    !plan ||
    !plan.rows ||
    (plan as unknown as { error?: unknown }).error != null
  ) {
    return <div className="text-surface-400 text-sm py-4 text-center">No plan.</div>
  }

  const rows: ReviewRow[] = plan.rows.map(r => {
    const meta = r.tabId in tabMeta ? tabMeta[r.tabId] : undefined
    const wsId: string | null =
      r.tabId in overrides ? (overrides[r.tabId] ?? null) : r.workspaceId
    return {
      ...r,
      workspaceId: wsId,
      title: meta?.title,
      url: meta?.url,
      pinned: meta?.pinned,
    }
  })

  const handleApply = async (included: ReviewRow[]) => {
    const applyRows: ApplyRow[] = included.map(row => {
      const ws = plan.workspaces.find(w => w.id === row.workspaceId)
      const orig = plan.rows.find(pr => pr.tabId === row.tabId)
      return {
        tabId: row.tabId,
        action: row.action,
        workspaceId: row.workspaceId,
        vivaldiWorkspaceId: ws != null ? ws.vivaldiWorkspaceId : null,
        modelSuggestedWorkspaceId: orig != null ? orig.workspaceId : null,
        domain: extractDomain(row.url) ?? '',
        title: row.title ?? '',
        url: row.url ?? '',
      }
    })

    const res = await applyPlan(applyRows, {
      sidecar,
      setTabWorkspace: (tabId, vivId) => setTabWorkspace(tabId, vivId),
      removeTab: (tabId) => chrome.tabs.remove(tabId),
      learningPaused: plan.learningPaused,
    })
    setResult(res)
    refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Learning paused banner */}
      {plan.learningPaused && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Learning paused — memory sidecar offline; sorting from cached rules.
        </div>
      )}

      {/* Apply result summary */}
      {result && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
          Moved {result.moved}, closed {result.closed}, learned {result.examplesRecorded}, promoted{' '}
          {result.rulesPromoted}
          {result.failures.length > 0 && (
            <span className="text-rose-400 ml-2">({result.failures.length} failures)</span>
          )}
        </div>
      )}

      <ReviewPanel
        rows={rows}
        workspaces={plan.workspaces}
        onApply={(included) => void handleApply(included)}
        onChangeRow={(tabId, wsId) =>
          setOverrides(p => ({ ...p, [tabId]: wsId }))
        }
      />
    </div>
  )
}

function BackArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  )
}
