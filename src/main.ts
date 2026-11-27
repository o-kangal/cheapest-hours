import './style.css';
import { renderChart } from './chart';
import { loadDay, type DayResult } from './data';
import { dailyAverage, type HourPrice } from './lib/prices';
import { formatCt, summarize } from './lib/summary';
import { formatDay } from './lib/time';
import { findCheapestWindow } from './lib/window';

/** Looks up an element of the page shell and checks its type at runtime. */
function element<T extends HTMLElement>(selector: string, type: new () => T): T {
  const found = document.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing or wrong element: ${selector}`);
  return found;
}

const card = element('#card', HTMLElement);
const dayLabel = element('#day-label', HTMLHeadingElement);
const dayNote = element('#day-note', HTMLParagraphElement);
const status = element('#status', HTMLParagraphElement);
const retry = element('#retry', HTMLButtonElement);
const controls = element('#controls', HTMLFieldSetElement);
const chart = element('#chart', HTMLDivElement);
const summary = element('#summary', HTMLParagraphElement);

type ViewState = 'loading' | 'error' | 'empty' | 'ok';

/** The hours of the day on screen; kept so a new duration needs no new request (SPEC §3.2). */
let hours: HourPrice[] = [];

function show(state: ViewState, message = ''): void {
  card.dataset['state'] = state;
  status.textContent = message;
  retry.hidden = state !== 'error';
}

function selectedDuration(): number {
  const checked = controls.querySelector<HTMLInputElement>('input[name="duration"]:checked');
  return Number(checked?.value ?? 3);
}

/** Recomputes the window, summary and chart for the selected duration from `hours`. */
function update(): void {
  const avg = dailyAverage(hours);
  if (avg === null) return;
  const durationHours = selectedDuration();
  const window = findCheapestWindow(hours, durationHours);
  const line = summarize(window, avg, durationHours);
  const prices = hours.map((h) => h.ctPerKwh);
  const range = `${formatCt(Math.min(...prices))} to ${formatCt(Math.max(...prices))} ct/kWh`;

  summary.textContent = line;
  renderChart(chart, {
    hours,
    window,
    dailyAvg: avg,
    durationHours,
    label: `Bar chart of ${hours.length} hourly prices, ranging from ${range}. ${line}`,
  });
}

function render(result: DayResult): void {
  hours = [];
  switch (result.kind) {
    case 'error':
      dayLabel.textContent = 'Prices unavailable';
      dayNote.textContent = '';
      show('error', result.message);
      return;
    case 'empty':
      dayLabel.textContent = `Today · ${formatDay(result.date)}`;
      dayNote.textContent = '';
      show('empty', 'No prices are published for today or tomorrow yet. Please check back later.');
      return;
    case 'ok':
      hours = result.hours;
      dayLabel.textContent = `${result.isFallback ? 'Today' : 'Tomorrow'} · ${formatDay(result.date)}`;
      dayNote.textContent = result.isFallback
        ? "Tomorrow's prices are not published yet, so today's are shown."
        : '';
      show('ok');
      update();
      return;
  }
}

async function load(): Promise<void> {
  dayLabel.textContent = 'Day-ahead prices';
  dayNote.textContent = '';
  chart.replaceChildren();
  show('loading', 'Loading prices…');
  render(await loadDay(Date.now()));
}

controls.addEventListener('change', update);
retry.addEventListener('click', () => void load());

// The chart is drawn in CSS pixels, so it is redrawn when its width changes.
let lastWidth = 0;
new ResizeObserver(([entry]) => {
  const width = Math.round(entry?.contentRect.width ?? 0);
  if (width === lastWidth) return;
  lastWidth = width;
  if (card.dataset['state'] === 'ok') update();
}).observe(chart);

void load();
