import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The redesign's colour rules, checked on the token file itself (frontend/src/theme/tokens.css):
 * WCAG 2.2 AA contrast in both themes, both themes complete, and every inline colour a screen still
 * sets mapped to a token by the legacy bridge (legacy.css), so the dark theme never shows a
 * light-theme colour.
 */

const THEME = join(__dirname, "..", "src", "theme");
const SRC = join(__dirname, "..", "src");
const tokensCss = readFileSync(join(THEME, "tokens.css"), "utf8");
const legacyCss = readFileSync(join(THEME, "legacy.css"), "utf8");

function block(selectorStart: string): Record<string, string> {
  const start = tokensCss.indexOf(selectorStart);
  if (start < 0) throw new Error(`No block for ${selectorStart}`);
  const body = tokensCss.slice(tokensCss.indexOf("{", start) + 1, tokensCss.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/(--cs-[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]!.trim()]));
}

const dark = block(':root,\n:root[data-cs-theme="dark"]');
const light = block(':root[data-cs-theme="light"]');

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

/** Text that must reach 4.5:1 on each surface it sits on. */
const TEXT_PAIRS: [string, string[]][] = [
  ["--cs-text", ["--cs-canvas", "--cs-surface", "--cs-surface-raised", "--cs-surface-overlay", "--cs-surface-input", "--cs-surface-hover"]],
  ["--cs-text-subtle", ["--cs-canvas", "--cs-surface", "--cs-surface-raised", "--cs-surface-overlay", "--cs-surface-hover"]],
  ["--cs-text-subtlest", ["--cs-canvas", "--cs-surface", "--cs-surface-raised", "--cs-surface-overlay", "--cs-surface-input"]],
  ["--cs-accent-text", ["--cs-canvas", "--cs-surface", "--cs-surface-raised", "--cs-surface-overlay", "--cs-info-bg"]],
  ["--cs-on-ink", ["--cs-ink", "--cs-ink-hover", "--cs-ink-pressed"]],
  ["--cs-neutral-text", ["--cs-neutral-bg"]],
  ["--cs-text-subtle", ["--cs-neutral-bg", "--cs-neutral-bg-hover"]],
  ["--cs-on-ink", ["--cs-neutral-bold", "--cs-info-bold", "--cs-discovery-bold", "--cs-danger-bold", "--cs-success-bold"]],
  ["--cs-on-warning", ["--cs-warning-bold"]],
  ...(["info", "discovery", "warning", "danger", "success"] as const).map(
    (family): [string, string[]] => [`--cs-${family}-text`, [`--cs-${family}-bg`, "--cs-surface", "--cs-canvas"]]
  ),
];

/** Boundaries and indicators that must reach 3:1 (WCAG 1.4.11): field outlines and the focus ring. */
const UI_PAIRS: [string, string[]][] = [
  ["--cs-line-input", ["--cs-surface", "--cs-surface-input", "--cs-canvas"]],
  ["--cs-accent", ["--cs-canvas", "--cs-surface", "--cs-surface-raised", "--cs-surface-overlay"]],
];

describe.each([
  ["dark", dark],
  ["light", light],
])("the %s theme", (_name, tokens) => {
  it.each(TEXT_PAIRS.flatMap(([text, backgrounds]) => backgrounds.map((background) => [text, background])))(
    "%s on %s reaches 4.5:1",
    (text, background) => {
      expect(contrast(tokens[text]!, tokens[background]!)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(UI_PAIRS.flatMap(([part, backgrounds]) => backgrounds.map((background) => [part, background])))(
    "%s against %s reaches 3:1",
    (part, background) => {
      expect(contrast(tokens[part]!, tokens[background]!)).toBeGreaterThanOrEqual(3);
    }
  );
});

describe("the token file", () => {
  it("defines the same tokens in both themes", () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it("gives every colour that a contrast check reads as a six-digit hex", () => {
    const checked = new Set([...TEXT_PAIRS, ...UI_PAIRS].flatMap(([part, backgrounds]) => [part, ...backgrounds]));
    for (const tokens of [dark, light]) {
      for (const name of checked) expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []
  );
}

function rgb(hex: string): string {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex;
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(full.slice(index, index + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

describe("the legacy colour bridge", () => {
  it("maps every colour a screen still sets inline to a token", () => {
    const inline = new Set(
      sourceFiles(SRC).flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/"[^"\n]*"/g)]
          .map((match) => match[0])
          .filter((literal) => !literal.includes("var("))
          .flatMap((literal) => [...literal.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)].map((hex) => hex[0].toUpperCase()))
      )
    );
    const unmapped = [...inline].filter((hex) => !legacyCss.includes(rgb(hex)));
    expect(unmapped, "Use a token (var(--cs-…)) in the screen, or map the colour in theme/legacy.css").toEqual([]);
  });
});
