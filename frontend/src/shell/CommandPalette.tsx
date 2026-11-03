import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { sectionOf, type NavItem } from "./navigation.js";

/**
 * Ctrl+K (⌘K on a Mac): jump to any screen the role may open. It offers exactly the rail's links,
 * so it can't reach anything the navigation doesn't (A2); the server still decides access.
 */
export function filterItems(items: NavItem[], query: string): NavItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const haystack = `${item.label} ${sectionOf(item.to).label}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function CommandPalette({
  items,
  onSelect,
  onClose,
}: {
  items: NavItem[];
  onSelect: (to: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => filterItems(items, query), [items, query]);
  const active = Math.min(index, Math.max(results.length - 1, 0));

  useEffect(() => {
    input.current?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setIndex((active + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = results[active];
      if (chosen) onSelect(chosen.to);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      // The input is the dialog's only stop; keep focus inside it.
      event.preventDefault();
    }
  }

  return (
    <div className="cs-palette" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="cs-palette__dialog" role="dialog" aria-modal="true" aria-label="Jump to a screen">
        <div className="cs-palette__field">
          <input
            ref={input}
            className="cs-palette__input"
            role="combobox"
            aria-label="Screen"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            placeholder="Type a screen name"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className="cs-kbd">Esc</kbd>
        </div>
        <ul className="cs-palette__list" id={listId} role="listbox" aria-label="Screens">
          {results.map((item, position) => (
            <li
              key={item.to}
              id={`${listId}-${position}`}
              role="option"
              aria-selected={position === active}
              className="cs-palette__option"
              onMouseEnter={() => setIndex(position)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(item.to);
              }}
            >
              <span>{item.label}</span>
              <span className="cs-palette__section">{sectionOf(item.to).label}</span>
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p className="cs-palette__empty" role="status">
            No screen matches.
          </p>
        )}
      </div>
    </div>
  );
}
