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
