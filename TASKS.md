# TASKS.md - Cheapest Hours Implementation Plan

<!-- Created from dev-kit 0.2.0. The `next-task` skill executes these tasks in order,
     one per run. Each task is sized to be done and verified in one sitting. Status lines are the
     only completion marker: `⏳ Pending` or `✅ Completed (YYYY-MM-DD)`. -->

## Plan Architecture & Prerequisites
- **Goal:** a small, polished web app that shows tomorrow's (or today's) German day-ahead prices and the cheapest contiguous window for a flexible load (SPEC §1), live on Cloudflare Pages.
- **Execution Strategy:** scaffold → pure domain logic with tests → closed, cached proxy → data layer and states → chart and UI → docs and end-to-end check → publish. Each step is small and verifiable on its own; nothing is deployed before the owner's review (Task 6).
- **Prerequisites:** Node 24 and pnpm (present). For Task 7: a GitHub repository `o-kangal/cheapest-hours` and a Cloudflare account (owner steps).

---

## Open Decisions (resolve before the task named in each item)
1. ~~**Unpublished day response (before Task 3)**~~ **Resolved 2026-11-27:** Energy-Charts answers `404` with `text/plain` "no content available". The proxy maps it to `200` with empty arrays ("no data"); every other non-2xx, including `429`, becomes `502`.

---

## Ordered Task Breakdown

### Task 1: Project Scaffold
- **Status:** ✅ Completed (2026-11-27)
- **Type:** Setup
- **Human Step:** None
- **Read-Only Context Files:** `AGENTS.md`, `SPEC.md`, `tsconfig.json`, `eslint.config.js`, `.github/workflows/ci.yml`
- **Target Files (Create/Modify):**
  - `package.json`, `pnpm-lock.yaml`
  - `index.html`, `src/main.ts`, `src/style.css`, `public/favicon.svg`
  - `vite.config.ts`
  - `functions/tsconfig.json`
- **Step-by-Step Instructions:**
  1. Write `package.json` by hand: `"type": "module"`, `"private": true`, `"license": "MIT"`, `packageManager` with the installed pnpm version, and scripts `dev` (vite), `dev:full` (build, then `wrangler pages dev dist`, which also serves `functions/`), `build` (vite build), `preview`, `typecheck` (`tsc -p . && tsc -p functions`), `lint` (eslint .), `test` (vitest run). devDependencies at exact versions looked up with `npm view`: vite, typescript 6.0.x (see AGENTS.md Known Pitfalls), vitest, eslint, @eslint/js, typescript-eslint, globals, wrangler, @cloudflare/workers-types.
  2. `functions/tsconfig.json` extends the root config, includes `functions/**` and `src/lib/**`, and sets `"types": ["@cloudflare/workers-types"]` with `lib: ["ES2022"]`.
  3. `index.html` with the page skeleton (header, controls area, chart area, summary, footer); `src/main.ts` only mounts a placeholder; `src/style.css` with base tokens (light and dark via `prefers-color-scheme`).
  4. `vite.config.ts`: Vitest `include: ['tests/**/*.test.ts']`, `passWithNoTests` for now; build without source maps.
  5. `pnpm install`.
- **Verification:**
```bash
pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build
test -f dist/index.html && ! find dist -name '*.map' | grep -q .
```

---

### Task 2: Pure Domain Logic and Unit Tests
- **Status:** ✅ Completed (2026-11-27)
- **Type:** Feature
- **Human Step:** None
- **Read-Only Context Files:** `AGENTS.md`, `SPEC.md` (§4.1–§4.6)
- **Target Files (Create/Modify):**
  - `src/lib/prices.ts` (types, EUR/MWh → ct/kWh, quarter-hours → hours, daily average)
  - `src/lib/window.ts` (`findCheapestWindow`)
  - `src/lib/time.ts` (Berlin dates: today/tomorrow as `YYYY-MM-DD` for a given instant, `HH:MM` labels, `24:00` for a window ending at midnight)
  - `src/lib/summary.ts` (summary line text, SPEC §4.5)
  - `tests/prices.test.ts`, `tests/window.test.ts`, `tests/time.test.ts`, `tests/summary.test.ts`
