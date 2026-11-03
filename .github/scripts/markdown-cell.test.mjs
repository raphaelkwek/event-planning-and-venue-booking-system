import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { markdownCell } from "./markdown-cell.mjs";

const BS = "\\";

describe("markdownCell", () => {
  it("leaves plain text alone", () => {
    assert.equal(markdownCell("D4-T1 the coordinator approves"), "D4-T1 the coordinator approves");
  });
  it("escapes a pipe, so it can't start a new column", () => {
    assert.equal(markdownCell("a | b"), `a ${BS}| b`);
  });
  it("escapes backslashes before pipes, so an existing escaped pipe stays text", () => {
    assert.equal(markdownCell(`a ${BS}| b`), `a ${BS}${BS}${BS}| b`);
    assert.equal(markdownCell(`C:${BS}path`), `C:${BS}${BS}path`);
  });
  it("turns line breaks into spaces", () => {
    assert.equal(markdownCell("one\ntwo\r\nthree"), "one two three");
  });
  it("accepts non-strings", () => {
    assert.equal(markdownCell(42), "42");
  });
});
