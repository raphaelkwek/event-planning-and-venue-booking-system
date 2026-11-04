import { test } from "node:test";
import assert from "node:assert/strict";
import { REPAIRS, applyRepairs, csvField, type Repair } from "./repoint-traceability-rows.ts";

const HEADER = "story_id,acceptance_criterion,test_file,test_name";

const repair = (line: number, from: string, to: string, file = "a.test.ts"): Repair => ({
  csv: "s.csv",
  line,
  from: { file, name: from },
  to: { file, name: to },
});

test("csvField quotes only what needs it", () => {
  assert.equal(csvField("plain name"), "plain name");
  assert.equal(csvField("one, two"), '"one, two"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
});

test("renames a test, keeping the rest of the row and the line endings", () => {
  const text = `${HEADER}\r\nX1,"crit, with comma",a.test.ts,"old name"\r\nX2,crit,b.test.ts,other\r\n`;
  const result = applyRepairs("s.csv", text, [repair(2, "old name", "new name, longer")]);
  assert.equal(result.text, `${HEADER}\r\nX1,"crit, with comma",a.test.ts,"new name, longer"\r\nX2,crit,b.test.ts,other\r\n`);
  assert.deepEqual(result.changed, [2]);
});

test("quotes a name that was written without quotes although it holds a comma", () => {
  const text = `${HEADER}\nX1,crit,a.test.ts,keeps a comma, and more\n`;
  const result = applyRepairs("s.csv", text, [repair(2, "keeps a comma, and more", "keeps a comma, and more")]);
  assert.equal(result.text, `${HEADER}\nX1,crit,a.test.ts,"keeps a comma, and more"\n`);
});

test("moves a row to another test file", () => {
  const text = `${HEADER}\nX1,crit,old.test.ts,gone\n`;
  const result = applyRepairs("s.csv", text, [
    { csv: "s.csv", line: 2, from: { file: "old.test.ts", name: "gone" }, to: { file: "new.test.ts", name: "present" } },
  ]);
  assert.equal(result.text, `${HEADER}\nX1,crit,new.test.ts,present\n`);
});

test("applying the same repairs twice changes nothing the second time", () => {
  const text = `${HEADER}\nX1,crit,a.test.ts,old\nX2,crit,a.test.ts,SUPERSEDED by E4 (W9-FX-5)\n`;
  const repairs = [repair(2, "old", "SUPERSEDED by E3 (CR-05)")];
  const once = applyRepairs("s.csv", text, repairs);
  const twice = applyRepairs("s.csv", once.text, repairs);
  assert.equal(twice.text, once.text);
  assert.deepEqual(twice.changed, []);
  assert.deepEqual(twice.alreadyDone, [2]);
});

test("refuses a line that is not as the repair expects, rather than guessing", () => {
  const text = `${HEADER}\nX1,crit,a.test.ts,something else\n`;
  assert.throws(() => applyRepairs("s.csv", text, [repair(2, "old", "new")]), /s\.csv:2 does not end with/);
  assert.throws(() => applyRepairs("s.csv", text, [repair(9, "old", "new")]), /s\.csv:9 does not exist/);
});

test("repairs for other story files are ignored", () => {
  const text = `${HEADER}\nX1,crit,a.test.ts,old\n`;
  const other: Repair = { ...repair(2, "old", "new"), csv: "t.csv" };
  assert.equal(applyRepairs("s.csv", text, [other]).text, text);
});

test("the repair table names 70 distinct lines of the per-story files, each changed by its repair", () => {
  assert.equal(REPAIRS.length, 70);
  assert.equal(new Set(REPAIRS.map((r) => `${r.csv}:${r.line}`)).size, 70);
  for (const r of REPAIRS) {
    assert.match(r.csv, /^sprint-\d+\/[A-Z0-9-]+\.csv$/, `${r.csv} is a story's file`);
    // The same file and name is a repair only when it quotes a name that holds a comma (EN-07.csv:9).
    const same = r.to.file === r.from.file && r.to.name === r.from.name;
    assert.ok(!same || r.from.name.includes(","), `${r.csv}:${r.line} changes the row, or quotes its name`);
  }
});

test("a superseded marker names the story and change that retired the criterion, and keeps the test_file", () => {
  const markers = REPAIRS.filter((r) => r.to.name.startsWith("SUPERSEDED"));
  assert.ok(markers.length > 0);
  for (const r of markers) {
    assert.match(r.to.name, /^SUPERSEDED by E[34] \((CR-05|W9-FX-5)\)$/);
    assert.equal(r.to.file, r.from.file, "a superseded row keeps its test_file");
  }
});

test("a row moved to a card names a card file under tests/<STORY>/ and a heading that starts with the card's id", () => {
  const carded = REPAIRS.filter((r) => r.to.file.endsWith(".md"));
  assert.ok(carded.length > 0);
  for (const r of carded) {
    const id = r.to.name.split(" ")[0]!;
    assert.match(id, /^[A-Z0-9-]+-T\d+$/);
    assert.equal(r.to.file, `tests/${id.replace(/-T\d+$/, "")}/${r.to.file.split("/").pop()}`);
    assert.ok(r.to.file.split("/").pop()!.startsWith(`${id}-`), `${r.to.file} is ${id}'s card`);
    assert.ok(r.to.name.startsWith(`${id} — `), "the card's heading, as check-traceability wants it");
  }
});