- **Step-by-Step Instructions:**
  1. `toHourly(points)` groups 15-minute points by hour start and averages the non-null prices; hours without any price are dropped (SPEC §4.2). The only EUR/MWh → ct/kWh conversion lives here (AGENTS.md invariant 2).
  2. `findCheapestWindow(hours, duration)` returns `{ startIndex, endIndex, avg } | null`: sliding sum over runs of consecutive hours (3600 s apart), lowest mean, earliest on a tie (SPEC §4.3–§4.4). O(n).
  3. Time helpers use `Intl.DateTimeFormat` with `timeZone: 'Europe/Berlin'`; the current instant is a parameter.
  4. Tests: normal day; duration longer than the data → null; duration equal to the data; negative prices (window chosen across them); all-equal prices → earliest; gap in the data splits runs; empty input; 23- and 25-hour DST days (2026-03-29, 2026-10-25); hourly averaging with a null quarter; summary with positive and with non-positive daily average; window ending at midnight → `24:00`.
- **Verification:**
```bash
pnpm run typecheck && pnpm run lint && pnpm run test
```

---

### Task 3: `/api/prices` Proxy with Edge Cache
- **Status:** ✅ Completed (2026-11-27)
- **Type:** Feature
- **Human Step:** None
- **Read-Only Context Files:** `AGENTS.md`, `SPEC.md` (§4.7), `src/lib/prices.ts`
- **Target Files (Create/Modify):**
  - `functions/api/prices.ts`
  - `src/lib/upstream.ts` (validation of the upstream JSON, shared by proxy and tests)
  - `tests/upstream.test.ts`
- **Step-by-Step Instructions:**
  1. Resolve Open Decision 1 with a single request for a day after tomorrow; mark it resolved in TASKS.md and give the owner the matching SPEC §6 / AGENTS.md change as a diff (both are owner-edited).
  2. `onRequestGet`: accept only `date` matching `^\d{4}-\d{2}-\d{2}$` and a real calendar date, else `400`. Build the upstream URL with `bzn=DE-LU&start=<date>&end=<date>`; nothing else from the request goes into it (AGENTS.md invariant 5).
  3. Validate with `parseUpstream` (equal-length arrays, finite numbers or null); invalid or non-2xx upstream → `502` with a short JSON error. "Not published" → `200` with empty arrays.
  4. Respond `{ date, unixSeconds, priceEurPerMwh }` with `Cache-Control: public, max-age=900`; cache successful responses with `caches.default` for 15 minutes.
  5. Tests for `parseUpstream`: valid payload, length mismatch, non-numeric price, missing fields, empty arrays.
- **Verification:**
```bash
pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build
# Manual, a few requests only (rate limit): pnpm run dev:full, then
# curl -i 'http://localhost:8788/api/prices?date=<tomorrow>'   → 200, JSON, Cache-Control
# curl -i 'http://localhost:8788/api/prices?date=2026-13-40'   → 400
# curl -i 'http://localhost:8788/api/prices?date=x&bzn=FR'     → 400
```

---

### Task 4: Data Layer and Page States
- **Status:** ✅ Completed (2026-11-27)
- **Type:** Feature
- **Human Step:** None
- **Read-Only Context Files:** `AGENTS.md`, `SPEC.md` (§3, §4.1), `src/lib/*.ts`
- **Target Files (Create/Modify):**
  - `src/data.ts`
  - `src/main.ts`, `index.html`, `src/style.css`
- **Step-by-Step Instructions:**
  1. `loadDay(now)`: fetch tomorrow; when it has no prices, fetch today and mark the result as a fallback (SPEC §4.1). Returns a discriminated union: `{ kind: 'ok', day, isFallback, hours }`, `{ kind: 'empty' }` or `{ kind: 'error', message }`.
  2. `main.ts` renders the loading state immediately, then one of: the content, an empty state, or an error state with a Retry button. A label shows which day is displayed ("Tomorrow, Sat 28 Nov" / "Today … — tomorrow's prices are not published yet").
  3. Status changes are announced to assistive tech (`aria-live="polite"`).
