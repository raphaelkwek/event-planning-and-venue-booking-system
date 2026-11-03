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

test("repairs for other sprint files are ignored", () => {
  const text = `${HEADER}\nX1,crit,a.test.ts,old\n`;
  const other: Repair = { ...repair(2, "old", "new"), csv: "t.csv" };
  assert.equal(applyRepairs("s.csv", text, [other]).text, text);
});

test("the repair table has 21 distinct lines, and a marker names the story and change that retired the criterion", () => {
  assert.equal(REPAIRS.length, 21);
  assert.equal(new Set(REPAIRS.map((r) => `${r.csv}:${r.line}`)).size, 21);
  for (const r of REPAIRS.filter((x) => x.to.name.startsWith("SUPERSEDED"))) {
    assert.match(r.to.name, /^SUPERSEDED by E[34] \((CR-05|W9-FX-5)\)$/);
    assert.equal(r.to.file, r.from.file, "a superseded row keeps its test_file");
  }
});
