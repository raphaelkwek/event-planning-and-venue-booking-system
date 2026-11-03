import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setGlobalTheme } from "@atlaskit/tokens";

/**
 * The colour theme: dark (the operations console) by default, or light. The choice is remembered
 * in this browser. tokens.css holds both palettes; atlaskit.css themes Atlaskit from them.
 */
export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "connectsphere.theme";
const DEFAULT_THEME: ThemeMode = "dark";

export function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
  } catch {
    // Storage can be unavailable (a private window, blocked site data); the default still works.
    return DEFAULT_THEME;
  }
}

function storeTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Not remembering the choice is not a reason to refuse it.
  }
}

/**
 * Our tokens switch on <html data-cs-theme>, at once. Atlaskit's switch on data-color-mode, which
 * setGlobalTheme sets once it has loaded that theme's token values. If it can't load them, the
 * components fall back to the values atlaskit.css gives them, which already follow our tokens.
 */
export function applyTheme(mode: ThemeMode): Promise<void> {
  document.documentElement.dataset.csTheme = mode;
  return setGlobalTheme({ colorMode: mode, contrastMode: "no-preference", light: "light", dark: "dark", spacing: "spacing" }).then(
    () => undefined,
    () => undefined
  );
}

interface ThemeValue {
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    void applyTheme(mode);
  }, [mode]);

  const toggle = useCallback(() => {
    const next = mode === "dark" ? "light" : "dark";
    storeTheme(next);
    setMode(next);
  }, [mode]);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside a ThemeProvider");
  return value;
}
