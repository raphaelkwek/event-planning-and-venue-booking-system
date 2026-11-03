// EN-14: text made safe for one cell of a Markdown table in a job summary. Backslashes are
// escaped first, so a "\|" already in the text can't turn the escape for "|" back into a column
// break; then "|" is escaped and line breaks become spaces, so a cell stays one cell.
export function markdownCell(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
