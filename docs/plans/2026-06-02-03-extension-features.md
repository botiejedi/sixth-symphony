# Plan 3 — Extension Features

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the forked TabBrain extension into 6th Symphony: a Vivaldi tab sorter that proposes workspace assignments + junk closes, lets the user review and adjust, applies the approved plan, and learns from corrections via the memory sidecar.

**Architecture:** Background service worker orchestrates: gather tabs → apply hard rules → batch the rest to the LLM with a hybrid few-shot prompt → render proposal in a slide-in side panel grouped by workspace → apply approved moves/closes → record corrections back to the sidecar → promote repeat-corrected domains to hard rules at threshold 3. Vivaldi-specific writes happen via `chrome.tabs.update(id, { vivExtData: ... })`. The sidecar (Plan 2) is the source of truth for memory; the extension caches rules in `chrome.storage.local` for offline tolerance.

**Tech Stack:** TypeScript 5, React 18, Tailwind, Vite + CRXJS, Vitest, React Testing Library, `msw` for fetch stubs, Framer Motion (small; for the slide-in + chip animation), Manifest V3 service worker, Chrome extension APIs.

**Prerequisites:**
- Plan 1 complete — monorepo scaffold, extension boots in Vivaldi.
- Plan 2 complete — sidecar running at `http://127.0.0.1:8765` (or override via storage), `@symphony/shared` exports `Workspace`, `Rule`, `Example`, `Action`.

**Conventions:**
- TDD discipline: failing test → minimal code → passing test → commit. See @superpowers:test-driven-development.
- All Chrome API calls go through thin wrappers in `extension/src/lib/chrome/` so they can be mocked. (TabBrain already has some — extend, don't duplicate.)
- Browser-only DOM tests use `vitest`'s `jsdom` environment (already in TabBrain's setup; verify in Task 1).
- @superpowers:verification-before-completion before claiming any task done.

---

## Task 1: Discover what TabBrain already gives us

**Files:** none modified.

**Step 1: Inventory the upstream code we're going to extend**

Read, in order, and record one-liners about each:

- `extension/src/lib/llm/provider.ts` — the OpenAI-compatible adapter. Note the function name, signature, how `response_format`/JSON-schema is (or isn't) currently surfaced.
- `extension/src/lib/chrome/` — list every wrapper file. Note which already cover `chrome.tabs.query`, `chrome.tabs.update`, `chrome.tabs.remove`, `chrome.storage.local`.
- `extension/src/sidepanel/` — entry point, current screens, routing pattern (if any).
- `extension/src/background/` — the service worker entry.
- `extension/manifest.json` — current `permissions`, `host_permissions`, `name`, `description`.
- `extension/vitest.config.ts` and `extension/tsconfig.json` — confirm `jsdom` env and path aliases.

**Step 2: Decide if we need new permissions**

For our features we need at minimum:
- `tabs` (likely already present)
- `storage` (likely already present)
- host permission `http://127.0.0.1:8765/*` (new — for sidecar fetch)

Add to a scratch note. We'll change the manifest in Task 4.

**Step 3: No commit — discovery only.**

---

## Task 2: Branding pass (rename UI strings only)

**Files:**
- Modify: `extension/manifest.json` — `name`, `description`
- Modify: `extension/public/` — leave icons as-is for now (placeholder)
- Modify: `extension/src/sidepanel/` — top-level header text
- Modify: `extension/README.md` (or create at extension root if missing)

We deliberately don't rename internal identifiers (file paths, classes, function names). That risks breaking imports for no user-visible win. Only user-facing strings change in this task.

**Step 1: Update manifest**

```json
{
  "name": "6th Symphony — AI Tab Sorter",
  "description": "Sorts your Vivaldi tabs into workspaces with a local AI model. Learns your taste over time."
}
```

**Step 2: Update the side-panel header**

Find the upstream "TabBrain" string in `extension/src/sidepanel/` (likely a header or `<title>`). Replace with `6th Symphony`.

**Step 3: Rebuild + reload in Vivaldi**

Run: `npm run build:extension`
Reload the unpacked extension in `vivaldi://extensions`. Open the side panel. Confirm the header reads "6th Symphony".

**Step 4: Run upstream tests — expect any that hard-asserted the string "TabBrain" to fail; update those assertions.**

Run: `npm run test:extension`

**Step 5: Commit**

```powershell
git add extension/manifest.json extension/src/sidepanel/ extension/README.md
git commit -m "chore(extension): rebrand TabBrain → 6th Symphony (UI strings only)"
```

---

## Task 3: Wire `@symphony/shared` into the extension

**Files:**
- Modify: `extension/package.json` — add `"@symphony/shared": "*"` under `dependencies`
- Modify: `extension/tsconfig.json` if needed (path resolution)
- Create: `extension/src/lib/shared-smoke.test.ts`

**Step 1: Add the dependency**

In `extension/package.json` `dependencies`:

```json
"@symphony/shared": "*"
```

**Step 2: Install from repo root**

Run: `npm install`

**Step 3: Failing test**

`extension/src/lib/shared-smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WorkspaceSchema } from '@symphony/shared';

describe('shared types reachable from extension', () => {
  it('WorkspaceSchema parses', () => {
    const w = WorkspaceSchema.parse({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 });
    expect(w.label).toBe('Work');
  });
});
```

**Step 4: Run extension tests — expect pass**

Run: `npm run test:extension`

If `@symphony/shared` doesn't resolve (CRXJS + Vite quirk), add a path alias in `extension/tsconfig.json` and a Vite alias in `extension/vite.config.ts` pointing at `../shared/src/index.ts`. Re-run; should pass.

**Step 5: Commit**

```powershell
git add extension/package.json extension/tsconfig.json extension/vite.config.ts extension/src/lib/shared-smoke.test.ts package-lock.json
git commit -m "feat(extension): import @symphony/shared types"
```

---

## Task 4: Manifest — add sidecar host permission

**Files:**
- Modify: `extension/manifest.json`

**Step 1: Add `host_permissions`**

```json
"host_permissions": [
  "http://127.0.0.1:8765/*"
]
```

If `host_permissions` already exists, append. Confirm `tabs` and `storage` are in `permissions`; add if missing.

**Step 2: Build + reload in Vivaldi**

Run: `npm run build:extension`. Reload. Open `vivaldi://extensions`, expand the extension, confirm "Site access" lists `127.0.0.1`.

**Step 3: Commit**

```powershell
git add extension/manifest.json
git commit -m "feat(extension): host permission for sidecar (127.0.0.1:8765)"
```

---

## Task 5: Vivaldi workspace discovery

**Files:**
- Create: `extension/src/lib/vivaldi/workspaces.ts`
- Create: `extension/src/lib/vivaldi/workspaces.test.ts`

The `vivExtData` field on a Vivaldi tab is a stringified JSON blob; one of its fields is `workspaceId` (number, can be int or float depending on version).

**Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseVivExtData, discoverWorkspaces } from './workspaces.js';

