import { create } from "zustand";
import {
  getResolvedTheme,
  getStoredThemeMode,
  setThemeMode,
  THEME_CHANGE_EVENT,
  type ResolvedTheme,
  type ThemeMode,
} from "../lib/theme";

interface ThemeStore {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>((set) => {
  // Keep the store's resolved value in sync when the OS theme changes while
  // in "system" mode, or when the other window updates the shared preference.
  if (typeof window !== "undefined") {
    window.addEventListener(THEME_CHANGE_EVENT, () => {
      set({ mode: getStoredThemeMode(), resolved: getResolvedTheme() });
    });
  }

  return {
    mode: getStoredThemeMode(),
    resolved: getResolvedTheme(),
    setMode: (mode) => {
      setThemeMode(mode);
      set({ mode, resolved: getResolvedTheme() });
    },
  };
});
