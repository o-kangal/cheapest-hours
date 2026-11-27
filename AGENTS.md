# AGENTS.md - Engineering Constraints & Agent Context

<!-- Created from dev-kit 0.2.0. Agents may not edit this file (.claude/settings.json); change it yourself. -->

## System & Architecture Overview
- **Product:** Cheapest Hours — Shows Germany's day-ahead electricity prices and the cheapest time window to run a flexible load.
- **Stack:** Vite 8 + TypeScript 6.0 (strict, no framework), plain SVG for the chart, Vitest 5, ESLint 10 with typescript-eslint 8. One Cloudflare Pages Function (`/api/prices`) proxies the Energy-Charts API. Hosted on Cloudflare Pages (`cheapest-hours.pages.dev`), deployed from CI with wrangler 4. Node 24, pnpm.
- **Primary Language Invariant:** All source code, interfaces, comments, commit messages and error messages are written in **English (en-US)**.

---

## Directory Layout & Domain Boundaries

```
.
├── index.html              Page shell: static markup only, no inline scripts.
├── src/
│   ├── lib/                Pure domain logic: aggregation, cheapest window, Berlin time, formatting.
│   │                       No DOM, no fetch, no Date.now(); everything is passed in.
│   ├── data.ts             Loads prices from /api/prices (tomorrow, falling back to today).
│   ├── chart.ts            Renders the SVG bar chart; receives ready-made view data.
│   ├── main.ts             Entry point: state, event wiring, loading/error/empty views.
│   └── style.css
├── functions/api/          Cloudflare Pages Functions (server side). Own tsconfig with Workers types;
│                           must not import from src/ except src/lib.
├── tests/                  Vitest unit tests for src/lib and the proxy's input validation.
├── public/                 Static files copied as they are: favicon, and theme.js, which applies
│                           the saved theme before the first paint.
└── docs/                   Deploy and GitHub setup notes. docs/private/ stays git-ignored.
```

---

## Deterministic CLI Commands

Always run these commands from the repository root:

- **Install Dependencies:** `pnpm install --frozen-lockfile`
- **Development:** `pnpm dev`
- **Type Check:** `pnpm run typecheck`
- **Linter:** `pnpm run lint` (ESLint, then a Prettier format check)
- **Format:** `pnpm run format`
- **Tests:** `pnpm run test`
- **Production Build:** `pnpm run build`

---

## Architectural Invariants & Data Rules

1. **Pure core:** `src/lib/` has no side effects. It never touches the DOM, the network or the clock; callers pass time and data in. Every rule of SPEC §4 is implemented there and unit-tested.
2. **One unit conversion:** prices arrive in EUR/MWh and are converted to ct/kWh (divide by 10) in exactly one function. Everything after that point works in ct/kWh.
3. **Berlin time:** day boundaries and every displayed time use `Europe/Berlin`, whatever the viewer's time zone. Times move through the code as Unix seconds, never as local `Date` getters.
4. **Missing is not zero:** a missing price is never treated as 0, and a window never spans a gap in the data.
5. **Closed proxy:** `/api/prices` accepts only `date=YYYY-MM-DD`, fixes the bidding zone to `DE-LU`, and never forwards any other input to the upstream URL.
6. **Untrusted upstream:** the upstream response is validated (arrays of equal length, finite numbers or null) before use, and API data reaches the page only as text (`textContent`, SVG text nodes), never through `innerHTML`.

---

## Hard Guardrails (Agent Prohibitions)

- **DO NOT** use TypeScript `any`. Use precise types, or `unknown` with type guards.
- **DO NOT** install dependencies with `pnpm add` (denied in `.claude/settings.json`). Write them into `package.json` by hand at an exact version (`npm view <pkg> version`), then run `pnpm install`.
- **DO NOT** pin a GitHub Action by tag. Pin it to a full commit SHA with the tag in a comment; Dependabot keeps the pins current.
- **DO NOT** add a third-party GitHub Action without telling the owner. GitHub blocks it until the owner lists it under `project.actions` in `.dev-kit.json` and applies `docs/github-settings.md`.
- **DO NOT** commit secrets, tokens or `.env` files. gitleaks runs on every push.
- **DO NOT** commit or link to `docs/private/`. It holds personal notes and stays git-ignored.
- **DO NOT** invent facts in content, docs or metadata (names, dates, numbers, links). Ask instead.
- **DO NOT** weaken a check to make it pass (skipped tests, `eslint-disable`, lowered CI thresholds) without saying so in the report.
- **DO NOT** call `api.energy-charts.info` from the browser. It does not allow cross-origin requests; go through `/api/prices`.
- **DO NOT** add a UI framework or a chart library without asking the owner. The brief keeps the app dependency-free at runtime.
- **DO NOT** widen the scope beyond SPEC §2 without asking the owner first.

---

## Known Pitfalls

<!-- Things that cost time once, so they don't cost it again. The next-task skill reads this list
     before every task. Add an entry whenever a task hits a non-obvious problem. -->

- **TypeScript 7 breaks the lint setup:** typescript-eslint 8 supports `typescript` up to `<6.1.0`. Stay on 6.0.x until typescript-eslint supports 7.
- **15-minute prices:** since October 2025 the day-ahead market (and Energy-Charts) uses 15-minute periods: 96 points per day, 92/100 on DST days. The app averages them to hours (SPEC §4.2).
- **Energy-Charts rate limit:** a few quick requests already return `429 Too Many Requests`. Don't loop over the live API in scripts or tests; tests use fixtures, the proxy caches.
- **pnpm 12 blocks install scripts:** `pnpm install` fails with ERR_PNPM_IGNORED_BUILDS until a package is listed under `allowBuilds` in `pnpm-workspace.yaml`. Only `esbuild` and `workerd` are allowed; add others only when they truly need a postinstall.
- **Unpublished day is a 404:** Energy-Charts answers `404` "no content available" (text/plain) for a day without prices; only that status means "no data", every other failure is a `502`.
- **Fresh packages fail CI:** pnpm rejects versions younger than a day (`minimumReleaseAge`, `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`) in CI, but a local install can pass because pnpm caches a passing lockfile check. Pick versions at least a day old (`npm view <pkg> time`); `@cloudflare/workers-types` publishes daily.

---

## Agent Task Execution Protocol

Tasks come from `TASKS.md`, one at a time (the `next-task` skill runs this loop):

1. **Context Discovery:** Read the task's Read-Only Context Files and the SPEC.md sections it points to.
2. **Plan & Boundary Check:** List the files you'll touch; stay inside the task's Target Files; check the invariants above.
3. **Implementation:** Clean, minimal code. No dead code, no premature abstractions. Tests for the rules the task names.
4. **Verification:** Run the task's Verification commands, then the repo-wide checks above. Zero errors, zero new warnings.
5. **Report & Commit:** Mark the task completed in TASKS.md, report, propose a conventional commit message and wait for approval before committing and pushing.
