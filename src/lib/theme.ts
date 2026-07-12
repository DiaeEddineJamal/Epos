// Frontend-only theming. The chosen mode is persisted in localStorage (shared
// across the main window and the recording overlay, which are same-origin
// webviews) and applied by stamping `data-theme` on <html>. All color tokens
// live in App.css / RecordingOverlay.css and react to that attribute.

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "epos-theme";
export const THEME_CHANGE_EVENT = "epos-theme-change";

const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export function getStoredThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage may be unavailable in some webview contexts.
  }
  return "system";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return prefersDark() ? "dark" : "light";
  return mode;
}

function applyResolved(resolved: ResolvedTheme) {
  // Tailwind `dark:` utilities use a class-based strategy (.dark on <html>).
  document.documentElement.classList.toggle("dark", resolved === "dark");
  // Kept for any attribute-based selectors / debugging.
  document.documentElement.setAttribute("data-theme", resolved);
}

function broadcast() {
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore persistence failures — the in-session apply still works.
  }
  applyResolved(resolveTheme(mode));
  broadcast();
}

export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getStoredThemeMode());
}

// Apply the persisted theme immediately and keep it in sync with the OS
// (when in "system" mode) and with the other window (via storage events).
// Safe to call once per webview during bootstrap.
export function initTheme() {
  applyResolved(getResolvedTheme());

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    if (getStoredThemeMode() === "system") {
      applyResolved(resolveTheme("system"));
      broadcast();
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      applyResolved(getResolvedTheme());
      broadcast();
    }
  });
}
