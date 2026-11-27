import type { HourPrice } from './lib/prices';
import { niceTicks } from './lib/scale';
import { formatCt } from './lib/summary';
import { formatRange, formatTime } from './lib/time';
import type { CheapestWindow } from './lib/window';

export interface ChartView {
  readonly hours: readonly HourPrice[];
  readonly window: CheapestWindow | null;
  readonly dailyAvg: number;
  readonly durationHours: number;
  /** Text alternative for the whole chart (SPEC §5). */
  readonly label: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 260;
const MARGIN = { top: 24, right: 8, bottom: 28, left: 40 } as const;

function create<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
  text?: string,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  // API-derived values only ever become text nodes (AGENTS.md invariant 6).
  if (text !== undefined) element.textContent = text;
  return element;
}

function node<K extends keyof SVGElementTagNameMap>(
  parent: Element,
  tag: K,
  attributes: Record<string, string | number>,
  text?: string,
): SVGElementTagNameMap[K] {
  const element = create(tag, attributes, text);
  parent.append(element);
  return element;
}

function tickLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

/**
 * Draws the hourly prices as bars (SPEC §4.6): negative bars hang below the zero line, the
 * cheapest window is highlighted, and a dashed line marks the daily average. The SVG is sized
 * to the container in CSS pixels, so text keeps its size on small screens.
 */
export function renderChart(container: HTMLElement, view: ChartView): void {
  const { hours, window } = view;
  const width = Math.max(container.clientWidth, 280);
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const prices = hours.map((h) => h.ctPerKwh);
  const ticks = niceTicks(Math.min(0, ...prices), Math.max(0, ...prices), 5);
  const low = ticks[0] ?? 0;
  const high = ticks.at(-1) ?? 1;
  const y = (value: number) => MARGIN.top + ((high - value) / (high - low)) * plotHeight;
  const band = plotWidth / hours.length;
  const xAt = (index: number) => MARGIN.left + index * band;

  const svg = create('svg', {
    class: 'chart-svg',
    viewBox: `0 0 ${width} ${HEIGHT}`,
    width,
    height: HEIGHT,
    role: 'img',
    'aria-label': view.label,
  });

  node(svg, 'text', { class: 'axis-unit', x: 0, y: 12 }, 'ct/kWh');
  for (const tick of ticks) {
    node(svg, 'line', {
      class: tick === 0 ? 'zero-line' : 'grid-line',
      x1: MARGIN.left,
      x2: width - MARGIN.right,
      y1: y(tick),
      y2: y(tick),
    });
    node(
      svg,
      'text',
      {
        class: 'axis-label',
        x: MARGIN.left - 6,
        y: y(tick),
        'text-anchor': 'end',
        'dominant-baseline': 'middle',
      },
      tickLabel(tick),
    );
  }

  if (window) {
    const x = xAt(window.startIndex);
    const bandWidth = (window.endIndex - window.startIndex) * band;
    node(svg, 'rect', {
      class: 'window-band',
      x,
      y: MARGIN.top,
      width: bandWidth,
      height: plotHeight,
      rx: 4,
    });
    // Centered over the window, but kept inside the plot so it is not cut off at the edges.
    const halfLabel = 40;
    const labelX = Math.min(
      Math.max(x + bandWidth / 2, MARGIN.left + halfLabel),
      width - MARGIN.right - halfLabel,
    );
    node(
      svg,
      'text',
      { class: 'window-label', x: labelX, y: MARGIN.top - 8, 'text-anchor': 'middle' },
      `Cheapest ${view.durationHours} h`,
    );
  }

  const zero = y(0);
  for (const [i, hour] of hours.entries()) {
    const top = y(hour.ctPerKwh);
    const inWindow = window !== null && i >= window.startIndex && i < window.endIndex;
    const bar = node(svg, 'rect', {
      class: inWindow ? 'bar bar-cheap' : 'bar',
      x: xAt(i) + band * 0.14,
      y: Math.min(top, zero),
      width: band * 0.72,
      // A price of exactly zero still gets a visible sliver.
      height: Math.max(Math.abs(zero - top), 1),
      rx: Math.min(3, band * 0.2),
    });
    const range = formatRange(hour.start, hour.start + 3600);
    node(bar, 'title', {}, `${range} · ${formatCt(hour.ctPerKwh)} ct/kWh`);
  }

  const average = y(view.dailyAvg);
  node(svg, 'line', {
    class: 'avg-line',
    x1: MARGIN.left,
    x2: width - MARGIN.right,
    y1: average,
    y2: average,
  });
  node(
    svg,
    'text',
    { class: 'avg-label', x: width - MARGIN.right - 2, y: average - 6, 'text-anchor': 'end' },
    `avg ${formatCt(view.dailyAvg)}`,
  );

  // Every third hour, or every sixth on narrow screens, keeps the labels apart.
  const every = band * 3 < 42 ? 6 : 3;
  for (const [i, hour] of hours.entries()) {
    if (i % every !== 0) continue;
    node(
      svg,
      'text',
      { class: 'axis-label', x: xAt(i) + band / 2, y: HEIGHT - 8, 'text-anchor': 'middle' },
      formatTime(hour.start),
    );
  }

  container.replaceChildren(svg);
}