describe('parseVivExtData', () => {
  it('returns null for undefined/empty', () => {
    expect(parseVivExtData(undefined)).toBeNull();
    expect(parseVivExtData('')).toBeNull();
  });
  it('returns parsed object with numeric workspaceId', () => {
    expect(parseVivExtData(JSON.stringify({ workspaceId: 12345 }))).toEqual({ workspaceId: 12345 });
  });
  it('returns parsed object even when workspaceId is a float', () => {
    expect(parseVivExtData(JSON.stringify({ workspaceId: 12345.0 }))?.workspaceId).toBe(12345);
  });
  it('returns null on malformed JSON', () => {
    expect(parseVivExtData('{bad')).toBeNull();
  });
});

describe('discoverWorkspaces', () => {
  it('dedupes workspaceIds across tabs and ignores tabs without one', () => {
    const tabs = [
      { id: 1, vivExtData: JSON.stringify({ workspaceId: 100 }) },
      { id: 2, vivExtData: JSON.stringify({ workspaceId: 100 }) },
      { id: 3, vivExtData: JSON.stringify({ workspaceId: 200 }) },
      { id: 4, vivExtData: undefined },
      { id: 5, vivExtData: JSON.stringify({ pinned: true }) },
    ] as unknown as chrome.tabs.Tab[];
    expect(discoverWorkspaces(tabs).sort()).toEqual([100, 200]);
  });
});
```

**Step 2: Implement `extension/src/lib/vivaldi/workspaces.ts`**

```typescript
export interface VivExtData {
  workspaceId?: number;
  [k: string]: unknown;
}

export function parseVivExtData(raw: string | undefined): VivExtData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as VivExtData;
    return null;
  } catch {
    return null;
  }
}

export function discoverWorkspaces(tabs: chrome.tabs.Tab[]): number[] {
  const seen = new Set<number>();
  for (const t of tabs) {
    const v = parseVivExtData((t as unknown as { vivExtData?: string }).vivExtData);
    if (v?.workspaceId != null) seen.add(Math.trunc(v.workspaceId));
  }
  return [...seen];
}
```

**Step 3: Run tests — expect pass**

Run: `npm run test:extension`

**Step 4: Commit**

```powershell
git add extension/src/lib/vivaldi/
git commit -m "feat(extension): vivaldi workspace discovery + parseVivExtData"
```

---

## Task 6: Vivaldi workspace writer

**Files:**
- Create: `extension/src/lib/vivaldi/writer.ts`
- Create: `extension/src/lib/vivaldi/writer.test.ts`

**Step 1: Failing test**

```typescript
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
```

**Step 2: Implement `extension/src/lib/vivaldi/writer.ts`**

```typescript
import { parseVivExtData } from './workspaces.js';

