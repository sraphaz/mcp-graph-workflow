# Web Dashboard Rules

- **React 19 + Vite + Tailwind CSS** — no `create-react-app`, no Next.js. Imports use the `@/` alias resolving to `src/web/dashboard/src/`.
- **Tests run under jsdom** — colocated `<component>.test.tsx` next to the source. Vitest picks them up via the `dashboard` project (see `vitest.config.ts`).
- **Use Testing Library, not snapshots** — query by role/label/text (`getByRole`, `getByText`, `findByText`). Avoid `toMatchSnapshot()`; assert behavior contracts.
- **Polyfills live in `test-setup.ts`** — `ResizeObserver`, `IntersectionObserver`, `matchMedia`, `HTMLCanvasElement.getContext`, and a Map-based `localStorage` shim. Add new polyfills there when a third-party lib needs them; do NOT polyfill per-test.
- **React deduplication** — the dashboard package is a workspace (root `package.json` → `workspaces`). Never add `react`/`react-dom` as direct deps in `src/web/dashboard/package.json` — they hoist from root so vitest sees one React instance (avoids the `useContext` null bug with Recharts).
- **No raw colors** — use `text-foreground`, `bg-surface`, `border-edge`, `text-accent` etc. (defined in Tailwind config). Hardcoded `#xxxxxx` only for chart series colors that must be deterministic.
- **Component file size** — soft cap 200 LOC. Tabs > 500 LOC indicate the tab is hosting business logic that belongs in a hook (`use-*.ts` under `src/hooks/`).
- **Memoize where it matters** — `memo()` on leaf components inside virtualized lists or React Flow graphs. Don't `memo()` everything; profile first.
- **Accessibility** — interactive elements have `aria-label` or visible text. Tabs use `role="tab"`/`role="tablist"` with proper `aria-selected` and `tabIndex` (`0` for active, `-1` for inactive) — see `tab-nav.tsx` as canonical example.
- **No direct fetch in components** — go through hooks (`use-graph-stats`, `use-insights`, etc.) so loading/error states are uniform and SSE updates are wired centrally
