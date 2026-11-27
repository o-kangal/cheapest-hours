# SPEC.md - Cheapest Hours Product Specification

<!-- Created from dev-kit 0.2.0. What the product does and why; AGENTS.md says how the
     code must be written, TASKS.md says in which order it gets built. When the two disagree on
     behaviour, this file wins. -->

## 1. Purpose
Shows Germany's day-ahead electricity prices and the cheapest time window to run a flexible load.

Some loads can move in time without hurting anyone: a heat pump charging its buffer tank, an electric car charging overnight, an industrial batch process. With a dynamic tariff or a spot-indexed contract, running them in the cheapest hours saves money and shifts demand to hours with more renewable supply. Cheapest Hours answers one question at a glance: *if my load runs for N hours, when should it start?*

Success: a visitor sees the day's price curve and gets the cheapest window for their duration within a few seconds, without reading any explanation.

## 2. Scope
- **In scope:** German–Luxembourg (`DE-LU`) day-ahead prices for one day (tomorrow, or today when tomorrow is not published yet); an hourly chart in ct/kWh; a duration selector (1–6 h); the cheapest contiguous window and a summary line; loading, error and empty states.
- **Out of scope (for now):** other bidding zones, choosing a date, grid fees and taxes (end-customer prices), windows that cross midnight into the next day, user accounts or saved settings, notifications.

## 3. Users & Key Flows

### 3.1 See the cheapest window
- **Trigger:** the visitor opens the page.
- **Steps:** the page shows a loading state, fetches the prices of tomorrow (Berlin date) through `/api/prices`, and falls back to today when tomorrow has no data (§4.1). It renders the chart with the cheapest window for the default duration of 3 hours highlighted, and the summary line (§4.5).
- **Result:** chart, highlighted window, summary line, and a label saying which day is shown.
- **Edge cases:** the request fails or the response is invalid → an error state with a retry button; neither day has data → an empty state that says so.

### 3.2 Change the duration
- **Trigger:** the visitor picks another duration (1–6 hours).
- **Steps:** the window and summary are recomputed from the data already loaded; no new request.
- **Result:** the highlight and summary update immediately.
- **Edge cases:** the duration is longer than the hours with data → no highlight, and the summary says no window of that length fits (§4.4).

## 4. Business Rules
1. **Day shown:** the app shows tomorrow's prices (Berlin date) when the API returns at least one price for that day; otherwise today's, with a visible note that tomorrow's prices are not published yet. Day boundaries follow `Europe/Berlin`, so a DST day has 23 or 25 hours.
2. **Hourly prices:** the API delivers 15-minute prices in EUR/MWh. The price of an hour is the mean of the quarter-hour prices available in that hour; an hour without any price is left out. Display unit is ct/kWh (EUR/MWh ÷ 10), shown with one decimal.
3. **Cheapest window:** for a duration of N whole hours (1 ≤ N ≤ 6, default 3), the window is the run of N consecutive hours with the lowest mean price. Hours are consecutive only when they follow each other without a gap. On a tie, the earliest window wins. Negative prices are valid and count as they are.
4. **No fitting window:** when no run of N consecutive hours exists (including N longer than the data), there is no window; the UI says so instead of showing a partial one.
5. **Summary line:** `Cheapest N-hour window: HH:MM–HH:MM, avg X.X ct/kWh, P% below the daily average.` The daily average is the mean of all hourly prices of the day; P = (daily avg − window avg) / daily avg, rounded to a whole percent. When the daily average is zero or negative a percentage is meaningless, so the line states the difference in ct/kWh instead (`… avg X.X ct/kWh, D.D ct/kWh below the daily average.`). A window that ends at midnight is shown as ending at `24:00`.
6. **Chart:** one bar per hour in ct/kWh, with negative bars below the zero line, the hours of the cheapest window highlighted, and a dashed line for the daily average. Hour labels are Berlin time.
7. **Proxy:** `GET /api/prices?date=YYYY-MM-DD` returns that Berlin day's prices for `DE-LU` from Energy-Charts. Any other or malformed input, or a date outside yesterday to the day after tomorrow (Berlin), → `400`. A day that is not published yet → `200` with no prices; other upstream failures → `502`. Successful responses are cached at the edge for 15 minutes.
8. **Attribution:** the page credits the data source as the API requires: Energy-Charts (Fraunhofer ISE), data from Bundesnetzagentur | SMARD.de, licensed CC BY 4.0.

## 5. Non-Functional Requirements
- **Performance:** one API request per visit in the common case (two when tomorrow is missing); no runtime dependencies; the production bundle stays small (no chart library).
- **Accessibility:** WCAG 2.2 AA. The chart has a text alternative (an `aria-label` summary and per-bar titles); the duration selector is a native form control; the highlight is not conveyed by color alone (the summary line states it).
- **Security & Privacy:** no cookies, no tracking, no personal data. The proxy is closed (§4.7) and API data is rendered as text only.
- **Supported platforms / browsers:** current evergreen browsers, desktop and mobile; usable at 360 px width.

## 6. Open Questions
- None open. (Resolved 2026-11-27: for an unpublished day Energy-Charts answers `404` "no content available"; the proxy treats it as a day without prices, see §4.7.)
