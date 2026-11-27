/** Rounds a raw step up to 1, 2, 2.5 or 5 times a power of ten, so axis labels stay readable. */
function niceStep(rawStep: number): number {
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Evenly spaced, round axis ticks that cover `[min, max]`, about `count` intervals. The first and
 * last tick are the axis bounds. An empty range is widened to one unit.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const high = max > min ? max : min + 1;
  const step = niceStep((high - min) / count);
  const first = Math.floor(min / step);
  const last = Math.ceil(high / step);
  // Counting in whole steps means floating-point error cannot add or skip a tick; rounding the
  // product removes noise such as 0.30000000000000004.
  return Array.from({ length: last - first + 1 }, (_, i) =>
    Number(((first + i) * step).toFixed(10)),
  );
}
