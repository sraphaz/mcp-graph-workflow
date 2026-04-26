# API Rules

- **Express v5** — use the `Router` factory pattern, never bare `express()` in route files
- **Mount via `createApiRouter`** — every new router must be wired in `src/api/router.ts`; never expose a router without going through the central registry (this is what the `e14-security` test enforces)
- **`storeRef` over direct store** — accept `StoreRef` from `core/store/store-manager`, not a raw `SqliteStore`, so multi-project switching works at runtime
- **Zod v4 at the boundary** — every body/query/params payload that mutates state must be validated with `safeParse` and return `400` with `{ error, details }` on failure (never throw / never 500 on user input)
- **Error contract** — `next(err)` for thrown errors; the central `errorHandler` middleware shapes the JSON response. Never `res.status(500).json(...)` inline.
- **Idempotent semantics** — `POST` that creates entities should be safe to retry (use stable IDs from request OR return the existing record on duplicate)
- **No business logic** — routes call into `core/` modules and shape the response only; mirror the same thin-orchestration rule as the CLI layer
- **SSE endpoints** — use the shared `events-sse` handler; never re-implement the HTTP heartbeat. If `eventBus` is undefined, return `503` with structured error rather than hanging the connection
- **Coverage tests** — every router has a colocated `src/tests/api-<router>.test.ts` exercising at least: shape contract, default-state response, one error path (Zod 422 / 404 / auth)
