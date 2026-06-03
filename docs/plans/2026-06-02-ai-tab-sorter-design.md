# 6th Symphony — AI Tab Sorter for Vivaldi

**Design doc — 2026-06-02**

## Problem

I keep too many tabs open in Vivaldi. Some I want to return to, some serve a
specific purpose, many are trash. Vivaldi's workspace "rules" (URL → workspace)
help but aren't granular enough, and I'm not conscious enough while researching
to manually file tabs into the right workspace. I want a locally-hosted (and
optionally cloud) AI model to sort my tabs for me — and to *learn* where things
go over time.

## Goals

- **Categorize** open tabs into the correct Vivaldi **workspace**.
- **Triage junk** — identify trash tabs to close, alongside the categorization.
- **Review before apply** — the AI proposes a plan; nothing moves or closes until
  I approve, with per-tab overrides.
- **Learn from my corrections** — get better at *my* taste over time without
  retraining model weights.
- **Local-first**, with the option to use cloud models too.
- **Externally accessible memory** — other services (read & write) can use the
  learned rules/history, not just the extension.

## Non-goals (YAGNI for v1)

- Fine-tuning model weights (LoRA etc.) — the memory + few-shot approach covers
  the "it learns" experience without a training rig.
- Multi-machine sync at launch — designed for, but not built, in v1.
- Browser-store publication — loaded unpacked in developer mode.

## Approach: fork TabBrain + add what's missing

