// Applies the theme saved by the switch (src/theme.ts) before the first paint, so the page never
// flashes in the other theme. Plain script on purpose: it loads blocking in <head>.
/* global document */
try {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch {
  // Storage can be blocked (private mode, strict settings); the system theme applies then.
}