export async function setTabWorkspace(
  tabId: number,
  workspaceId: number,
  api: typeof chrome = chrome,
): Promise<void> {
  const tab = await api.tabs.get(tabId);
  const existing = parseVivExtData((tab as unknown as { vivExtData?: string }).vivExtData) ?? {};
  const next = { ...existing, workspaceId: Math.trunc(workspaceId) };
  await api.tabs.update(tabId, { vivExtData: JSON.stringify(next) } as chrome.tabs.UpdateProperties);
}
```

(The cast to `UpdateProperties` is necessary because `vivExtData` is a Vivaldi extension to the standard schema and isn't in `@types/chrome`.)

**Step 3: Tests pass; commit**

```powershell
git add extension/src/lib/vivaldi/writer.ts extension/src/lib/vivaldi/writer.test.ts
git commit -m "feat(extension): setTabWorkspace writer preserves existing vivExtData"
```

---

## Task 7: Sidecar HTTP client

**Files:**
- Create: `extension/src/lib/sidecar/client.ts`
- Create: `extension/src/lib/sidecar/client.test.ts`

We add msw to the extension workspace for fetch mocking.

**Step 1: Add msw to extension devDeps**

In `extension/package.json` devDependencies:

```json
"msw": "^2.4.0"
```

Run: `npm install`

**Step 2: Failing test `extension/src/lib/sidecar/client.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { SidecarClient, SidecarUnreachable } from './client.js';

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = new SidecarClient('http://127.0.0.1:8765');

