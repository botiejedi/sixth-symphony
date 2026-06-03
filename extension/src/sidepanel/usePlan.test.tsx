import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePlan } from './usePlan.js';

// Regression test for the dead-on-mount bug: usePlan MUST issue the
// {kind:'build-plan'} message on mount (it has no other trigger in the UI).
describe('usePlan', () => {
  beforeEach(() => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        sendMessage: vi.fn((_msg: unknown, cb: (r: unknown) => void) =>
          cb({ rows: [], workspaces: [], learningPaused: false }),
        ),
        lastError: undefined,
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it('builds the plan on mount via {kind:"build-plan"}', async () => {
    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.plan).not.toBeNull());

    const chromeMock = (
      globalThis as unknown as {
        chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } };
      }
    ).chrome;
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { kind: 'build-plan' },
      expect.any(Function),
    );
    expect(result.current.plan).toEqual({ rows: [], workspaces: [], learningPaused: false });
  });
});
