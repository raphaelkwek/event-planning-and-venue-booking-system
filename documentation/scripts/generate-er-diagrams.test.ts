import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMAS, buildCatalogue, catalogueFromRepository, renderAll, renderSchema, splitStatements, splitTopLevel } from "./generate-er-diagrams.js";

const REPO = fileURLToPath(new URL("../../", import.meta.url));

test("ER-T1 statements are split on semicolons outside comments, quotes and $$ bodies", () => {
  const sql = "-- a; comment\ncreate table s.a (x text default 'a;b'); /* c; */ create function s.f() returns int language sql as $$ select 1; $$;";
  assert.equal(splitStatements(sql).length, 2);
});

test("ER-T2 top-level commas ignore those inside parentheses", () => {
  assert.deepEqual(splitTopLevel("a numeric(10,2), b text check (b in ('x','y')), c int"), ["a numeric(10,2)", "b text check (b in ('x','y'))", "c int"]);
});

test("ER-T3 a later migration's columns, keys and drops are replayed on the table", () => {
  const catalogue = buildCatalogue([
    "create table s.parent (id uuid primary key); create table s.old (id uuid primary key);",
    `create table s.child (
       id uuid primary key default gen_random_uuid(),
       parent_id uuid not null references s.parent (id),
       status text not null check (status in ('A', 'B')),
       note text default 'x, y',
       constraint child_unique unique (note)
     );`,
    `alter table s.child add column other_id uuid, add column amount numeric(10,2) not null default 0;
     alter table s.child add constraint child_other_fkey foreign key (other_id) references s.parent (id) not valid;
     alter table s.child alter column parent_id drop not null;
     alter table s.child drop column note;
     drop table s.old;`,
  ]);
  assert.equal(catalogue.has("s.old"), false);
  const child = catalogue.get("s.child")!;
  assert.deepEqual(child.columns.map((c) => c.name), ["id", "parent_id", "status", "other_id", "amount"]);
  assert.equal(child.columns.find((c) => c.name === "amount")!.type, "numeric(10,2)");
  assert.equal(child.columns.find((c) => c.name === "parent_id")!.notNull, false);
  assert.deepEqual(child.foreignKeys.map((fk) => fk.columns), [["parent_id"], ["other_id"]]);
  const text = renderSchema(catalogue, "s");
  assert.match(text, /s_child \}o--\|\| s_parent|s_child \}o--o\| s_parent/);
  assert.match(text, /other_id -> id/);
});

test("ER-T4 a table that is not schema-qualified is refused rather than guessed", () => {
  assert.throws(() => buildCatalogue(["create table plain (id int);"]), /schema-qualified/);
});

test("ER-T5 every bounded context has tables, and every foreign key points at a table that exists", () => {
  const catalogue = catalogueFromRepository();
  for (const schema of SCHEMAS) assert.ok([...catalogue.values()].some((t) => t.schema === schema), `no tables in ${schema}`);
  assert.ok(catalogue.has("event.events") && catalogue.has("registration.registrations") && catalogue.has("venue.holds"));
  assert.equal(catalogue.has("event.event_drafts"), false, "event_drafts was dropped by migration 0002");
  assert.doesNotThrow(() => renderAll(catalogue));
});

test("ER-T6 the committed diagrams are what the migrations generate", () => {
  for (const [path, content] of renderAll(catalogueFromRepository())) {
    assert.ok(existsSync(join(REPO, path)), `${path} is missing: run npm run diagrams:er`);
    assert.equal(readFileSync(join(REPO, path), "utf8"), content, `${path} is stale: run npm run diagrams:er`);
  }
});
