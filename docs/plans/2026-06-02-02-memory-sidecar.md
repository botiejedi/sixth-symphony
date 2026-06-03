# Plan 2 — Memory Sidecar Service

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up a local HTTP service that owns the source of truth for the AI tab sorter's learned memory — workspaces, hard rules, and few-shot examples — so the extension and any other local service can read and write it.

**Architecture:** Hono HTTP server bound to `127.0.0.1`, backed by SQLite in WAL mode via Drizzle ORM. Three resources — `/v1/workspaces`, `/v1/rules`, `/v1/examples` — each with full CRUD plus a hybrid ranking query for examples. Shared TypeScript types live in `shared/` and are imported by both the sidecar and the extension. Zod validates every request body; an env-flagged no-op auth middleware sits in front for future tightening.

**Tech Stack:** TypeScript 5, Hono, Drizzle ORM, `better-sqlite3`, Zod, Vitest, `tsx` for dev. Node 20+.

**Prerequisites:** Plan 1 (`docs/plans/2026-06-02-01-fork-setup.md`) is complete — repo is a working npm workspaces monorepo with `extension/`, `sidecar/`, `shared/` stubbed.

**Conventions:**
- Run npm commands from the repo root using `--workspace` flags unless a step explicitly says otherwise.
- TDD: write the failing test, run it to confirm the failure mode, write the minimal code, run it green, commit. See @superpowers:test-driven-development.
- Verification: @superpowers:verification-before-completion — run every command shown and confirm output matches before claiming success.
- Commits: small and frequent, one per passing step.

---

## Task 1: `shared/` — bootstrap and add Zod schemas for the core types

**Files:**
- Modify: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/index.ts`
- Create: `shared/src/types.ts`
- Create: `shared/src/types.test.ts`
- Create: `shared/vitest.config.ts`

**Step 1: Update `shared/package.json`**

Replace its contents:

```json
{
  "name": "@symphony/shared",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Add `shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": false
  },
  "include": ["src/**/*"]
}
```

**Step 3: Add `shared/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

**Step 4: Write the failing test `shared/src/types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { WorkspaceSchema, RuleSchema, ExampleSchema } from './types.js';

describe('WorkspaceSchema', () => {
  it('accepts a valid workspace', () => {
    const v = WorkspaceSchema.parse({ id: 'ws-12345', label: 'Work', vivaldiWorkspaceId: 12345 });
    expect(v.label).toBe('Work');
  });
  it('rejects empty label', () => {
    expect(() => WorkspaceSchema.parse({ id: 'ws-1', label: '', vivaldiWorkspaceId: 1 })).toThrow();
  });
});

describe('RuleSchema', () => {
  it('accepts a valid domain rule', () => {
    const r = RuleSchema.parse({ id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 5, createdAt: '2026-06-02T00:00:00.000Z' });
    expect(r.domain).toBe('github.com');
  });
  it('rejects a domain with a scheme', () => {
    expect(() => RuleSchema.parse({ id: 'r-1', domain: 'https://github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' })).toThrow();
  });
});

describe('ExampleSchema', () => {
  it('accepts a valid correction example', () => {
    const e = ExampleSchema.parse({
      id: 'e-1',
      domain: 'news.ycombinator.com',
      title: 'Show HN: ...',
      url: 'https://news.ycombinator.com/item?id=1',
      modelSuggestedWorkspaceId: 'ws-2',
      userChoseWorkspaceId: 'ws-3',
      userChoseAction: 'move',
      createdAt: '2026-06-02T00:00:00.000Z',
    });
    expect(e.userChoseAction).toBe('move');
  });
  it('rejects an invalid action', () => {
    expect(() => ExampleSchema.parse({
      id: 'e-1', domain: 'x.com', title: 't', url: 'https://x.com',
      modelSuggestedWorkspaceId: 'ws-1', userChoseWorkspaceId: 'ws-2',
      userChoseAction: 'banish', createdAt: '2026-06-02T00:00:00.000Z',
    })).toThrow();
  });
});
```

**Step 5: Run the test — expect failure**

Run: `npm --workspace shared install`
Then: `npm --workspace shared run test -- --run`
Expected: fails with "Cannot find module './types.js'" or similar — file doesn't exist yet.

**Step 6: Implement `shared/src/types.ts`**

```typescript
import { z } from 'zod';

export const ActionSchema = z.enum(['move', 'close', 'keep']);
export type Action = z.infer<typeof ActionSchema>;

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  vivaldiWorkspaceId: z.number(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

export const RuleSchema = z.object({
  id: z.string().min(1),
  domain: z.string().regex(domainRegex, 'domain must be a bare host like "github.com"'),
  workspaceId: z.string().min(1),
  hitCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const ExampleSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  title: z.string(),
  url: z.string().url(),
  modelSuggestedWorkspaceId: z.string().nullable(),
  userChoseWorkspaceId: z.string().nullable(),
  userChoseAction: ActionSchema,
  createdAt: z.string().datetime(),
});
export type Example = z.infer<typeof ExampleSchema>;
```

**Step 7: `shared/src/index.ts`**

```typescript
export * from './types.js';
```

**Step 8: Run the test — expect pass**

Run: `npm --workspace shared run test -- --run`
Expected: 6 tests pass.

**Step 9: Commit**

```powershell
git add shared/
git commit -m "feat(shared): add Workspace/Rule/Example Zod schemas + types"
```

---

## Task 2: `sidecar/` — bootstrap workspace

**Files:**
- Modify: `sidecar/package.json`
- Create: `sidecar/tsconfig.json`
- Create: `sidecar/vitest.config.ts`
- Create: `sidecar/src/index.ts` (entry stub)
- Modify: root `package.json` (add scripts)

**Step 1: Replace `sidecar/package.json`**

```json
{
  "name": "@symphony/sidecar",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "@symphony/shared": "*",
    "better-sqlite3": "^11.3.0",
    "drizzle-orm": "^0.36.0",
    "hono": "^4.6.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@hono/node-server": "^1.13.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.16.0",
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 2: Add `sidecar/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": false,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Add `sidecar/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
  },
});
```

**Step 4: Add minimal entry `sidecar/src/index.ts`** (real server arrives in Task 5)

```typescript
console.log('sidecar entry — replaced in Task 5');
```

**Step 5: Add scripts to root `package.json` `scripts` block**

```json
    "dev:sidecar": "npm --workspace sidecar run dev",
    "test:sidecar": "npm --workspace sidecar run test -- --run",
    "test:shared": "npm --workspace shared run test -- --run"
