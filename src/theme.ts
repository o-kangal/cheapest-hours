type Theme = 'light' | 'dark';

/** Shared with public/theme.js, which applies the saved choice before the first paint. */
const STORAGE_KEY = 'theme';

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function currentTheme(): Theme {
  const chosen = document.documentElement.dataset['theme'];
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return systemDark.matches ? 'dark' : 'light';
}

/**
 * Wires the light/dark switch. Until it is used the page follows the system setting; a click
 * picks the other theme and remembers it in this browser. The icon is chosen by CSS.
 */
export function setUpThemeToggle(button: HTMLButtonElement): void {
  const describe = () => {
    const label = `Switch to ${currentTheme() === 'dark' ? 'light' : 'dark'} theme`;
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  button.addEventListener('click', () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the switch still works for this visit.
    }
    describe();
  });

  systemDark.addEventListener('change', describe);
  describe();
}
