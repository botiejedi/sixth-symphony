import { describe, it, expect, vi } from 'vitest';
import { setTabWorkspace } from './writer.js';

describe('setTabWorkspace', () => {
  it('merges workspaceId into existing vivExtData', async () => {
    const update = vi.fn().mockResolvedValue({});
    const get = vi.fn().mockResolvedValue({ id: 42, vivExtData: JSON.stringify({ pinned: true, workspaceId: 100 }) });
    await setTabWorkspace(42, 200, { tabs: { update, get } } as unknown as typeof chrome);
    expect(update).toHaveBeenCalledWith(42, { vivExtData: JSON.stringify({ pinned: true, workspaceId: 200 }) });
  });
  it('creates vivExtData when none existed', async () => {
    const update = vi.fn().mockResolvedValue({});
    const get = vi.fn().mockResolvedValue({ id: 1 });
    await setTabWorkspace(1, 5, { tabs: { update, get } } as unknown as typeof chrome);
    expect(update).toHaveBeenCalledWith(1, { vivExtData: JSON.stringify({ workspaceId: 5 }) });
  });
  it('rejects when chrome.tabs.update rejects', async () => {
    const update = vi.fn().mockRejectedValue(new Error('boom'));
    const get = vi.fn().mockResolvedValue({ id: 1 });
    await expect(setTabWorkspace(1, 5, { tabs: { update, get } } as unknown as typeof chrome)).rejects.toThrow('boom');
  });
});
