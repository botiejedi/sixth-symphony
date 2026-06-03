import { useState } from 'react';
import type { Workspace } from '@symphony/shared';
import type { PlanRow } from '../background/orchestrator.js';

export interface ReviewRow extends PlanRow {
  title?: string;
  url?: string;
  pinned?: boolean;
}

interface ReviewPanelProps {
  rows: ReviewRow[];
  workspaces: Workspace[];
  onApply: (included: ReviewRow[]) => void;
  onChangeRow?: (tabId: number, workspaceId: string | null) => void;
}

function defaultChecked(row: ReviewRow): boolean {
  // close rows are never pre-checked; only move rows are
  return row.action === 'move';
}

export function ReviewPanel({ rows, workspaces, onApply, onChangeRow }: ReviewPanelProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(rows.map(r => [r.tabId, defaultChecked(r)]))
  );

  function toggleRow(tabId: number) {
    setChecked(prev => ({ ...prev, [tabId]: !prev[tabId] }));
  }

  function handleApply() {
    const included = rows.filter(r => checked[r.tabId] === true);
    onApply(included);
  }

  // Build buckets
  const moveByWorkspace = new Map<string, ReviewRow[]>();
  for (const ws of workspaces) {
    moveByWorkspace.set(ws.id, []);
  }
  const closeRows: ReviewRow[] = [];
  const keepRows: ReviewRow[] = [];

  for (const row of rows) {
    if (row.action === 'move' && row.workspaceId !== null) {
      const bucket = moveByWorkspace.get(row.workspaceId);
      if (bucket) {
        bucket.push(row);
      } else {
        // workspace not in list — create a bucket for it
        moveByWorkspace.set(row.workspaceId, [row]);
      }
    } else if (row.action === 'close') {
      closeRows.push(row);
    } else {
      keepRows.push(row);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        type="button"
        onClick={handleApply}
        className="self-start bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Apply
      </button>

      {/* Workspace move buckets */}
      {workspaces.map(ws => {
        const bucketRows = moveByWorkspace.get(ws.id) ?? [];
        if (bucketRows.length === 0) return null;
        return (
          <BucketSection
            key={ws.id}
            heading={ws.label}
            rows={bucketRows}
            workspaces={workspaces}
            checked={checked}
            onToggle={toggleRow}
            onChangeRow={onChangeRow}
          />
        );
      })}

      {/* Close bucket */}
      {closeRows.length > 0 && (
        <BucketSection
          heading="Close (junk)"
          rows={closeRows}
          workspaces={workspaces}
          checked={checked}
          onToggle={toggleRow}
          onChangeRow={onChangeRow}
        />
      )}

      {/* Keep bucket */}
      {keepRows.length > 0 && (
        <BucketSection
          heading="Keep"
          rows={keepRows}
          workspaces={workspaces}
          checked={checked}
          onToggle={toggleRow}
          onChangeRow={onChangeRow}
        />
      )}
    </div>
  );
}

interface BucketSectionProps {
  heading: string;
  rows: ReviewRow[];
  workspaces: Workspace[];
  checked: Record<number, boolean>;
  onToggle: (tabId: number) => void;
  onChangeRow?: (tabId: number, workspaceId: string | null) => void;
}

function BucketSection({ heading, rows, workspaces, checked, onToggle, onChangeRow }: BucketSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{heading}</h3>
      <div className="flex flex-col gap-2">
        {rows.map(row => (
          <RowItem
            key={row.tabId}
            row={row}
            workspaces={workspaces}
            isChecked={checked[row.tabId] ?? false}
            onToggle={onToggle}
            onChangeRow={onChangeRow}
          />
        ))}
      </div>
    </div>
  );
}

interface RowItemProps {
  row: ReviewRow;
  workspaces: Workspace[];
  isChecked: boolean;
  onToggle: (tabId: number) => void;
  onChangeRow?: (tabId: number, workspaceId: string | null) => void;
}

function RowItem({ row, workspaces, isChecked, onToggle, onChangeRow }: RowItemProps) {
  const displayTitle = row.title ?? `#${row.tabId}`;

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    onChangeRow?.(row.tabId, value === '' ? null : value);
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded border border-gray-200">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => onToggle(row.tabId)}
        className="mt-1 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{displayTitle}</div>
        {row.url && (
          <div className="text-xs text-gray-500 truncate">{row.url}</div>
        )}
        <div className="text-xs text-gray-400 mt-1">{row.reason}</div>
      </div>
      <select
        value={row.workspaceId ?? ''}
        onChange={handleSelectChange}
        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
      >
        <option value="">— none —</option>
        {workspaces.map(ws => (
          <option key={ws.id} value={ws.id}>
            {ws.label}
          </option>
        ))}
      </select>
    </div>
  );
}
