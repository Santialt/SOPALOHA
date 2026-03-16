export const THEME_STORAGE_KEY = "sopaloha-theme";

const THEME_LIGHT = "light";
const THEME_DARK = "dark";

export function isTheme(value) {
  return value === THEME_LIGHT || value === THEME_DARK;
}

export function getStoredTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function getPreferredTheme() {
  const stored = getStoredTheme();
  if (stored) return stored;

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return THEME_DARK;
  }

  return THEME_LIGHT;
}

export function applyTheme(theme) {
  const safeTheme = isTheme(theme) ? theme : THEME_LIGHT;
  document.documentElement.setAttribute("data-theme", safeTheme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
  } catch {
    // no-op when storage is unavailable
  }

  return safeTheme;
}

export function initTheme() {
  return applyTheme(getPreferredTheme());
}
