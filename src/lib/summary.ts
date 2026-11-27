import { formatRange } from './time';
import type { CheapestWindow } from './window';

/** ct/kWh with one decimal, without a `-0.0`. */
export function formatCt(ctPerKwh: number): string {
  const text = ctPerKwh.toFixed(1);
  return text === '-0.0' ? '0.0' : text;
}

function comparison(windowAvg: number, dailyAvg: number): string {
  // A percentage of a zero or negative average is meaningless, and a negative window would read
  // as "more than 100% below", so both state the difference in ct/kWh instead.
  if (dailyAvg <= 0 || windowAvg < 0) {
    const diff = dailyAvg - windowAvg;
    const direction = diff >= 0 ? 'below' : 'above';
    return `${formatCt(Math.abs(diff))} ct/kWh ${direction} the daily average`;
  }
  const percent = Math.round(((dailyAvg - windowAvg) / dailyAvg) * 100);
  if (percent === 0) return 'at the daily average';
  return `${Math.abs(percent)}% ${percent > 0 ? 'below' : 'above'} the daily average`;
}

/** The summary line of SPEC §4.5, or the no-window message of SPEC §4.4. */
export function summarize(
  window: CheapestWindow | null,
  dailyAvg: number,
  durationHours: number,
): string {
  if (window === null) {
    return `No ${durationHours}-hour window fits into the hours with prices.`;
  }
  return (
    `Cheapest ${durationHours}-hour window: ${formatRange(window.start, window.end)}, ` +
    `avg ${formatCt(window.avgCtPerKwh)} ct/kWh, ${comparison(window.avgCtPerKwh, dailyAvg)}.`
  );
}
