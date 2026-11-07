import { useSyncExternalStore } from "react";

export const THEME_KEY = "wft_theme_v1";
export type AppTheme = "dark" | "light";

type ThemeListener = () => void;
const themeListeners = new Set<ThemeListener>();
let currentTheme: AppTheme | undefined;

export function getStoredTheme(): AppTheme {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

function getThemeSnapshot(): AppTheme {
  currentTheme ??= getStoredTheme();
  return currentTheme;
}

function syncThemeToDocument(theme: AppTheme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("theme-light");
    root.classList.remove("theme-dark");
  } else {
    root.classList.add("theme-dark");
    root.classList.remove("theme-light");
  }
  root.style.colorScheme = theme;
}

function notifyThemeListeners() {
  themeListeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key !== THEME_KEY) return;
  currentTheme = event.newValue === "light" ? "light" : "dark";
  syncThemeToDocument(currentTheme);
  notifyThemeListeners();
}

export function subscribeAppTheme(listener: ThemeListener) {
  themeListeners.add(listener);
    if (themeListeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(listener);
    if (themeListeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** The single reactive source of truth shared by the shell and Settings. */
export function useAppTheme(): AppTheme {
  return useSyncExternalStore(subscribeAppTheme, getThemeSnapshot, () => "dark");
}

export function setAppTheme(theme: AppTheme) {
  currentTheme = theme;
  syncThemeToDocument(theme);
  localStorage.setItem(THEME_KEY, theme);
  notifyThemeListeners();
}

/** Kept as a compatibility alias for callers that used the old imperative API. */
export function applyTheme(theme: AppTheme) {
  setAppTheme(theme);
}

export const COMPACT_KEY = "wft_compact_lists_v1";

export function getCompactRows(): boolean {
  return localStorage.getItem(COMPACT_KEY) === "1";
}

export function setCompactRows(v: boolean) {
  localStorage.setItem(COMPACT_KEY, v ? "1" : "0");
  document.documentElement.setAttribute("data-compact", v ? "1" : "0");
}

export const TZ_KEY = "wft_timezone_v1";

export function getStoredTimezone(): string {
  return localStorage.getItem(TZ_KEY) || "UTC";
}

export function setStoredTimezone(tz: string) {
  localStorage.setItem(TZ_KEY, tz);
}
