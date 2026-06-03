# 6th Symphony

AI tab sorter for Vivaldi. See `docs/plans/2026-06-02-ai-tab-sorter-design.md`
for the design and `docs/plans/2026-06-02-0{1,2,3}-*.md` for implementation plans.

## Layout

- `extension/` — Vivaldi extension (forked from
  [TabBrain](https://github.com/ndg8743/TabBrain), MIT). See `NOTICE.md`.
- `sidecar/` — Local memory service (to be added in Plan 2).
- `shared/`  — Shared TypeScript types (to be added in Plan 2).
- `docs/`    — Design and plans.

## Dev quickstart

```
npm install
npm run build:extension
```

Then load `extension/dist/` unpacked in Vivaldi (`vivaldi://extensions`).
