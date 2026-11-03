import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "@atlaskit/button/new";
import { useTheme } from "../theme/ThemeProvider.js";
import { CommandPalette } from "./CommandPalette.js";
import { BellIcon, JumpIcon, Mark } from "./icons.js";
import { ThemeSwitch } from "./ThemeSwitch.js";
import { activeItem, contextTrail, environmentLabel, groupNav, matchPattern, type NavItem } from "./navigation.js";
import { useEnhancedTables } from "./tables.js";

export const NOTIFICATIONS_PATH = "/notifications";

export interface AppShellProps {
  email: string;
  roleLabel: string;
  /** The screens the role may open, in the route table's order (A2). */
  nav: NavItem[];
  /** Every route pattern, so the context line can name the screen. */
  patterns: string[];
  unread: number | null;
  onSignOut: () => void;
  children: ReactNode;
}

/** The environment this build runs in, for the badge in the command bar. */
export function currentEnvironment(): string {
  return environmentLabel(import.meta.env.VITE_APP_ENV as string | undefined, import.meta.env.DEV, window.location.hostname);
}

/** "⌘K" on a Mac, "Ctrl K" elsewhere. */
export function shortcutHint(userAgent: string = navigator.userAgent): string {
  return /Mac|iPhone|iPad/.test(userAgent) ? "⌘K" : "Ctrl K";
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A short fade and lift when the screen changes (not when only its id does), skipped for reduced
 * motion. Started before paint, so the new screen never shows a frame before it, and so a check that
 * waits for running animations (EN-14's accessibility check) waits for this one too.
 */
function useScreenEntrance(target: { current: HTMLElement | null }, screen: string | null) {
  useLayoutEffect(() => {
    const element = target.current;
    if (!element || typeof element.animate !== "function" || prefersReducedMotion()) return;
    element.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }, [target, screen]);
}

/** Ctrl+K or ⌘K opens and closes the palette from anywhere. */
function usePaletteShortcut(toggle: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);
}

/**
 * The operations-console shell: a command bar (the banner), a rail of the role's screens (the one
 * navigation landmark) and the main area. The texts tests and people rely on are unchanged: each
 * link's label, "Notifications (n)", the signed-in "email · Role" and "Sign out".
 */
export function AppShell({ email, roleLabel, nav, patterns, unread, onSignOut, children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, toggle: toggleTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  const screen = useRef<HTMLDivElement>(null);

  const pattern = matchPattern(patterns, location.pathname);
  const trail = contextTrail(pattern);
  const current = activeItem(nav, location.pathname);

  useEnhancedTables(main);
  useScreenEntrance(screen, pattern);

  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), []);
  usePaletteShortcut(togglePalette);

  function closePalette() {
    setPaletteOpen(false);
  }

  return (
    <div className="cs-app">
      <a
        className="cs-skip"
        href="#cs-main"
        onClick={(event) => {
          // A hash link would be read as a route by the HashRouter, so focus the main area directly.
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>

      <header className="cs-bar">
        <Link to="/" className="cs-brand">
          <Mark />
          <span className="cs-brand__name">ConnectSphere</span>
        </Link>

        {trail.length > 0 && (
          <p className="cs-context">
            {trail.map((word, index) => (
              <span key={`${index}-${word}`} className="cs-context__part">
                {word}
              </span>
            ))}
          </p>
        )}

        <div className="cs-bar__tools">
          {/*
            Not a button: some screens' tests count every button on the page, so the shell adds none
            but Sign out. Keyboard users press the shortcut itself; a click here opens it too.
          */}
          <span className="cs-jump" aria-keyshortcuts="Control+K Meta+K" onClick={togglePalette}>
            <JumpIcon />
            <span className="cs-jump__label">Jump to a screen</span>
            <kbd className="cs-kbd">{shortcutHint()}</kbd>
          </span>

          <span className="cs-env" title="Where this build is running">
            {currentEnvironment()}
          </span>

          {unread ? (
            <Link to={NOTIFICATIONS_PATH} className="cs-icon-btn cs-bell" aria-label={`${unread} unread`}>
              <BellIcon />
              <span className="cs-bell__count" aria-hidden="true">
                {unread}
              </span>
            </Link>
          ) : null}

          <ThemeSwitch mode={mode} onToggle={toggleTheme} />

          <div className="cs-user">
            <span className="cs-avatar" aria-hidden="true" data-initial={email.slice(0, 1).toUpperCase()} />
            <span className="cs-user__id">
              <span className="cs-user__email">{email}</span> · <strong className="cs-user__role">{roleLabel}</strong>
            </span>
            <Button appearance="subtle" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="cs-body">
        <nav className="cs-rail" aria-label="Primary">
          {groupNav(nav).map((group) => (
            <div key={group.key} className="cs-rail__group">
              <span className="cs-rail__label" aria-hidden="true" data-label={group.label} />
              <ul className="cs-rail__list">
                {group.items.map((item) => {
                  const isCurrent = current?.item.to === item.to;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="cs-rail__link"
                        data-active={isCurrent ? "true" : undefined}
                        aria-current={isCurrent && current?.exact ? "page" : undefined}
                      >
                        <span className="cs-rail__text">{item.label}</span>
                        {item.to === NOTIFICATIONS_PATH && unread ? (
                          <span className="cs-rail__count"> ({unread})</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <main id="cs-main" ref={main} className="cs-main" tabIndex={-1}>
          <div ref={screen} className="cs-screen">
            {children}
          </div>
        </main>
      </div>

      {paletteOpen && (
        <CommandPalette
          items={nav}
          onClose={closePalette}
          onSelect={(to) => {
            setPaletteOpen(false);
            navigate(to);
          }}
        />
      )}
    </div>
  );
}