```

**Step 6: Install**

Run: `npm install`
Expected: installs the new deps, links `@symphony/shared` into `sidecar/`.

**Step 7: Confirm `@symphony/shared` is reachable from sidecar**

Quick sanity script — append temporarily to `sidecar/src/index.ts`:

```typescript
import { WorkspaceSchema } from '@symphony/shared';
console.log(WorkspaceSchema.shape);
```

Run: `npm --workspace sidecar run start`
Expected: prints the Zod shape object then exits.

Revert `sidecar/src/index.ts` to the single `console.log` line before committing.

**Step 8: Commit**

```powershell
git add sidecar/package.json sidecar/tsconfig.json sidecar/vitest.config.ts sidecar/src/index.ts package.json package-lock.json
git commit -m "feat(sidecar): bootstrap workspace, deps, scripts"
```

(`.gitkeep` from Plan 1 can be removed in this commit if it still exists — `git rm sidecar/.gitkeep`.)

---

## Task 3: SQLite + Drizzle schema and migration runner

**Files:**
- Create: `sidecar/drizzle.config.ts`
- Create: `sidecar/src/db/schema.ts`
- Create: `sidecar/src/db/client.ts`
- Create: `sidecar/src/db/migrate.ts`
- Create: `sidecar/src/db/client.test.ts`
- Create: `sidecar/drizzle/` (generated by `db:generate`)

**Step 1: Write `sidecar/src/db/schema.ts`**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  vivaldiWorkspaceId: integer('vivaldi_workspace_id').notNull(),
});

export const rules = sqliteTable('rules', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  hitCount: integer('hit_count').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const examples = sqliteTable('examples', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  modelSuggestedWorkspaceId: text('model_suggested_workspace_id'),
  userChoseWorkspaceId: text('user_chose_workspace_id'),
  userChoseAction: text('user_chose_action').notNull(),
  createdAt: text('created_at').notNull(),
});
```

**Step 2: Write `sidecar/drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
```

**Step 3: Generate the initial migration**

Run: `npm --workspace sidecar run db:generate`
Expected: creates `sidecar/drizzle/0000_*.sql` and a meta file.

**Step 4: Write `sidecar/src/db/client.ts`**

```typescript
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

export type DB = BetterSQLite3Database<typeof schema>;

export function openDb(dbPath: string): { db: DB; close: () => void } {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return {
    db,
    close: () => sqlite.close(),
  };
}

export function runMigrations(db: DB): void {
  const here = fileURLToPath(new URL('.', import.meta.url));
  migrate(db, { migrationsFolder: resolve(here, '../../drizzle') });
}
```

**Step 5: Write `sidecar/src/db/migrate.ts`** (CLI entry)

```typescript
import { openDb, runMigrations } from './client.js';

const path = process.env.SIDECAR_DB_PATH ?? 'memory.db';
const { db, close } = openDb(path);
runMigrations(db);
close();
console.log(`migrated ${path}`);
```

**Step 6: Write the failing test `sidecar/src/db/client.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { openDb, runMigrations } from './client.js';

describe('openDb', () => {
  it('opens an in-memory DB in WAL mode and applies migrations', () => {
    const { db, close } = openDb(':memory:');
    runMigrations(db);
    // Confirm the three tables exist by selecting against them — should return [].
    expect(db.select().from((await import('./schema.js')).workspaces).all()).toEqual([]);
    expect(db.select().from((await import('./schema.js')).rules).all()).toEqual([]);
    expect(db.select().from((await import('./schema.js')).examples).all()).toEqual([]);
    close();
  });
});
```

(Note: top-level `await` inside `expect` reads ugly. Refactor to a clean import:)

```typescript
import { describe, it, expect } from 'vitest';
import { openDb, runMigrations } from './client.js';
import { workspaces, rules, examples } from './schema.js';

describe('openDb', () => {
  it('opens a DB and applies migrations', () => {
    const { db, close } = openDb(':memory:');
    runMigrations(db);
    expect(db.select().from(workspaces).all()).toEqual([]);
    expect(db.select().from(rules).all()).toEqual([]);
    expect(db.select().from(examples).all()).toEqual([]);
    close();
  });
});
```

