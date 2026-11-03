import type { ReactNode } from "react";
import { useTheme } from "../theme/ThemeProvider.js";
import { currentEnvironment } from "./AppShell.js";
import { Mark } from "./icons.js";
import { ThemeSwitch } from "./ThemeSwitch.js";

/**
 * The frame around the sign-in screen: a console-style brand panel beside the form. It has no
 * banner or navigation landmark, since nobody is signed in yet (A1's tests look for none).
 */
export function LoginFrame({ children }: { children: ReactNode }) {
  const { mode, toggle } = useTheme();
  return (
    <div className="cs-login">
      <div className="cs-login__brand">
        <div className="cs-login__mark">
          <Mark size={28} />
        </div>
        <p className="cs-login__tagline">Event planning and venue booking</p>
        <dl className="cs-login__readout">
          <div>
            <dt>env</dt>
            <dd>{currentEnvironment()}</dd>
          </div>
          <div>
            <dt>time zone</dt>
            <dd>Asia/Singapore</dd>
          </div>
        </dl>
      </div>
      <main className="cs-login__panel">
        <div className="cs-login__theme">
          <ThemeSwitch mode={mode} onToggle={toggle} />
        </div>
        {children}
      </main>
    </div>
  );
}
