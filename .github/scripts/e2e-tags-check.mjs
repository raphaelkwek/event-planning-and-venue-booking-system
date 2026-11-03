// EN-14: every browser journey must say which story and card it runs (plan §5, "Playwright E2E
// tagged with story test ids"). Its title starts with the card id, and its tags include the story
// and the card, e.g. "D4-T1 …" tagged @D4 and @D4-T1, so `--grep @D4` runs a story's journeys.
// Reads the JSON report the e2e job writes and fails, naming each test, if one isn't tagged.
import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync("tests/test-results/results.json", "utf8"));
const CARD = /^((?:[A-Z]+-\d+)|(?:[A-Z]\d*))-T(\d+)\b/;

const problems = [];
let checked = 0;
function walk(suite) {
  for (const spec of suite.specs ?? []) {
    checked++;
    const tags = (spec.tags ?? []).map((tag) => (tag.startsWith("@") ? tag : `@${tag}`));
    const card = CARD.exec(spec.title);
    if (!card) {
      problems.push(`${spec.file} › ${spec.title}: the title doesn't start with a card id`);
      continue;
    }
    const [, story, number] = card;
    for (const wanted of [`@${story}`, `@${story}-T${number}`]) {
      if (!tags.includes(wanted)) problems.push(`${spec.file} › ${spec.title}: missing the tag ${wanted}`);
    }
  }
  for (const child of suite.suites ?? []) walk(child);
}
for (const suite of report.suites ?? []) walk(suite);

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`All ${checked} journeys carry their story and card tags.`);