**Step 7: Run test — expect pass**

Run: `npm --workspace sidecar run test -- --run`
Expected: 1 test, passing. If `:memory:` does not retain WAL journal mode that's fine — the assertions check schema, not pragma state.

**Step 8: Commit**

```powershell
git add sidecar/drizzle.config.ts sidecar/drizzle/ sidecar/src/db/
git commit -m "feat(sidecar): drizzle schema, migrations, client"
```

---

## Task 4: Repository layer (pure DB queries, no HTTP)

**Files:**
- Create: `sidecar/src/db/repo.ts`
- Create: `sidecar/src/db/repo.test.ts`

We split the repo layer out from HTTP handlers so it can be unit-tested without spinning up an HTTP server.

**Step 1: Write failing tests `sidecar/src/db/repo.test.ts`**

Cover:

- `createWorkspace` then `listWorkspaces` returns it.
- `getWorkspace` returns null for unknown id.
- `updateWorkspace` changes the label.
- `deleteWorkspace` removes it.
- `createRule` rejects when the `workspaceId` foreign key doesn't exist (better-sqlite3 throws).
- `createRule` rejects a duplicate domain.
- `incrementRuleHitCount` bumps `hitCount`.
- `createExample` + `listRecentExamples(n)` returns most-recent first.
- `listExamplesByDomain(domain, n)` filters and limits.

Each test uses a fresh in-memory DB via a `beforeEach` hook calling `openDb(':memory:')` + `runMigrations`.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, runMigrations, type DB } from './client.js';
import * as repo from './repo.js';

let db: DB;
let close: () => void;

beforeEach(() => {
  const opened = openDb(':memory:');
  db = opened.db;
  close = opened.close;
  runMigrations(db);
});

describe('workspaces', () => {
  it('round-trips create → list', () => {
    repo.createWorkspace(db, { id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 100 });
    expect(repo.listWorkspaces(db)).toEqual([{ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 100 }]);
  });
  it('returns null for unknown id', () => {
    expect(repo.getWorkspace(db, 'nope')).toBeNull();
  });
  it('updates label', () => {
    repo.createWorkspace(db, { id: 'ws-1', label: 'Old', vivaldiWorkspaceId: 1 });
    repo.updateWorkspace(db, 'ws-1', { label: 'New' });
    expect(repo.getWorkspace(db, 'ws-1')?.label).toBe('New');
  });
  it('deletes', () => {
    repo.createWorkspace(db, { id: 'ws-1', label: 'X', vivaldiWorkspaceId: 1 });
    repo.deleteWorkspace(db, 'ws-1');
    expect(repo.listWorkspaces(db)).toEqual([]);
  });
});

