/** The shell's few icons, drawn inline (no icon library). All are decorative: the control names itself. */

const common = { "aria-hidden": true, focusable: false, fill: "none", stroke: "currentColor", strokeWidth: 1.5 } as const;

/** ConnectSphere's mark: a sphere, its orbit and one connected node. */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg {...common} width={size} height={size} viewBox="0 0 24 24" className="cs-mark">
      <circle cx="12" cy="12" r="6.5" />
      <ellipse cx="12" cy="12" rx="10.5" ry="3.6" transform="rotate(-24 12 12)" />
      <circle className="cs-mark__node" cx="20.6" cy="7.9" r="1.9" stroke="none" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg {...common} width="16" height="16" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg {...common} width="16" height="16" viewBox="0 0 24 24">
      <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg {...common} width="16" height="16" viewBox="0 0 24 24">
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

export function JumpIcon() {
  return (
    <svg {...common} width="14" height="14" viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}