- **Verification:**
```bash
pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build
# Manual: pnpm run dev:full → content state; stop the network in devtools → error state and Retry works.
```

---

### Task 5: Chart, Duration Selector and Summary
- **Status:** ✅ Completed (2026-11-27)
- **Type:** Feature
- **Human Step:** None
- **Read-Only Context Files:** `AGENTS.md`, `SPEC.md` (§3.2, §4.3–§4.6, §5)
- **Target Files (Create/Modify):**
  - `src/chart.ts`
  - `src/main.ts`, `index.html`, `src/style.css`
- **Step-by-Step Instructions:**
  1. `renderChart(svg, view)` draws plain SVG with a `viewBox` so it scales: y axis in ct/kWh with a few round ticks, zero line, one bar per hour (negative bars below zero), every third hour labelled, highlighted bars for the window, dashed daily-average line with its value. Text via SVG text nodes only (AGENTS.md invariant 6).
  2. Each bar has a `<title>` (`14:00–15:00 · 8.4 ct/kWh`); the SVG has `role="img"` and an `aria-label` with the summary.
  3. Duration selector: native segmented radio group 1–6 h, default 3; changing it recomputes window and summary from the loaded data only (SPEC §3.2).
  4. Summary line from `src/lib/summary.ts`; no-window case per SPEC §4.4.
  5. Footer with the attribution of SPEC §4.8 and a link to the source repository.
  6. Check light and dark mode and a 360 px wide viewport.
- **Verification:**
```bash
pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build
# Manual: pnpm run dev:full → all six durations, dark mode, 360 px width.
```

---

### Task 6: README and End-to-End Review
- **Status:** ✅ Completed (2026-11-27)
- **Type:** Docs
- **Human Step:** The owner reviews the running app and the README before anything is deployed.
- **Read-Only Context Files:** `AGENTS.md`, `SPEC.md`, `TASKS.md`
- **Target Files (Create/Modify):**
  - `README.md`
  - `docs/screenshot.png`
- **Step-by-Step Instructions:**
  1. README: live link, screenshot, the two-line description, features, how it works (data flow: browser → `/api/prices` → Energy-Charts), a short **Decisions** section (15-minute prices averaged to hours; proxy because of CORS; edge cache because of the rate limit; plain SVG instead of a chart library; Berlin time everywhere), development commands, data attribution, license.
  2. Screenshot from the locally running app (`pnpm run dev:full`).
  3. Full local run-through of SPEC §3; stop and hand over for review.
- **Verification:**
```bash
pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build
grep -rn "TODO(dev-kit)" . --exclude-dir=node_modules --exclude-dir=.git || echo "no open TODOs"
```

---

### Task 7: Publish
- **Status:** ✅ Completed (2026-11-27)
- **Type:** Release
- **Human Step:** The owner creates the GitHub repository, applies `docs/github-settings.md`, does the one-time Cloudflare setup of `docs/deploy.md` (API token and account ID as repository secrets), and pushes.
- **Read-Only Context Files:** `docs/deploy.md`, `docs/github-settings.md`
- **Target Files (Create/Modify):**
  - `README.md` (live link, if the Pages URL differs)
  - `SPEC.md`, `AGENTS.md` (only if the live URL differs from `cheapest-hours.pages.dev`)
- **Step-by-Step Instructions:**
  1. Give the owner the exact commands; the owner runs them.
  2. After the push: CI green, deploy job green, live check passes.
  3. Open the live site and check `/api/prices` there once.
- **Verification:**
```bash
gh run list --limit 3
curl -sI https://cheapest-hours.pages.dev | head -1
```

---

## Dependency Graph & Critical Path

```text
Task 1 (Project Scaffold)
   │
   └──► Task 2 (Pure Domain Logic and Unit Tests)
           │
           ├──► Task 3 (/api/prices Proxy with Edge Cache)
           │       │
           │       └──► Task 4 (Data Layer and Page States)
           │               │
           │               └──► Task 5 (Chart, Duration Selector and Summary)
           │                       │
           │                       └──► Task 6 (README and End-to-End Review)
           │                               │
           │                               └──► Task 7 (Publish)
```
