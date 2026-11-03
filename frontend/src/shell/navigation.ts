import { matchRoutes } from "react-router-dom";

/** One entry in the rail: what App.tsx's route table offers the signed-in role (A2). */
export interface NavItem {
  label: string;
  to: string;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

/**
 * The rail groups screens by the first segment of their path. Labels are lower case here and set in
 * capitals by CSS; the group label is decoration (aria-hidden), the links carry the meaning.
 */
const SECTIONS: { key: string; label: string; segments: string[] }[] = [
  { key: "events", label: "events", segments: ["requests", "drafts", "queue", "events", "review"] },
  { key: "venues", label: "venues", segments: ["venues", "booking-requests", "holds"] },
  { key: "equipment", label: "equipment", segments: ["equipment"] },
  { key: "oversight", label: "oversight", segments: ["assignments"] },
  { key: "safety", label: "safety", segments: ["safety"] },
  { key: "system", label: "system", segments: ["notifications", "console"] },
];

const OTHER = { key: "other", label: "other" };

function segmentsOf(path: string): string[] {
  return (path.split("?")[0] ?? "").split("/").filter(Boolean);
}

export function sectionOf(path: string): { key: string; label: string } {
  const first = segmentsOf(path)[0] ?? "";
  const section = SECTIONS.find((entry) => entry.segments.includes(first));
  return section ? { key: section.key, label: section.label } : OTHER;
}

/** The permitted screens, grouped in a fixed section order, each group keeping the route table's order. */
export function groupNav(items: NavItem[]): NavGroup[] {
  const order = [...SECTIONS.map((entry) => entry.key), OTHER.key];
  const groups = items.reduce<NavGroup[]>((acc, item) => {
    const section = sectionOf(item.to);
    const existing = acc.find((group) => group.key === section.key);
    return existing
      ? acc.map((group) => (group === existing ? { ...group, items: [...group.items, item] } : group))
      : [...acc, { key: section.key, label: section.label, items: [item] }];
  }, []);
  return [...groups].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

/** The route pattern the router would pick for this path, with the router's own ranking. */
export function matchPattern(patterns: string[], pathname: string): string | null {
  const matches = matchRoutes(
    patterns.map((path) => ({ path })),
    pathname
  );
  return matches?.[0]?.route.path ?? null;
}

/**
 * The context line: the section, then each fixed word of the matched route, so "/venues/:id/availability"
 * reads "venues / availability". Ids are left out, so the line is the same for every record.
 */
export function contextTrail(pattern: string | null): string[] {
  if (!pattern) return [];
  const section = sectionOf(pattern);
  const words = segmentsOf(pattern)
    .filter((segment) => !segment.startsWith(":"))
    .map((segment) => segment.replace(/-/g, " "));
  const trail = words[0] === section.label ? words : [section.label, ...words];
  return trail.filter((word, index) => index === 0 || word !== trail[index - 1]);
}

/**
 * The rail item for where the user is: the exact screen, or else the longest item whose path the
 * current one sits under ("/venues/abc" is under "Venues").
 */
export function activeItem(items: NavItem[], pathname: string): { item: NavItem; exact: boolean } | null {
  const exact = items.find((item) => item.to === pathname);
  if (exact) return { item: exact, exact: true };
  const under = items
    .filter((item) => pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return under ? { item: under, exact: false } : null;
}

/** The environment badge: VITE_APP_ENV when a deployment sets it, otherwise where the app is running. */
export function environmentLabel(configured: string | undefined, isDev: boolean, hostname: string): string {
  if (configured && configured.trim().length > 0) return configured.trim().toLowerCase();
  if (isDev) return "dev";
  return hostname === "localhost" || hostname === "127.0.0.1" ? "local" : "hosted";
}