describe('SidecarClient', () => {
  it('listRules returns parsed rows', async () => {
    server.use(http.get('http://127.0.0.1:8765/v1/rules', () =>
      HttpResponse.json([{ id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' }])));
    const rules = await client.listRules();
    expect(rules[0].domain).toBe('github.com');
  });
  it('throws SidecarUnreachable when fetch rejects after one retry', async () => {
    server.use(http.get('http://127.0.0.1:8765/v1/rules', () => HttpResponse.error()));
    await expect(client.listRules()).rejects.toBeInstanceOf(SidecarUnreachable);
  });
  it('hybrid examples query encodes domains correctly', async () => {
    let receivedUrl = '';
    server.use(http.get('http://127.0.0.1:8765/v1/examples', ({ request }) => {
      receivedUrl = request.url;
      return HttpResponse.json([]);
    }));
    await client.listExamplesHybrid({ recent: 5, domains: ['github.com', 'news.ycombinator.com'] });
    expect(receivedUrl).toContain('recent=5');
    expect(receivedUrl).toContain('domains=github.com%2Cnews.ycombinator.com');
  });
});
```

**Step 3: Implement `extension/src/lib/sidecar/client.ts`**

```typescript
import { RuleSchema, ExampleSchema, WorkspaceSchema, type Rule, type Example, type Workspace } from '@symphony/shared';
import { z } from 'zod';

export class SidecarUnreachable extends Error {
  constructor(cause?: unknown) {
    super('sidecar unreachable');
    this.cause = cause;
  }
}

export class SidecarClient {
  constructor(private baseUrl: string, private token?: string) {}

  private async fetchJson<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    const url = `${this.baseUrl}${path}`;
    const attempt = async () => {
      const res = await fetch(url, { ...init, headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return schema.parse(await res.json());
    };
    try {
      return await attempt();
    } catch (e) {
      try { return await attempt(); }
      catch (retryErr) { throw new SidecarUnreachable(retryErr); }
    }
  }

  listRules() { return this.fetchJson('/v1/rules', {}, z.array(RuleSchema)); }
  createRule(r: Rule) { return this.fetchJson('/v1/rules', { method: 'POST', body: JSON.stringify(r) }, RuleSchema); }
  incrementRule(domain: string) { return this.fetchJson(`/v1/rules/${encodeURIComponent(domain)}/increment`, { method: 'POST' }, RuleSchema); }

  listWorkspaces() { return this.fetchJson('/v1/workspaces', {}, z.array(WorkspaceSchema)); }
  createWorkspace(w: Workspace) { return this.fetchJson('/v1/workspaces', { method: 'POST', body: JSON.stringify(w) }, WorkspaceSchema); }

  createExample(e: Example) { return this.fetchJson('/v1/examples', { method: 'POST', body: JSON.stringify(e) }, ExampleSchema); }
  listExamplesHybrid(args: { recent: number; domains: string[] }) {
    const qs = new URLSearchParams({ recent: String(args.recent), domains: args.domains.join(',') });
    return this.fetchJson(`/v1/examples?${qs}`, {}, z.array(ExampleSchema));
  }
}
```

**Step 4: Tests pass; commit**

```powershell
git add extension/src/lib/sidecar/ extension/package.json package-lock.json
git commit -m "feat(extension): typed SidecarClient with retry-once + msw tests"
```

---

## Task 8: Local rules cache (`chrome.storage.local`)

**Files:**
- Create: `extension/src/lib/sidecar/rules-cache.ts`
- Create: `extension/src/lib/sidecar/rules-cache.test.ts`

**Step 1: Failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { RulesCache } from './rules-cache.js';
import type { Rule } from '@symphony/shared';

function memStorage(): typeof chrome.storage.local {
  const data: Record<string, unknown> = {};
  return {
    get: vi.fn(async (keys: string | string[]) => {
      const ks = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(ks.filter(k => k in data).map(k => [k, data[k]]));
    }),
    set: vi.fn(async (kv: Record<string, unknown>) => { Object.assign(data, kv); }),
    remove: vi.fn(async (k: string) => { delete data[k]; }),
  } as unknown as typeof chrome.storage.local;
}

const RULE: Rule = { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' };

describe('RulesCache', () => {
  it('round-trips rules through storage', async () => {
    const cache = new RulesCache(memStorage());
    await cache.write([RULE]);
    expect(await cache.read()).toEqual([RULE]);
  });
  it('returns [] when nothing cached', async () => {
    const cache = new RulesCache(memStorage());
    expect(await cache.read()).toEqual([]);
  });
  it('refresh writes new rules and reports the refresh time', async () => {
    const cache = new RulesCache(memStorage());
    const t = await cache.refreshedAt();
    expect(t).toBeNull();
    await cache.write([RULE]);
    const after = await cache.refreshedAt();
    expect(after).toBeInstanceOf(Date);
  });
});
```

**Step 2: Implement**

```typescript
import { type Rule, RuleSchema } from '@symphony/shared';
import { z } from 'zod';

const KEY = '6th-symphony:rules';
const TIME_KEY = '6th-symphony:rules:refreshedAt';

export class RulesCache {
  constructor(private storage: typeof chrome.storage.local) {}

  async read(): Promise<Rule[]> {
    const got = await this.storage.get([KEY]);
    const raw = got[KEY];
    if (!raw) return [];
    const parsed = z.array(RuleSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  }

  async write(rules: Rule[]): Promise<void> {
    await this.storage.set({ [KEY]: rules, [TIME_KEY]: new Date().toISOString() });
  }

  async refreshedAt(): Promise<Date | null> {
    const got = await this.storage.get([TIME_KEY]);
    const raw = got[TIME_KEY];
    return typeof raw === 'string' ? new Date(raw) : null;
  }
}
```

**Step 3: Tests pass; commit**

```powershell
git add extension/src/lib/sidecar/rules-cache.ts extension/src/lib/sidecar/rules-cache.test.ts
git commit -m "feat(extension): chrome.storage.local rules cache"
```

---

## Task 9: Hard-rule pass (partition tabs)

**Files:**
- Create: `extension/src/classifier/hard-rules.ts`
- Create: `extension/src/classifier/hard-rules.test.ts`

**Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { applyHardRules, extractDomain } from './hard-rules.js';
import type { Rule } from '@symphony/shared';

describe('extractDomain', () => {
  it('strips scheme and www.', () => {
    expect(extractDomain('https://www.github.com/foo')).toBe('github.com');
    expect(extractDomain('http://news.ycombinator.com/item?id=1')).toBe('news.ycombinator.com');
  });
  it('returns null on malformed URL', () => {
    expect(extractDomain('not a url')).toBeNull();
  });
});

describe('applyHardRules', () => {
  const rules: Rule[] = [
    { id: 'r-1', domain: 'github.com', workspaceId: 'ws-code', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' },
  ];
  it('assigns matching tabs and leaves the rest', () => {
    const tabs = [
      { id: 1, url: 'https://github.com/x' },
      { id: 2, url: 'https://news.ycombinator.com' },
    ] as chrome.tabs.Tab[];
    const { assigned, remaining } = applyHardRules(tabs, rules);
    expect(assigned).toEqual([{ tabId: 1, workspaceId: 'ws-code' }]);
    expect(remaining.map(t => t.id)).toEqual([2]);
  });
  it('ignores rules whose domain has no matching tab', () => {
    const tabs = [{ id: 1, url: 'https://news.ycombinator.com' }] as chrome.tabs.Tab[];
    const { assigned, remaining } = applyHardRules(tabs, rules);
    expect(assigned).toEqual([]);
    expect(remaining).toHaveLength(1);
  });
});
```

**Step 2: Implement**

```typescript
import type { Rule } from '@symphony/shared';

export function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export interface HardAssignment {
  tabId: number;
  workspaceId: string;
}

export interface HardRulePartition {
  assigned: HardAssignment[];
  remaining: chrome.tabs.Tab[];
}

export function applyHardRules(tabs: chrome.tabs.Tab[], rules: Rule[]): HardRulePartition {
  const byDomain = new Map(rules.map(r => [r.domain, r]));
  const assigned: HardAssignment[] = [];
  const remaining: chrome.tabs.Tab[] = [];
  for (const t of tabs) {
    const domain = extractDomain(t.url);
    const rule = domain ? byDomain.get(domain) : undefined;
    if (rule && t.id != null) assigned.push({ tabId: t.id, workspaceId: rule.workspaceId });
    else remaining.push(t);
  }
  return { assigned, remaining };
}
```

**Step 3: Tests pass; commit**

```powershell
git add extension/src/classifier/
git commit -m "feat(extension): hard-rule pass to short-circuit obvious tabs"
```

---

## Task 10: Prompt builder with hybrid few-shot injection

**Files:**
- Create: `extension/src/classifier/prompt.ts`
- Create: `extension/src/classifier/prompt.test.ts`

The builder takes: workspace list, hybrid examples (from sidecar), and the tab batch. Returns a system prompt + user prompt + a JSON schema for structured output.

**Step 1: Failing test (snapshot)**

```typescript
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
```

**Step 2: Implement `extension/src/classifier/prompt.ts`**

```typescript
import type { Workspace, Example } from '@symphony/shared';

export interface ClassifierTabIn {
  id: number;
  title?: string;
  url?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
  responseSchema: object;
}

export function buildClassifierPrompt(args: {
  workspaces: Workspace[];
  examples: Example[];
  tabs: ClassifierTabIn[];
}): BuiltPrompt {
  const workspaceList = args.workspaces
    .map(w => `- ${w.id} ("${w.label}")`)
    .join('\n');

  const examplesBlock = args.examples.length
    ? `\n\nPast corrections (the user previously overrode the model — match their taste):\n${
        args.examples
          .map(e => `- ${e.url} → action=${e.userChoseAction}, workspace=${e.userChoseWorkspaceId ?? 'null'} (model had suggested ${e.modelSuggestedWorkspaceId ?? 'null'})`)
          .join('\n')
      }`
    : '';

  const system = [
    'You sort browser tabs into Vivaldi workspaces or mark them as junk to close.',
    'Available workspaces:',
    workspaceList,
    'Available actions: "move" (to a workspace), "close" (junk), "keep" (leave where it is).',
    'For each tab return tabId, action, workspace (workspace id or null), confidence 0..1, and a one-line reason.',
    'Be conservative with "close": only suggest it for tabs that are clearly trash.',
    examplesBlock,
  ].join('\n');

  const user = [
    'Classify these tabs. Respond as JSON matching the provided schema:',
    JSON.stringify(args.tabs, null, 2),
  ].join('\n');

  const responseSchema = {
    type: 'array',
    items: {
      type: 'object',
      required: ['tabId', 'action', 'confidence', 'reason'],
      properties: {
        tabId: { type: 'integer' },
        action: { type: 'string', enum: ['move', 'close', 'keep'] },
        workspace: { type: ['string', 'null'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string' },
      },
    },
  };

  return { system, user, responseSchema };
}
```

**Step 3: Tests pass; commit**

```powershell
git add extension/src/classifier/prompt.ts extension/src/classifier/prompt.test.ts
git commit -m "feat(extension): classifier prompt builder with hybrid few-shot"
```

---

## Task 11: Classifier — call LLM, parse, validate

**Files:**
- Create: `extension/src/classifier/classify.ts`
- Create: `extension/src/classifier/classify.test.ts`

**Step 1: Failing test (mocks the inherited LLM adapter)**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { classifyTabs } from './classify.js';
import type { Workspace } from '@symphony/shared';

const workspaces: Workspace[] = [{ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 }];
const tabs = [{ id: 10, title: 't', url: 'https://example.com' }];

describe('classifyTabs', () => {
  it('parses a valid model response', async () => {
    const llm = vi.fn().mockResolvedValue(JSON.stringify([
      { tabId: 10, action: 'move', workspace: 'ws-1', confidence: 0.9, reason: 'example.com → work' },
    ]));
    const out = await classifyTabs({ workspaces, examples: [], tabs }, { call: llm });
    expect(out[0].action).toBe('move');
  });
  it('retries once on malformed JSON, then defaults unclassified to keep', async () => {
    const llm = vi.fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce('still not json');
    const out = await classifyTabs({ workspaces, examples: [], tabs }, { call: llm });
    expect(llm).toHaveBeenCalledTimes(2);
    expect(out).toEqual([{ tabId: 10, action: 'keep', workspace: null, confidence: 0, reason: 'model output unparseable; defaulted to keep' }]);
  });
});
```

**Step 2: Implement `extension/src/classifier/classify.ts`**

```typescript
import { z } from 'zod';
import { ActionSchema, type Workspace, type Example } from '@symphony/shared';
import { buildClassifierPrompt, type ClassifierTabIn } from './prompt.js';

const ResultRow = z.object({
  tabId: z.number().int(),
  action: ActionSchema,
  workspace: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type ClassifierRow = z.infer<typeof ResultRow>;

export interface LLM {
  call(args: { system: string; user: string; responseSchema: object }): Promise<string>;
}

export async function classifyTabs(
  input: { workspaces: Workspace[]; examples: Example[]; tabs: ClassifierTabIn[] },
  llm: LLM,
): Promise<ClassifierRow[]> {
  const prompt = buildClassifierPrompt(input);
  const tryOnce = async () => {
    const raw = await llm.call(prompt);
    return z.array(ResultRow).parse(JSON.parse(raw));
  };
  try { return await tryOnce(); }
  catch {
    try { return await tryOnce(); }
    catch {
      return input.tabs.map(t => ({ tabId: t.id, action: 'keep' as const, workspace: null, confidence: 0, reason: 'model output unparseable; defaulted to keep' }));
    }
  }
}
```

**Step 3: Tests pass; commit**

```powershell
git add extension/src/classifier/classify.ts extension/src/classifier/classify.test.ts
git commit -m "feat(extension): classifier with single retry and keep-on-failure"
```

---

## Task 12: Orchestrator — gather → hard rules → LLM → plan

**Files:**
- Create: `extension/src/background/orchestrator.ts`
- Create: `extension/src/background/orchestrator.test.ts`
- Modify: `extension/src/background/<existing entry>.ts` to register the message handler that triggers the orchestrator

**Step 1: Failing test**

The orchestrator is a pure function over injected deps, so the test is fast and DOM-less. Deps to inject:

- `getTabs(): Promise<chrome.tabs.Tab[]>`
- `rulesCache: RulesCache`
- `sidecar: SidecarClient`
- `llm: LLM`

Test that:
- Hard-rule-matched tabs appear in the plan with `source: 'rule'`.
- Other tabs are batched to the model and their results appear with `source: 'model'`.
- When sidecar is unreachable but cache has rules, we still produce a plan (skipping the few-shot block) and flag `learningPaused: true`.

(Write 3 `it()` blocks following that shape.)

**Step 2: Implement `extension/src/background/orchestrator.ts`**

```typescript
import type { Workspace } from '@symphony/shared';
import { applyHardRules } from '../classifier/hard-rules.js';
import { classifyTabs, type ClassifierRow, type LLM } from '../classifier/classify.js';
import { SidecarClient, SidecarUnreachable } from '../lib/sidecar/client.js';
import { RulesCache } from '../lib/sidecar/rules-cache.js';

export interface PlanRow {
  tabId: number;
  action: 'move' | 'close' | 'keep';
  workspaceId: string | null;
  confidence: number;
  reason: string;
  source: 'rule' | 'model';
}

export interface Plan {
  rows: PlanRow[];
  workspaces: Workspace[];
  learningPaused: boolean;
}

export interface OrchestratorDeps {
  getTabs(): Promise<chrome.tabs.Tab[]>;
  sidecar: SidecarClient;
  rulesCache: RulesCache;
  llm: LLM;
}

export async function buildPlan(deps: OrchestratorDeps): Promise<Plan> {
  const tabs = await deps.getTabs();

  let rules; let workspaces: Workspace[]; let learningPaused = false; let examples = [] as Awaited<ReturnType<SidecarClient['listExamplesHybrid']>>;
  try {
    [rules, workspaces] = await Promise.all([deps.sidecar.listRules(), deps.sidecar.listWorkspaces()]);
    await deps.rulesCache.write(rules);
  } catch (e) {
    if (!(e instanceof SidecarUnreachable)) throw e;
    rules = await deps.rulesCache.read();
    workspaces = []; // we have no fresh list; UI will warn
    learningPaused = true;
  }

  const { assigned, remaining } = applyHardRules(tabs, rules);

  // hybrid few-shot for remaining domains
  if (!learningPaused) {
    const remainingDomains = [...new Set(remaining.map(t => (t.url ? new URL(t.url).hostname : '')).filter(Boolean))].slice(0, 10);
    try {
      examples = await deps.sidecar.listExamplesHybrid({ recent: 5, domains: remainingDomains });
    } catch (e) {
      if (!(e instanceof SidecarUnreachable)) throw e;
      learningPaused = true;
    }
  }

  const modelRows: ClassifierRow[] = remaining.length
    ? await classifyTabs({ workspaces, examples, tabs: remaining.map(t => ({ id: t.id!, title: t.title, url: t.url })) }, deps.llm)
    : [];

  const rows: PlanRow[] = [
    ...assigned.map(a => ({ tabId: a.tabId, action: 'move' as const, workspaceId: a.workspaceId, confidence: 1, reason: 'matched a hard rule', source: 'rule' as const })),
    ...modelRows.map(m => ({ tabId: m.tabId, action: m.action, workspaceId: m.workspace, confidence: m.confidence, reason: m.reason, source: 'model' as const })),
  ];

  return { rows, workspaces, learningPaused };
}
```

**Step 3: Wire a message handler in the background entry** so the side panel can trigger `buildPlan` and receive the result. Use `chrome.runtime.onMessage`.

**Step 4: Tests pass; commit**

```powershell
git add extension/src/background/orchestrator.ts extension/src/background/orchestrator.test.ts extension/src/background/
git commit -m "feat(extension): plan orchestrator with sidecar-down fallback"
```

---

## Task 13: First-run workspace onboarding UI

**Files:**
- Create: `extension/src/sidepanel/Onboarding.tsx`
- Create: `extension/src/sidepanel/Onboarding.test.tsx`
- Modify: `extension/src/sidepanel/<entry>.tsx` to render Onboarding when no workspaces exist in the sidecar

**Step 1: Failing test (React Testing Library)**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Onboarding } from './Onboarding.js';

describe('Onboarding', () => {
  it('lists discovered workspaceIds and posts each label on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Onboarding discoveredIds={[100, 200]} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Label for workspace 100'), { target: { value: 'Work' } });
    fireEvent.change(screen.getByLabelText('Label for workspace 200'), { target: { value: 'Reading' } });
    fireEvent.click(screen.getByText('Save'));
    await new Promise(r => setTimeout(r, 0));
    expect(onSave).toHaveBeenCalledWith([
      { vivaldiWorkspaceId: 100, label: 'Work' },
      { vivaldiWorkspaceId: 200, label: 'Reading' },
    ]);
  });
});
```

**Step 2: Implement `Onboarding.tsx`**

A minimal Tailwind form: one labeled `<input>` per discovered ID, a Save button that calls `onSave`. Skip empty labels.

**Step 3: Wire to side-panel entry** so that:
- On open, call `sidecar.listWorkspaces()`.
- If empty, run `discoverWorkspaces(currentWindowTabs)`, render `<Onboarding>`. On save, POST each label and reload.
- Otherwise, render the main review panel (Task 14).

**Step 4: Tests pass; commit**

```powershell
git add extension/src/sidepanel/Onboarding.tsx extension/src/sidepanel/Onboarding.test.tsx extension/src/sidepanel/
git commit -m "feat(extension): first-run workspace onboarding"
```

---

## Task 14: Review panel — buckets + per-tab controls

**Files:**
- Create: `extension/src/sidepanel/ReviewPanel.tsx`
- Create: `extension/src/sidepanel/ReviewPanel.test.tsx`
- Create: `extension/src/sidepanel/usePlan.ts` (hook around `chrome.runtime.sendMessage`)
- Modify: side-panel entry

The panel takes a `Plan` and lets the user (a) reassign each tab's workspace via a dropdown, (b) toggle include/exclude, (c) click Apply.

**Step 1: Failing tests**

Cover:
- Renders one bucket per workspace plus a "Close (junk)" bucket plus a "Keep" bucket.
- Low-confidence `close` rows render with their checkbox **unchecked** by default. High-confidence ones — also unchecked (we never auto-check close). Move rows are pre-checked.
- Pinned tabs are never pre-checked for close (test by passing `pinned: true` rows).
- Changing the workspace dropdown calls `onChangeRow` with the new workspaceId.
- Clicking Apply calls `onApply` with only the included rows.

**Step 2: Implement `ReviewPanel.tsx`**

Use Tailwind grid; one column per bucket. Group rows by `workspaceId` (or by `action === 'close'`). Each row: tab title + URL + reason, a `<select>` for workspace, a checkbox. Apply button at the top.

**Step 3: Implement `usePlan` hook**

```typescript
import { useEffect, useState } from 'react';
import type { Plan } from '../background/orchestrator.js';

export function usePlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    setLoading(true); setError(null);
    try {
      const p = await chrome.runtime.sendMessage({ kind: 'build-plan' });
      setPlan(p);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  return { plan, loading, error, refresh };
}
```

**Step 4: Tests pass; commit**

```powershell
git add extension/src/sidepanel/ReviewPanel.tsx extension/src/sidepanel/ReviewPanel.test.tsx extension/src/sidepanel/usePlan.ts extension/src/sidepanel/
git commit -m "feat(extension): review panel with bucket grouping and per-row controls"
```

---

## Task 15: Slide-in panel + chip-fly animation

**Files:**
- Modify: `extension/src/sidepanel/ReviewPanel.tsx`
- Add dep: `framer-motion` (in `extension/package.json` deps)

**Step 1: Install framer-motion**

In `extension/package.json` deps add `"framer-motion": "^11.0.0"`. Then root `npm install`.

**Step 2: Wrap the panel in a slide-in `motion.div`** and each chip in a `motion.li` with `layout` + initial `{ opacity: 0, x: 20 }` → animate `{ opacity: 1, x: 0 }`.

Animation is decorative; the only assertion is that the page renders without crashing. A snapshot test that walks the DOM and confirms it has the expected bucket count is enough.

**Step 3: Build and visually verify in Vivaldi**

Run: `npm run build:extension`, reload, open the panel, watch the animation.

**Step 4: Commit**

```powershell
git add extension/src/sidepanel/ReviewPanel.tsx extension/package.json package-lock.json
git commit -m "feat(extension): slide-in panel and chip-fly animation"
```

---

## Task 16: Apply module — moves, closes, learning

**Files:**
- Create: `extension/src/apply/apply.ts`
- Create: `extension/src/apply/apply.test.ts`

The apply module takes the final user-approved rows and:
1. For each `move` row: call `setTabWorkspace`.
2. For each `close` row: call `chrome.tabs.remove`.
3. For each row whose workspace differs from what the model suggested OR whose action differs: `sidecar.createExample(...)`.
4. Per domain, count corrections in the last batch; if total same-domain corrections (across all batches) for the same target workspace hits **3**, call `sidecar.createRule({ domain, workspaceId, ... })`. To know the running total we count examples returned by `listExamplesHybrid({ domains: [domain], recent: 100 })` filtered to `userChoseAction === 'move'` and same workspace.
5. Return `{ moved, closed, examplesRecorded, rulesPromoted, failures }`.

**Step 1: Failing tests** — write tests for each of the above behaviors. Mock `chrome.tabs.update`/`remove`, `SidecarClient`. Important cases:
- Skips writing to sidecar when `learningPaused: true`.
- `vivExtData` write rejecting on one tab does NOT block other tabs (catch per-tab; record in `failures`).
- Promotion only triggers at threshold ≥ 3 same-domain same-workspace `move` corrections.

**Step 2: Implement** following the test contract. Promotion logic:

```typescript
async function maybePromote(client: SidecarClient, domain: string, workspaceId: string) {
  const history = await client.listExamplesHybrid({ recent: 100, domains: [domain] });
  const sameWs = history.filter(e => e.userChoseAction === 'move' && e.userChoseWorkspaceId === workspaceId);
  if (sameWs.length >= 3) {
    try {
      await client.createRule({
        id: `r-${domain}`,
        domain,
        workspaceId,
        hitCount: 0,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // domain may already have a rule — swallow conflict
    }
  }
}
```

**Step 3: Wire Apply button** in `ReviewPanel.tsx` to call the apply module and refresh `usePlan` afterwards.

**Step 4: Tests pass; commit**

```powershell
git add extension/src/apply/
git commit -m "feat(extension): apply module — moves, closes, learning, rule promotion"
```

---

## Task 17: Safety-net integration tests

**Files:**
- Create: `extension/src/background/safety.test.ts`

End-to-end-ish tests in jsdom that combine real orchestrator + apply module against in-memory fake `chrome.tabs` and an `msw` sidecar to confirm the safety guarantees from the design doc:

1. **Model unreachable** (LLM throws) → orchestrator surfaces an error and the apply module is never called. No tab writes.
2. **Sidecar unreachable on plan-build** → plan still produced from cached rules; `learningPaused: true`. After apply, no `POST /v1/examples` is attempted.
3. **One tab's `vivExtData` write fails** → other tabs still move; failure recorded in result.

Write three `it()` blocks. Commit:

```powershell
git add extension/src/background/safety.test.ts
git commit -m "test(extension): safety-net coverage (model down, sidecar down, partial failure)"
```

---

## Task 18: Manual end-to-end checklist in Vivaldi

**Files:** none modified.

This is the only manual step in this plan. Do not automate.

**Prep:** sidecar running (`npm run dev:sidecar`), extension built (`npm run build:extension`), Vivaldi loaded unpacked, ~30 messy tabs open across 2–3 workspaces.

**Checklist:**

1. Open the side panel. Onboarding screen lists each discovered workspaceId; label them and Save.
2. Trigger "Sort". Wait for the plan. Confirm:
   - Tabs that match no rule are bucketed by the model.
   - Reasons are present and look sensible.
   - No `close` action is pre-checked.
   - Pinned/active tabs are not pre-checked for close.
3. Reassign one tab's workspace via the dropdown. Uncheck one close. Click Apply.
4. Confirm:
   - Approved moves landed in the right Vivaldi workspaces.
   - Approved closes are gone.
   - Unchecked closes are still open.
5. Repeat step 2–4 two more times with the same correction on the same domain. On the third correction, run `curl http://127.0.0.1:8765/v1/rules` and confirm a new rule for that domain exists.
6. Stop the sidecar. Open the panel again, click Sort. Confirm a banner says "learning paused" and rules-cached tabs still sort.

If anything diverges, file an issue and fix before claiming the plan complete.

---

## Task 19: Final verification sweep

**Files:** none modified.

@superpowers:verification-before-completion. Run, capturing output:

1. `git status` → clean.
2. `npm install` → ok.
3. `npm run test:shared` → pass.
4. `npm run test:sidecar` → pass.
5. `npm run test:extension` → pass (including new suites).
6. `npm run build:extension` → builds.
7. `npm run test:smoke` → pass.
8. Manual checklist (Task 18) → green.

Only then mark this plan complete.

---

## Done criteria

- Side panel opens, runs onboarding on first launch, then shows a slide-in review panel grouping tabs into workspace buckets + a "Close (junk)" bucket.
- Hard rules from the sidecar short-circuit obvious tabs before the model is called.
- Model is called with a hybrid few-shot prompt (top-5 recent + top-5 domain-matched corrections).
- Apply executes only approved rows, records corrections to the sidecar, promotes domains to hard rules at 3 same-workspace `move` corrections.
- Safety nets pass: model down → zero writes; sidecar down → cached rules + learning paused; per-tab failures don't block others.
- All test suites green; manual checklist green.

## What this plan does NOT do

- Multi-machine sync, browser-store publication, LoRA / fine-tuning.
- A "history" or "undo" view.
- Customizing the LLM provider via UI beyond what TabBrain's existing options screen already offers — we just consume that.
- Background "auto-sort on tab open." Sorting only happens when the user clicks the toolbar button.

## Handoff

After Plan 3 ships, the v1 experience from the design doc is complete. Likely follow-ups, not part of this plan:

- Tray-app or service wrapper for the sidecar so the user doesn't keep a terminal open.
- Auth tightening (rotate `SIDECAR_TOKEN`, store in OS keychain).
- Postgres swap behind Drizzle for multi-machine sync.
- A `/v1/stats` endpoint and a tiny dashboard showing rule hit-count trends.
