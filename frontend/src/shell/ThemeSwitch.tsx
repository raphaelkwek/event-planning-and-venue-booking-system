import type { ThemeMode } from "../theme/ThemeProvider.js";
import { MoonIcon, SunIcon } from "./icons.js";

/**
 * The theme toggle: a switch, on for the dark theme. A switch is what it is, and it keeps the shell
 * to one button (Sign out), which some screens' tests count on.
 */
export function ThemeSwitch({ mode, onToggle }: { mode: ThemeMode; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mode === "dark"}
      aria-label="Dark theme"
      title={mode === "dark" ? "Dark theme on: switch to light" : "Dark theme off: switch to dark"}
      className="cs-icon-btn cs-theme-switch"
      onClick={onToggle}
    >
      {mode === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
