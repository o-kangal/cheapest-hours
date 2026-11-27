import './style.css';
import { loadDay, type DayResult } from './data';
import { formatDay } from './lib/time';

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

type ViewState = 'loading' | 'error' | 'empty' | 'ok';

function show(state: ViewState, message = ''): void {
  card.dataset['state'] = state;
  status.textContent = message;
  retry.hidden = state !== 'error';
}

function render(result: DayResult): void {
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
      dayLabel.textContent = `${result.isFallback ? 'Today' : 'Tomorrow'} · ${formatDay(result.date)}`;
      dayNote.textContent = result.isFallback
        ? "Tomorrow's prices are not published yet, so today's are shown."
        : '';
      show('ok');
      return;
  }
}

async function load(): Promise<void> {
  dayLabel.textContent = 'Day-ahead prices';
  dayNote.textContent = '';
  show('loading', 'Loading prices…');
  render(await loadDay(Date.now()));
}

retry.addEventListener('click', () => void load());
void load();