Rather than build from scratch, fork [TabBrain](https://github.com/ndg8743/TabBrain)
(MIT licensed). It already provides ~60% of this, battle-tested:

**Inherited from TabBrain:**

- Manifest V3 extension scaffolding (TypeScript, React 18, Tailwind, Vite, CRXJS).
- LLM adapter (`src/lib/llm/provider.ts`) — OpenAI-compatible, already supporting
  **local** (Ollama, LM Studio) **and cloud** (OpenAI, Anthropic, DeepSeek, Groq).
- A `src/sidepanel/` React UI to grow the review panel from.
- Tab gathering, duplicate detection, a review-and-select-to-close step.
- Chrome API wrappers (`src/lib/chrome/`), Vitest + Playwright test setup.

**What we add (the novel ~40%):**

1. **Vivaldi workspace writer** — read/write `vivExtData` to move tabs into
   workspaces; first-run onboarding to label discovered workspace IDs.
2. **The learning loop** — domain→workspace rules, correction history as few-shot
   examples, promotion of repeated overrides into hard rules.
3. **Few-shot injection** — feed memory into the existing prompt builder.
4. **Workspace-bucket review panel + slide-in animation** — grow the side panel
   into the "here's what's going where, adjust before apply" surface.
5. **External memory sidecar** — move the memory's source of truth out of the
   browser sandbox into a local service (see below).

## Architecture

```
┌─────────────────────────────────────────────┐
│  Vivaldi                                      │
│  ┌──────────────────┐  reads/writes tabs      │
│  │  Extension (fork)│◄───────────┐            │
│  │  • bg worker     │  vivExtData │            │
│  │  • side panel UI │        ┌────▼─────┐      │
│  │  • rules cache   │        │  Tabs    │      │
│  └───┬──────────┬───┘        └──────────┘      │
└──────┼──────────┼───────────────────────────── ┘
       │ fetch    │ fetch
       ▼          ▼
 ┌──────────┐  ┌──────────────────┐    ┌───────────┐
 │ LM Studio│  │ Memory sidecar   │◄──►│  other    │
 │ / cloud  │  │ (localhost REST) │    │  services │
 │  model   │  │   ▼              │    └───────────┘
 └──────────┘  │ ┌────────────┐   │
               │ │ SQLite     │   │  ◄── single .db file
               │ │ memory.db  │   │
               │ └────────────┘   │
               └──────────────────┘
```

### Components

**Extension (forked TabBrain):**

- **Background service worker** — orchestrator: gather tabs → apply hard rules →
  batch remainder to model → build proposed plan → execute approved actions.
- **Classifier** — builds prompt (system instructions + workspace list + few-shot
  examples from memory + tab batch); calls model via the inherited adapter using
  **structured JSON output** (`response_format` JSON schema); parses
  `[{tabId, action: move|close|keep, workspace, confidence, reason}]`.
- **LLM adapter (inherited)** — OpenAI-compatible. Default LM Studio
  (`http://localhost:1234/v1`); swap base URL + model for Ollama or cloud.
- **Vivaldi workspace writer (new)** — `chrome.tabs.update(id, { vivExtData:
  JSON.stringify({ ...prev, workspaceId }) })`. Reads existing `vivExtData` first
  to preserve other fields; handles workspaceId int/float quirk.
- **Rules cache** — thin `chrome.storage.local` copy of hard rules for graceful
  degradation when the sidecar is offline (still sorts; defers learning).
- **Side panel UI (grown)** — slide-out overlay; plan grouped into workspace
  buckets + a "Close (junk)" bucket; per-tab reason, reassign dropdown,
  include/exclude checkbox; animation of tab chips flying into buckets.
- **Apply module** — moves via `vivExtData`, closes via `chrome.tabs.remove`
  (only checked tabs).

**Memory sidecar (new, separate deliverable):**

- **Language:** TypeScript. Shared `Rule` / `Example` / `Workspace` type
  definitions reused by extension, sidecar, and external consumers.
- **HTTP:** Hono or Fastify, **versioned** REST — `/v1/rules`, `/v1/examples`,
  `/v1/workspaces` (GET/POST/PUT/DELETE).
- **DB:** SQLite in **WAL mode** (concurrent readers + serialized writers). All
  writes go through the service.
- **ORM:** Drizzle (speaks SQLite *and* Postgres) so a future move to networked
  multi-machine sync is a driver swap behind the same API — no client rewrites.
- **Auth/locality:** binds `127.0.0.1`; no-op auth middleware stub now, token
  check enabled later if exposed.

## Data flow (one cleanup session)

1. Click toolbar button → panel slides in.
2. Background gathers all tabs (title, URL, current workspace via `vivExtData`).
3. **Hard rules run first** — domain matches assigned instantly, skipping the
   model.
4. Remaining tabs → batched to model with few-shot examples → action + workspace
   + confidence + reason per tab.
5. Panel renders the plan grouped into buckets; each tab editable.
6. Animation: tab chips fly into their assigned buckets.
7. User adjusts → clicks Apply.
8. Apply module moves + closes (checked only). Overrides recorded to memory:
   consistent domain overrides (≥3×) promote to hard rules; every correction
   stored as a few-shot example (rolling most-recent/most-relevant window).
9. Memory updated via sidecar → next session smarter.

## Error handling / safety

- **Model unreachable** → panel shows "start your model server"; **zero tabs
  touched**.
- **Malformed/empty model output** → one retry, then unclassified tabs default to
  **keep** (never closed on uncertainty).
- **Low-confidence "close"** → shown but **never pre-checked**.
- **Pinned tab / active tab** → excluded from closing by default.
- **`vivExtData` write fails** → that tab reported and left in place; rest apply.
- **Sidecar down** → extension uses cached rules to sort; learning paused until
  reconnect; reconciles on reconnect.

## Testing

- Unit (Vitest, no browser): prompt builder, JSON parsing, rule promotion, plan
  diffing, sidecar API handlers, Drizzle queries — fixtures + mocked model.
- Integration: load unpacked in Vivaldi, run on a real messy window; sidecar
  round-trip (extension write → other-service read).
- TDD for the pure logic (memory rules, prompt building, plan diffing).

## Open implementation details (resolve during planning)

- Workspace ID→name mapping: first-run onboarding UI to label discovered IDs.
- Few-shot selection strategy: most-recent vs domain-relevance ranking; window
  size vs prompt budget.
- Batch size per model call (token budget vs latency).
- Rule-promotion threshold tuning (start at 3 consistent overrides).
