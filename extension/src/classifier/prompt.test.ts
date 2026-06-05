import { describe, it, expect } from 'vitest';
import { buildClassifierPrompt } from './prompt.js';
import type { Workspace, Example } from '@symphony/shared';

const workspaces: Workspace[] = [
  { id: 'ws-code', label: 'Code', vivaldiWorkspaceId: 1 },
  { id: 'ws-read', label: 'Reading', vivaldiWorkspaceId: 2 },
];
const examples: Example[] = [
  { id: 'e-1', domain: 'github.com', title: 'repo', url: 'https://github.com/x', modelSuggestedWorkspaceId: 'ws-read', userChoseWorkspaceId: 'ws-code', userChoseAction: 'move', createdAt: '2026-06-01T00:00:00.000Z' },
];
const tabs = [
  { id: 10, title: 'My Repo', url: 'https://github.com/me/repo' },
  { id: 11, title: 'Article', url: 'https://blog.example.com/post' },
];

describe('buildClassifierPrompt', () => {
  it('includes workspace list, examples, and tab batch', () => {
    const built = buildClassifierPrompt({ workspaces, examples, tabs });
    expect(built.system).toContain('Code');
    expect(built.system).toContain('Reading');
    expect(built.user).toContain('https://github.com/me/repo');
    expect(built.user).toContain('https://blog.example.com/post');
    // example influence: the prior correction (github.com → ws-code) appears verbatim
    expect(built.system).toContain('https://github.com/x');
    expect(built.responseSchema).toMatchObject({ type: 'array' });
  });
  it('omits the examples block when none are provided', () => {
    const built = buildClassifierPrompt({ workspaces, examples: [], tabs });
    expect(built.system).not.toContain('Past corrections');
  });
});