describe('rules', () => {
  beforeEach(() => {
    repo.createWorkspace(db, { id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 });
  });
  it('round-trips create → list', () => {
    repo.createRule(db, { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' });
    expect(repo.listRules(db)).toHaveLength(1);
  });
  it('rejects duplicate domain', () => {
    repo.createRule(db, { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' });
    expect(() =>
      repo.createRule(db, { id: 'r-2', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' }),
    ).toThrow();
  });
  it('rejects unknown workspaceId', () => {
    expect(() =>
      repo.createRule(db, { id: 'r-x', domain: 'gitlab.com', workspaceId: 'ws-missing', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' }),
    ).toThrow();
  });
  it('increments hitCount', () => {
    repo.createRule(db, { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' });
    repo.incrementRuleHitCount(db, 'github.com');
    repo.incrementRuleHitCount(db, 'github.com');
    expect(repo.getRuleByDomain(db, 'github.com')?.hitCount).toBe(2);
  });
});

describe('examples', () => {
  it('returns recent first', () => {
    repo.createExample(db, { id: 'e-1', domain: 'a.com', title: 'a', url: 'https://a.com', modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep', createdAt: '2026-06-01T00:00:00.000Z' });
    repo.createExample(db, { id: 'e-2', domain: 'b.com', title: 'b', url: 'https://b.com', modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep', createdAt: '2026-06-02T00:00:00.000Z' });
    const recent = repo.listRecentExamples(db, 5);
    expect(recent.map(e => e.id)).toEqual(['e-2', 'e-1']);
  });
  it('filters by domain and limits', () => {
    for (let i = 0; i < 7; i++) {
      repo.createExample(db, { id: `e-${i}`, domain: 'a.com', title: 't', url: 'https://a.com', modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep', createdAt: `2026-06-0${i + 1}T00:00:00.000Z` });
    }
    repo.createExample(db, { id: 'other', domain: 'b.com', title: 't', url: 'https://b.com', modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep', createdAt: '2026-06-09T00:00:00.000Z' });
    const filtered = repo.listExamplesByDomain(db, 'a.com', 3);
    expect(filtered).toHaveLength(3);
    expect(filtered.every(e => e.domain === 'a.com')).toBe(true);
  });
});
```

**Step 2: Run — expect fail**

Run: `npm --workspace sidecar run test -- --run`
Expected: cannot find `./repo.js`.

**Step 3: Implement `sidecar/src/db/repo.ts`**

```typescript
import { eq, desc, sql } from 'drizzle-orm';
import type { DB } from './client.js';
import { workspaces, rules, examples } from './schema.js';
import type { Workspace, Rule, Example } from '@symphony/shared';

// Workspaces -----------------------------------------------------------------
export function createWorkspace(db: DB, w: Workspace): void {
  db.insert(workspaces).values(w).run();
}
export function listWorkspaces(db: DB): Workspace[] {
  return db.select().from(workspaces).all();
}
export function getWorkspace(db: DB, id: string): Workspace | null {
  const row = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  return row ?? null;
}
export function updateWorkspace(db: DB, id: string, patch: Partial<Omit<Workspace, 'id'>>): void {
  db.update(workspaces).set(patch).where(eq(workspaces.id, id)).run();
}
export function deleteWorkspace(db: DB, id: string): void {
  db.delete(workspaces).where(eq(workspaces.id, id)).run();
}

// Rules ----------------------------------------------------------------------
export function createRule(db: DB, r: Rule): void {
  db.insert(rules).values(r).run();
}
export function listRules(db: DB): Rule[] {
  return db.select().from(rules).all();
}
export function getRule(db: DB, id: string): Rule | null {
  const row = db.select().from(rules).where(eq(rules.id, id)).get();
  return row ?? null;
}
export function getRuleByDomain(db: DB, domain: string): Rule | null {
  const row = db.select().from(rules).where(eq(rules.domain, domain)).get();
  return row ?? null;
}
export function updateRule(db: DB, id: string, patch: Partial<Omit<Rule, 'id'>>): void {
  db.update(rules).set(patch).where(eq(rules.id, id)).run();
}
export function deleteRule(db: DB, id: string): void {
  db.delete(rules).where(eq(rules.id, id)).run();
}
export function incrementRuleHitCount(db: DB, domain: string): void {
  db.update(rules).set({ hitCount: sql`${rules.hitCount} + 1` }).where(eq(rules.domain, domain)).run();
}

// Examples -------------------------------------------------------------------
export function createExample(db: DB, e: Example): void {
  db.insert(examples).values(e).run();
}
export function listExamples(db: DB): Example[] {
  return db.select().from(examples).all();
}
export function getExample(db: DB, id: string): Example | null {
  const row = db.select().from(examples).where(eq(examples.id, id)).get();
  return row ?? null;
}
export function deleteExample(db: DB, id: string): void {
  db.delete(examples).where(eq(examples.id, id)).run();
}
export function listRecentExamples(db: DB, n: number): Example[] {
  return db.select().from(examples).orderBy(desc(examples.createdAt)).limit(n).all();
}
export function listExamplesByDomain(db: DB, domain: string, n: number): Example[] {
  return db.select().from(examples).where(eq(examples.domain, domain)).orderBy(desc(examples.createdAt)).limit(n).all();
}
```

**Step 4: Run tests — expect pass**

Run: `npm --workspace sidecar run test -- --run`
Expected: all 11+ assertions pass.

**Step 5: Commit**

```powershell
git add sidecar/src/db/repo.ts sidecar/src/db/repo.test.ts
git commit -m "feat(sidecar): pure repo layer for workspaces/rules/examples"
```

---

## Task 5: Hono app skeleton + `/v1/health`

**Files:**
- Replace: `sidecar/src/index.ts`
- Create: `sidecar/src/app.ts`
- Create: `sidecar/src/app.test.ts`

We split `app.ts` (testable Hono app) from `index.ts` (server bootstrap with port binding).

**Step 1: Failing test `sidecar/src/app.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';
import { openDb, runMigrations } from './db/client.js';

function freshApp() {
  const { db } = openDb(':memory:');
  runMigrations(db);
  return buildApp({ db });
}

describe('GET /v1/health', () => {
  it('returns 200 with ok:true', async () => {
    const app = freshApp();
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('404', () => {
  it('returns a JSON error envelope', async () => {
    const app = freshApp();
    const res = await app.request('/v1/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
  });
});
```

**Step 2: Run — expect fail**

Run: `npm --workspace sidecar run test -- --run`
Expected: `app.js` not found.

**Step 3: Implement `sidecar/src/app.ts`**

```typescript
import { Hono } from 'hono';
import type { DB } from './db/client.js';

export interface AppDeps {
  db: DB;
}

export function buildApp(deps: AppDeps) {
  const app = new Hono<{ Variables: { db: DB } }>();

  app.use('*', async (c, next) => {
    c.set('db', deps.db);
    await next();
  });

  app.get('/v1/health', (c) => c.json({ ok: true }));

  app.notFound((c) => c.json({ error: `not found: ${c.req.path}` }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message ?? 'internal error' }, 500);
  });

  return app;
}
```

**Step 4: Replace `sidecar/src/index.ts` with the real bootstrap**

```typescript
import { serve } from '@hono/node-server';
import { buildApp } from './app.js';
import { openDb, runMigrations } from './db/client.js';

const port = Number(process.env.SIDECAR_PORT ?? 8765);
const dbPath = process.env.SIDECAR_DB_PATH ?? 'memory.db';

const { db } = openDb(dbPath);
runMigrations(db);
const app = buildApp({ db });

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`sidecar listening on http://127.0.0.1:${info.port} (db: ${dbPath})`);
});
```

**Step 5: Run tests — expect pass**

Run: `npm --workspace sidecar run test -- --run`
Expected: health + 404 tests pass.

**Step 6: Run the dev server and curl it**

In one shell: `npm run dev:sidecar`
Expected: prints `sidecar listening on http://127.0.0.1:8765 (db: memory.db)`. (`memory.db` will be created in `sidecar/` — `.gitignore` covers it.)

In another shell: `curl http://127.0.0.1:8765/v1/health`
Expected: `{"ok":true}`.

Stop the dev server (Ctrl-C).

**Step 7: Commit**

```powershell
git add sidecar/src/app.ts sidecar/src/app.test.ts sidecar/src/index.ts
git commit -m "feat(sidecar): hono app + /v1/health + server bootstrap on 127.0.0.1"
```

---

## Task 6: `/v1/workspaces` CRUD

**Files:**
- Create: `sidecar/src/routes/workspaces.ts`
- Create: `sidecar/src/routes/workspaces.test.ts`
- Modify: `sidecar/src/app.ts` (mount the router)

**Step 1: Failing tests** — one route at a time, but write them all up front to keep the test file coherent:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { openDb, runMigrations } from '../db/client.js';

function freshApp() {
  const { db } = openDb(':memory:');
  runMigrations(db);
  return buildApp({ db });
}

describe('POST /v1/workspaces', () => {
  it('creates a workspace and returns it', async () => {
    const app = freshApp();
    const res = await app.request('/v1/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 100 }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 100 });
  });
  it('400 on invalid body', async () => {
    const app = freshApp();
    const res = await app.request('/v1/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: '', label: '', vivaldiWorkspaceId: 'oops' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/workspaces', () => {
  it('lists workspaces', async () => {
    const app = freshApp();
    await app.request('/v1/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 }) });
    const res = await app.request('/v1/workspaces');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 }]);
  });
});

describe('GET /v1/workspaces/:id', () => {
  it('returns workspace', async () => {
    const app = freshApp();
    await app.request('/v1/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 }) });
    const res = await app.request('/v1/workspaces/ws-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'ws-1' });
  });
  it('404 on unknown id', async () => {
    const app = freshApp();
    const res = await app.request('/v1/workspaces/nope');
    expect(res.status).toBe(404);
  });
});

describe('PUT /v1/workspaces/:id', () => {
  it('updates label', async () => {
    const app = freshApp();
    await app.request('/v1/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'ws-1', label: 'Old', vivaldiWorkspaceId: 1 }) });
    const res = await app.request('/v1/workspaces/ws-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'New' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).label).toBe('New');
  });
});

describe('DELETE /v1/workspaces/:id', () => {
  it('removes the workspace', async () => {
    const app = freshApp();
    await app.request('/v1/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'ws-1', label: 'X', vivaldiWorkspaceId: 1 }) });
    const res = await app.request('/v1/workspaces/ws-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    const after = await app.request('/v1/workspaces');
    expect(await after.json()).toEqual([]);
  });
});
```

**Step 2: Run — expect fail.**

**Step 3: Implement `sidecar/src/routes/workspaces.ts`**

```typescript
import { Hono } from 'hono';
import { WorkspaceSchema } from '@symphony/shared';
import { z } from 'zod';
import type { DB } from '../db/client.js';
import * as repo from '../db/repo.js';

const PatchSchema = WorkspaceSchema.partial().omit({ id: true });

export function workspacesRouter() {
  const r = new Hono<{ Variables: { db: DB } }>();

  r.get('/', (c) => c.json(repo.listWorkspaces(c.get('db'))));

  r.post('/', async (c) => {
    const parsed = WorkspaceSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    repo.createWorkspace(c.get('db'), parsed.data);
    return c.json(parsed.data, 201);
  });

  r.get('/:id', (c) => {
    const w = repo.getWorkspace(c.get('db'), c.req.param('id'));
    if (!w) return c.json({ error: 'not found' }, 404);
    return c.json(w);
  });

  r.put('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = repo.getWorkspace(c.get('db'), id);
    if (!existing) return c.json({ error: 'not found' }, 404);
    const parsed = PatchSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    repo.updateWorkspace(c.get('db'), id, parsed.data);
    return c.json(repo.getWorkspace(c.get('db'), id));
  });

  r.delete('/:id', (c) => {
    repo.deleteWorkspace(c.get('db'), c.req.param('id'));
    return c.body(null, 204);
  });

  return r;
}
```

**Step 4: Mount in `sidecar/src/app.ts`**

Add to `buildApp`, after the middleware that sets `db`, before `notFound`:

```typescript
import { workspacesRouter } from './routes/workspaces.js';
// ...
app.route('/v1/workspaces', workspacesRouter());
```

**Step 5: Run tests — expect pass.**

Run: `npm --workspace sidecar run test -- --run`

**Step 6: Commit**

```powershell
git add sidecar/src/routes/workspaces.ts sidecar/src/routes/workspaces.test.ts sidecar/src/app.ts
git commit -m "feat(sidecar): /v1/workspaces CRUD"
```

---

## Task 7: `/v1/rules` CRUD

**Files:**
- Create: `sidecar/src/routes/rules.ts`
- Create: `sidecar/src/routes/rules.test.ts`
- Modify: `sidecar/src/app.ts`

**Step 1: Failing tests `sidecar/src/routes/rules.test.ts`**

Mirror the workspaces shape with rule-specific cases:

- Create a workspace first (rules FK it).
- POST a rule → 201.
- POST a duplicate domain → 409 (we return a domain-conflict error).
- POST with unknown `workspaceId` → 400 (we validate before insert by looking up the workspace).
- GET list, GET by id, PUT (e.g. update `workspaceId`), DELETE.
- POST `/v1/rules/:domain/increment` → bumps `hitCount`.

(Write each `it()` block following the workspaces pattern. Include at least these six tests.)

**Step 2: Run — expect fail.**

**Step 3: Implement `sidecar/src/routes/rules.ts`**

Key differences from workspaces:

- Validate `workspaceId` exists before insert, return 400 with `error: "unknown workspaceId"` if not.
- Catch the SQLite unique-violation on `domain` and return 409.
- Add the `POST /:domain/increment` route calling `repo.incrementRuleHitCount`.

```typescript
import { Hono } from 'hono';
import { RuleSchema } from '@symphony/shared';
import type { DB } from '../db/client.js';
import * as repo from '../db/repo.js';

export function rulesRouter() {
  const r = new Hono<{ Variables: { db: DB } }>();

  r.get('/', (c) => c.json(repo.listRules(c.get('db'))));

  r.post('/', async (c) => {
    const parsed = RuleSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    const db = c.get('db');
    if (!repo.getWorkspace(db, parsed.data.workspaceId)) {
      return c.json({ error: 'unknown workspaceId' }, 400);
    }
    if (repo.getRuleByDomain(db, parsed.data.domain)) {
      return c.json({ error: 'domain already has a rule' }, 409);
    }
    repo.createRule(db, parsed.data);
    return c.json(parsed.data, 201);
  });

  r.get('/:id', (c) => {
    const rule = repo.getRule(c.get('db'), c.req.param('id'));
    if (!rule) return c.json({ error: 'not found' }, 404);
    return c.json(rule);
  });

  r.put('/:id', async (c) => {
    const id = c.req.param('id');
    const existing = repo.getRule(c.get('db'), id);
    if (!existing) return c.json({ error: 'not found' }, 404);
    const body = await c.req.json();
    const parsed = RuleSchema.partial().omit({ id: true }).safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    repo.updateRule(c.get('db'), id, parsed.data);
    return c.json(repo.getRule(c.get('db'), id));
  });

  r.delete('/:id', (c) => {
    repo.deleteRule(c.get('db'), c.req.param('id'));
    return c.body(null, 204);
  });

  r.post('/:domain/increment', (c) => {
    const domain = c.req.param('domain');
    if (!repo.getRuleByDomain(c.get('db'), domain)) {
      return c.json({ error: 'not found' }, 404);
    }
    repo.incrementRuleHitCount(c.get('db'), domain);
    return c.json(repo.getRuleByDomain(c.get('db'), domain));
  });

  return r;
}
```

**Step 4: Mount in `app.ts`** — `app.route('/v1/rules', rulesRouter());`

**Step 5: Tests pass; commit**

```powershell
git add sidecar/src/routes/rules.ts sidecar/src/routes/rules.test.ts sidecar/src/app.ts
git commit -m "feat(sidecar): /v1/rules CRUD + increment endpoint"
```

---

## Task 8: `/v1/examples` CRUD + hybrid ranking query

**Files:**
- Create: `sidecar/src/routes/examples.ts`
- Create: `sidecar/src/routes/examples.test.ts`
- Modify: `sidecar/src/app.ts`

The hybrid query is the only novel piece — it's what the extension's prompt builder calls per classifier batch. Contract:

```
GET /v1/examples?recent=5&domains=github.com,news.ycombinator.com
```

Returns up to `recent` most-recent examples *plus* up to `recent` per requested domain (de-duplicated by id), oldest-first within each domain section but newest-first overall. Cap response to (recent × (1 + domains.length)) rows.

**Step 1: Failing tests `sidecar/src/routes/examples.test.ts`**

- POST → 201 with body echo.
- GET list (no params) → all examples, recent first.
- GET `?recent=5` → top 5 by `createdAt desc`.
- GET `?recent=2&domains=a.com,b.com` → up to 2 most-recent overall + up to 2 most-recent for each of `a.com` and `b.com`, deduplicated.
- DELETE by id.

**Step 2: Implement `sidecar/src/routes/examples.ts`**

```typescript
import { Hono } from 'hono';
import { ExampleSchema } from '@symphony/shared';
import type { DB } from '../db/client.js';
import * as repo from '../db/repo.js';

export function examplesRouter() {
  const r = new Hono<{ Variables: { db: DB } }>();

  r.get('/', (c) => {
    const db = c.get('db');
    const recentParam = c.req.query('recent');
    const domainsParam = c.req.query('domains');
    if (!recentParam && !domainsParam) return c.json(repo.listExamples(db));

    const recent = recentParam ? Math.max(0, Number.parseInt(recentParam, 10) || 0) : 5;
    const domains = domainsParam ? domainsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    const recentRows = repo.listRecentExamples(db, recent);
    const byDomain = domains.flatMap(d => repo.listExamplesByDomain(db, d, recent));
    const seen = new Set<string>();
    const merged = [...recentRows, ...byDomain].filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    return c.json(merged);
  });

  r.post('/', async (c) => {
    const parsed = ExampleSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    repo.createExample(c.get('db'), parsed.data);
    return c.json(parsed.data, 201);
  });

  r.get('/:id', (c) => {
    const e = repo.getExample(c.get('db'), c.req.param('id'));
    if (!e) return c.json({ error: 'not found' }, 404);
    return c.json(e);
  });

  r.delete('/:id', (c) => {
    repo.deleteExample(c.get('db'), c.req.param('id'));
    return c.body(null, 204);
  });

  return r;
}
```

**Step 3: Mount in `app.ts`** — `app.route('/v1/examples', examplesRouter());`

**Step 4: Tests pass; commit**

```powershell
git add sidecar/src/routes/examples.ts sidecar/src/routes/examples.test.ts sidecar/src/app.ts
git commit -m "feat(sidecar): /v1/examples CRUD + hybrid recent+domain query"
```

---

## Task 9: Auth middleware stub (env-flagged, off by default)

**Files:**
- Create: `sidecar/src/middleware/auth.ts`
- Create: `sidecar/src/middleware/auth.test.ts`
- Modify: `sidecar/src/app.ts`

**Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import { openDb, runMigrations } from '../db/client.js';

describe('auth middleware', () => {
  it('off by default — health responds without a token', async () => {
    const { db } = openDb(':memory:');
    runMigrations(db);
    const app = buildApp({ db });
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
  });
  it('on when SIDECAR_TOKEN is set — 401 without bearer', async () => {
    const { db } = openDb(':memory:');
    runMigrations(db);
    const app = buildApp({ db, requireToken: 'secret' });
    const res = await app.request('/v1/health');
    expect(res.status).toBe(401);
  });
  it('on when SIDECAR_TOKEN is set — 200 with correct bearer', async () => {
    const { db } = openDb(':memory:');
    runMigrations(db);
    const app = buildApp({ db, requireToken: 'secret' });
    const res = await app.request('/v1/health', { headers: { authorization: 'Bearer secret' } });
    expect(res.status).toBe(200);
  });
});
```

**Step 2: Update `AppDeps`** in `app.ts` to accept optional `requireToken: string`. When provided, install a middleware before routes that checks `Authorization: Bearer <token>`.

```typescript
export interface AppDeps {
  db: DB;
  requireToken?: string;
}
```

Add middleware:

```typescript
if (deps.requireToken) {
  app.use('*', async (c, next) => {
    if (c.req.path === '/v1/health' && c.req.method === 'GET' && !deps.requireToken) return next();
    const auth = c.req.header('authorization');
    if (auth !== `Bearer ${deps.requireToken}`) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    await next();
  });
}
```

Note: the test expects `401` even on `/v1/health` when the token is required. Adjust if we want health to remain open — pick one and update the test to match. Recommended: token required on **all** routes, no exceptions. Update health test accordingly.

**Step 3: Pass `requireToken` from `index.ts` based on env**

```typescript
const requireToken = process.env.SIDECAR_TOKEN || undefined;
const app = buildApp({ db, requireToken });
```

**Step 4: Tests pass; commit**

```powershell
git add sidecar/src/middleware/ sidecar/src/app.ts sidecar/src/app.test.ts sidecar/src/index.ts
git commit -m "feat(sidecar): bearer auth middleware (off unless SIDECAR_TOKEN set)"
```

---

## Task 10: End-to-end smoke test (real HTTP)

**Files:**
- Create: `sidecar/src/e2e.test.ts`

This test starts a real Node server on an ephemeral port, hits it with `fetch`, and asserts the hybrid example query returns the expected rows.

**Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serve, type ServerType } from '@hono/node-server';
import { buildApp } from './app.js';
import { openDb, runMigrations } from './db/client.js';

let server: ServerType;
let baseUrl: string;

beforeAll(async () => {
  const { db } = openDb(':memory:');
  runMigrations(db);
  const app = buildApp({ db });
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) => {
      baseUrl = `http://127.0.0.1:${info.port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

async function post(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('e2e', () => {
  it('writes a workspace, a rule, examples; reads hybrid ranking', async () => {
    expect((await post('/v1/workspaces', { id: 'ws-1', label: 'Work', vivaldiWorkspaceId: 1 })).status).toBe(201);
    expect((await post('/v1/rules', { id: 'r-1', domain: 'github.com', workspaceId: 'ws-1', hitCount: 0, createdAt: '2026-06-02T00:00:00.000Z' })).status).toBe(201);
    for (let i = 0; i < 3; i++) {
      await post('/v1/examples', {
        id: `e-${i}`, domain: 'github.com', title: `t${i}`, url: 'https://github.com',
        modelSuggestedWorkspaceId: 'ws-1', userChoseWorkspaceId: 'ws-1', userChoseAction: 'move',
        createdAt: `2026-06-0${i + 1}T00:00:00.000Z`,
      });
    }
    await post('/v1/examples', {
      id: 'other', domain: 'gitlab.com', title: 't', url: 'https://gitlab.com',
      modelSuggestedWorkspaceId: null, userChoseWorkspaceId: null, userChoseAction: 'keep',
      createdAt: '2026-06-09T00:00:00.000Z',
    });

    const res = await fetch(`${baseUrl}/v1/examples?recent=2&domains=github.com`);
    const rows = (await res.json()) as { id: string; domain: string }[];
    const ids = rows.map(r => r.id);
    expect(ids).toContain('other');
    expect(ids).toContain('e-2');
    // dedup: no id appears twice
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

**Step 2: Run — expect pass**

Run: `npm --workspace sidecar run test -- --run`
Expected: all tests including e2e pass.

**Step 3: Commit**

```powershell
git add sidecar/src/e2e.test.ts
git commit -m "test(sidecar): end-to-end HTTP smoke covering hybrid ranking"
```

---

## Task 11: `sidecar/README.md` + manual curl checklist

**Files:**
- Create: `sidecar/README.md`

**Step 1: Write README**

```markdown
# @symphony/sidecar

Local memory service for the 6th Symphony AI tab sorter. Owns workspace labels,
domain → workspace hard rules, and few-shot correction examples. Speaks plain
HTTP+JSON over `127.0.0.1`. Backed by SQLite (WAL mode) via Drizzle.

## Run

From the repo root:

    npm run dev:sidecar         # tsx watch, default port 8765
    SIDECAR_PORT=9000 SIDECAR_DB_PATH=./custom.db npm run dev:sidecar

The dev script creates `sidecar/memory.db` on first run. WAL files
(`memory.db-wal`, `memory.db-shm`) are gitignored.

## Auth

Off by default. Set `SIDECAR_TOKEN` in the environment to require
`Authorization: Bearer <token>` on every request:

    SIDECAR_TOKEN=mytoken npm run dev:sidecar

## Endpoints

- `GET /v1/health` → `{ ok: true }`
- `GET|POST /v1/workspaces`, `GET|PUT|DELETE /v1/workspaces/:id`
- `GET|POST /v1/rules`, `GET|PUT|DELETE /v1/rules/:id`,
  `POST /v1/rules/:domain/increment`
- `GET|POST /v1/examples`, `GET|DELETE /v1/examples/:id`
  - Hybrid query: `GET /v1/examples?recent=5&domains=github.com,news.ycombinator.com`

## Tests

    npm run test:sidecar
```

**Step 2: Manual curl checklist (one-time, write outputs in a scratch note, do not commit)**

Start the server, then in another shell:

1. `curl http://127.0.0.1:8765/v1/health` → `{"ok":true}`
2. `curl -X POST http://127.0.0.1:8765/v1/workspaces -H 'content-type: application/json' -d '{"id":"ws-1","label":"Work","vivaldiWorkspaceId":1}'` → 201
3. `curl http://127.0.0.1:8765/v1/workspaces` → array containing the row
4. `curl -X POST http://127.0.0.1:8765/v1/rules -H 'content-type: application/json' -d '{"id":"r-1","domain":"github.com","workspaceId":"ws-1","hitCount":0,"createdAt":"2026-06-02T00:00:00.000Z"}'` → 201
5. `curl -X POST http://127.0.0.1:8765/v1/rules/github.com/increment` → row with `hitCount: 1`

If anything diverges, fix before committing.

**Step 3: Commit**

```powershell
git add sidecar/README.md
git commit -m "docs(sidecar): README with run/auth/endpoint summary"
```

---

## Task 12: Final verification sweep

**Files:** none modified.

Run, capturing output, in this order — @superpowers:verification-before-completion:

1. `git status` → clean.
2. `npm install` → ok.
3. `npm run test:shared` → pass.
4. `npm run test:sidecar` → all suites pass (workspaces, rules, examples, app, repo, auth, e2e).
5. `npm run build:extension` → still builds.
6. `npm run test:extension` → upstream tests still pass.
7. `npm run test:smoke` → pass.
8. Manual: run `npm run dev:sidecar`, exercise the curl checklist in Task 11 step 2.

If everything passes, mark this plan complete.

---

## Done criteria

- `shared/` exposes Zod schemas + TS types for `Workspace`, `Rule`, `Example`, `Action`.
- `sidecar/` is a runnable Hono service: `/v1/health`, full CRUD on workspaces, rules, examples, plus rule hit-count increment and the hybrid example ranking.
- SQLite database created at `sidecar/memory.db` (or `SIDECAR_DB_PATH`) with WAL enabled, FKs enforced, migrations applied on start.
- All test suites green: shared, sidecar (unit + e2e), extension (unchanged from Plan 1), smoke.
- Auth stub installs only when `SIDECAR_TOKEN` is set.
- README documents run, auth, endpoints.

## What this plan does NOT do

- No extension code changes. The extension does not call the sidecar yet — that's Plan 3.
- No Postgres support. Drizzle's `sqlite` and `pg` drivers share enough API that the eventual swap is mostly a config change; we accept that bridge when we get to it.
- No model calls, no UI, no Vivaldi-specific code.
- No persistent process manager (systemd / launchd / Windows service). For now the user runs `npm run dev:sidecar` in a terminal. We can wrap it as a Windows scheduled task or autostart entry later.

## Handoff

After Plan 2 ships and the sidecar runs locally, start Plan 3 (`docs/plans/2026-06-02-03-extension-features.md`). Plan 3 imports types from `@symphony/shared` and hits `http://127.0.0.1:8765` for memory.
