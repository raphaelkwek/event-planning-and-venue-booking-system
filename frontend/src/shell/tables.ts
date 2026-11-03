import { useEffect, type RefObject } from "react";

/**
 * Dense data, from the shell, without touching the screens.
 *
 * Each table under the main area gets, on every render:
 * - data-label on its cells, the text of the column's header, so a narrow screen can show each row
 *   as a card with its labels (shell.css);
 * - explicit table roles, because some browsers drop a table's semantics once CSS changes its
 *   display for that card layout;
 * - data-cs-cell on cells, and on <dd>, that hold a reference, a number, a date or time, or nothing,
 *   so those are set in IBM Plex Mono with tabular figures.
 * Nothing here changes text, so the screens and their tests read exactly what they did before.
 */

export type CellKind = "ref" | "num" | "time" | "empty";

const REFERENCE = /^[A-Z]{2,5}-\d{3,}$/;
const NUMBER = /^[+-]?\d[\d,]*(\.\d+)?( ?(%|×|x) ?\d*)?$/;
const DATE_OR_TIME = /^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2})/;
const EMPTY = /^[—–-]$/;

export function classifyCell(text: string): CellKind | null {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length === 0 || value.length > 48) return null;
  if (EMPTY.test(value)) return "empty";
  if (REFERENCE.test(value)) return "ref";
  if (NUMBER.test(value)) return "num";
  if (DATE_OR_TIME.test(value)) return "time";
  return null;
}

function setIfChanged(element: Element, name: string, value: string | null) {
  if (value === null) {
    if (element.hasAttribute(name)) element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function headerLabels(table: HTMLTableElement): string[] {
  const headerRow = table.tHead?.rows[0] ?? null;
  if (!headerRow) return [];
  return Array.from(headerRow.cells).flatMap((cell) => Array<string>(cell.colSpan || 1).fill(cell.textContent?.trim() ?? ""));
}

function enhanceTable(table: HTMLTableElement) {
  if (!table.hasAttribute("role")) table.setAttribute("role", "table");
  const labels = headerLabels(table);
  for (const section of [table.tHead, ...Array.from(table.tBodies), table.tFoot]) {
    if (section && !section.hasAttribute("role")) section.setAttribute("role", "rowgroup");
  }
  for (const row of Array.from(table.rows)) {
    if (!row.hasAttribute("role")) row.setAttribute("role", "row");
    let column = 0;
    for (const cell of Array.from(row.cells)) {
      const inHead = cell.parentElement?.parentElement === table.tHead;
      // A <th> outside the head keeps its own role: whether it heads a row depends on the screen.
      if (!cell.hasAttribute("role") && (inHead || cell.tagName === "TD")) cell.setAttribute("role", inHead ? "columnheader" : "cell");
      if (!inHead) {
        const label = labels[column];
        setIfChanged(cell, "data-label", label ? label : null);
        setIfChanged(cell, "data-cs-cell", classifyCell(cell.textContent ?? ""));
      }
      column += cell.colSpan || 1;
    }
  }
}

export function enhanceTables(root: ParentNode) {
  root.querySelectorAll("table").forEach((table) => enhanceTable(table));
  root.querySelectorAll("dd").forEach((dd) => setIfChanged(dd, "data-cs-cell", classifyCell(dd.textContent ?? "")));
}

/** Keeps the tables under `ref` enhanced as screens load and change. */
export function useEnhancedTables(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof MutationObserver === "undefined") return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enhanceTables(root);
      });
    };
    enhanceTables(root);
    // Attributes are not observed, so the attributes set here never trigger another pass.
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref]);
}
