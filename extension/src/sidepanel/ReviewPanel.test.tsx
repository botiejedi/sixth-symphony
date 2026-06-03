import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewPanel } from './ReviewPanel.js';
import type { ReviewRow } from './ReviewPanel.js';
import type { Workspace } from '@symphony/shared';

// --- Fixtures ---

const WS_WORK: Workspace = { id: 'ws-work', label: 'Work', vivaldiWorkspaceId: 1 };
const WS_PERSONAL: Workspace = { id: 'ws-personal', label: 'Personal', vivaldiWorkspaceId: 2 };
const workspaces: Workspace[] = [WS_WORK, WS_PERSONAL];

const makeRow = (overrides: Partial<ReviewRow> & { tabId: number }): ReviewRow => ({
  action: 'move',
  workspaceId: 'ws-work',
  confidence: 0.9,
  reason: 'matched rule',
  source: 'rule',
  ...overrides,
});

// --- Tests ---

describe('ReviewPanel', () => {
  describe('(a) bucket headings', () => {
    it('renders a heading for each workspace bucket, a Close bucket, and a Keep bucket', () => {
      const rows: ReviewRow[] = [
        makeRow({ tabId: 1, action: 'move', workspaceId: 'ws-work', title: 'GitHub' }),
        makeRow({ tabId: 2, action: 'move', workspaceId: 'ws-personal', title: 'Reddit' }),
        makeRow({ tabId: 3, action: 'close', workspaceId: null, confidence: 0.3, reason: 'junk', source: 'model' }),
        makeRow({ tabId: 4, action: 'keep', workspaceId: null, confidence: 0.5, reason: 'reading', source: 'model' }),
      ];

      render(
        <ReviewPanel
          rows={rows}
          workspaces={workspaces}
          onApply={vi.fn()}
        />
      );

      // Workspace buckets — find headings (h3 elements) by their text
      const headings = screen.getAllByRole('heading');
      const headingTexts = headings.map(h => h.textContent ?? '');
      expect(headingTexts.some(t => t === 'Work')).toBe(true);
      expect(headingTexts.some(t => t === 'Personal')).toBe(true);
      // Close and Keep buckets
      expect(headingTexts.some(t => /close/i.test(t))).toBe(true);
      expect(headingTexts.some(t => /keep/i.test(t))).toBe(true);
    });
  });

  describe('(b) close row checkbox default state', () => {
    it('a low-confidence close row is unchecked by default', () => {
      const rows: ReviewRow[] = [
        makeRow({ tabId: 10, action: 'close', workspaceId: null, confidence: 0.1, reason: 'junk', source: 'model' }),
      ];

      render(
        <ReviewPanel
          rows={rows}
          workspaces={workspaces}
          onApply={vi.fn()}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      // All close rows should be unchecked regardless of confidence
      checkboxes.forEach(cb => {
        expect((cb as HTMLInputElement).checked).toBe(false);
      });
    });

    it('a high-confidence close row is also unchecked by default', () => {
      const rows: ReviewRow[] = [
        makeRow({ tabId: 11, action: 'close', workspaceId: null, confidence: 0.99, reason: 'obvious junk', source: 'model' }),
      ];

      render(
        <ReviewPanel
          rows={rows}
          workspaces={workspaces}
          onApply={vi.fn()}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(cb => {
        expect((cb as HTMLInputElement).checked).toBe(false);
      });
    });
  });

  describe('(c) pinned close row', () => {
    it('a pinned close row is not pre-checked', () => {
      const rows: ReviewRow[] = [
        makeRow({ tabId: 20, action: 'close', workspaceId: null, confidence: 0.95, reason: 'close', source: 'model', pinned: true }),
      ];

      render(
        <ReviewPanel
          rows={rows}
          workspaces={workspaces}
          onApply={vi.fn()}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(cb => {
        expect((cb as HTMLInputElement).checked).toBe(false);
      });
    });
  });

  describe('(d) workspace select calls onChangeRow', () => {
    it('changing a row workspace select calls onChangeRow with tabId and new workspaceId', () => {
      const onChangeRow = vi.fn();
      const rows: ReviewRow[] = [
        makeRow({ tabId: 30, action: 'move', workspaceId: 'ws-work', title: 'Some Tab' }),
      ];

      render(
        <ReviewPanel
          rows={rows}
          workspaces={workspaces}
          onApply={vi.fn()}
          onChangeRow={onChangeRow}
        />
      );

      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
      fireEvent.change(selects[0]!, { target: { value: 'ws-personal' } });

      expect(onChangeRow).toHaveBeenCalledWith(30, 'ws-personal');
    });
  });

  describe('(e) Apply button calls onApply with only checked rows', () => {
    it('unchecking a move row excludes it from onApply', () => {
      const onApply = vi.fn();
      const rows: ReviewRow[] = [
        makeRow({ tabId: 40, action: 'move', workspaceId: 'ws-work', title: 'Tab A' }),
        makeRow({ tabId: 41, action: 'move', workspaceId: 'ws-work', title: 'Tab B' }),
      ];

      render(
        <ReviewPanel
          rows={rows}
          workspaces={workspaces}
          onApply={onApply}
        />
      );

      // Both move rows default to checked; uncheck the first one
      const checkboxes = screen.getAllByRole('checkbox');
      // Find the first checked checkbox and uncheck it
      const firstChecked = checkboxes.find(cb => (cb as HTMLInputElement).checked);
      expect(firstChecked).toBeTruthy();
      fireEvent.click(firstChecked!);

      // Click Apply
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(onApply).toHaveBeenCalledTimes(1);
      const appliedRows: ReviewRow[] = (onApply.mock.calls[0] as [ReviewRow[]])[0];
      // Only one of the two rows should be included
      expect(appliedRows).toHaveLength(1);
      expect(appliedRows[0]!.tabId).toBe(41);
    });

    it('close rows that remain unchecked are excluded from onApply', () => {
      const onApply = vi.fn();
      const rows: ReviewRow[] = [
        makeRow({ tabId: 50, action: 'move', workspaceId: 'ws-work', title: 'Keep this' }),
        makeRow({ tabId: 51, action: 'close', workspaceId: null, confidence: 0.9, reason: 'junk', source: 'model' }),
      ];

      render(
        <ReviewPanel
          rows={rows}
          workspaces={workspaces}
          onApply={onApply}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(onApply).toHaveBeenCalledTimes(1);
      const appliedRows: ReviewRow[] = (onApply.mock.calls[0] as [ReviewRow[]])[0];
      // Only the move row (tabId 50) should be in applied rows
      expect(appliedRows).toHaveLength(1);
      expect(appliedRows[0]!.tabId).toBe(50);
    });
  });
});
