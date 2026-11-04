import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Entity-relationship diagrams, one per bounded-context schema, generated from the migrations.
 *
 *   npm run diagrams:er          rewrite documentation/architecture/data-model/<schema>.puml
 *   npm run diagrams:er:check    fail when a committed .puml differs from the migrations (CI)
 *
 * It reads the migrations the way `npm run migrate:all` applies them (each folder in filename
 * order) and replays only the statements that change the shape of a table: CREATE TABLE,
 * ALTER TABLE ... ADD/DROP COLUMN, ADD CONSTRAINT (primary key, unique, foreign key), ALTER COLUMN
 * SET/DROP NOT NULL, and DROP TABLE. Indexes, checks, triggers, functions and policies do not
 * change what the diagram shows. It needs no database, so it runs on a laptop. The images are
 * rendered from the .puml files by .github/workflows/diagrams.yml.
 */

export interface Column {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  unique: boolean;
}

export interface ForeignKey {
  columns: string[];
  refSchema: string;
  refTable: string;
  /** Empty means "the referenced table's primary key". */
  refColumns: string[];
}

export interface Table {
  schema: string;
  name: string;
  columns: Column[];
  foreignKeys: ForeignKey[];
}

export type Catalogue = Map<string, Table>;

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const OUTPUT_DIR = "documentation/architecture/data-model";

/** Where the migrations live. Each entry is a folder of .sql files applied in filename order. */
export const MIGRATION_FOLDERS: readonly string[] = [
  ...["identity", "event", "venue", "equipment", "change"].map((module) => `backend/services/planning-core/migrations/${module}`),
  "backend/services/registration/migrations",
  "backend/services/notification/migrations",
];

/** The bounded contexts the diagrams cover, in the order the index lists them. */
export const SCHEMAS: readonly string[] = ["identity", "event", "venue", "equipment", "change", "registration", "notification"];

/** Splits SQL into statements, dropping comments and honouring quotes and $$ bodies. */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    const ch = sql[i]!;
    if (two === "--") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
    } else if (two === "/*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else if (ch === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1;
      current += sql.slice(i, j + 1);
      i = j + 1;
    } else if (ch === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end === -1 ? sql.length : end + tag[0].length;
        current += sql.slice(i, stop);
        i = stop;
      } else {
        current += ch;
        i += 1;
      }
    } else if (ch === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      i += 1;
    } else {
      current += ch;
      i += 1;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

/** Empties string literals so keywords inside them cannot be mistaken for syntax. */
function withoutLiterals(statement: string): string {
  return statement.replace(/'(?:[^']|'')*'/g, "''");
}

/** Splits on commas that are not inside parentheses. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Removes `check (...)` and `default (...)`-style balanced groups after a keyword. */
function stripBalanced(text: string, keyword: RegExp): string {
  let result = text;
  for (;;) {
    const match = keyword.exec(result);
    if (!match) return result;
    let i = match.index + match[0].length;
    while (result[i] === " ") i += 1;
    if (result[i] !== "(") return result.slice(0, match.index) + " " + result.slice(i);
    let depth = 0;
    let j = i;
    for (; j < result.length; j += 1) {
      if (result[j] === "(") depth += 1;
      if (result[j] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    result = result.slice(0, match.index) + " " + result.slice(j + 1);
  }
}

const list = (text: string): string[] => text.split(",").map((part) => part.trim().replace(/"/g, "")).filter(Boolean);

const REFERENCES = /references\s+([a-z_0-9]+)\.([a-z_0-9]+)\s*(?:\(([^)]*)\))?/;

function readReference(text: string, columns: string[]): ForeignKey | null {
  const match = REFERENCES.exec(text);
  if (!match) return null;
  return { columns, refSchema: match[1]!, refTable: match[2]!, refColumns: match[3] ? list(match[3]) : [] };
}

const TYPE_END = /\s+(?:not\s+null|null|default|primary\s+key|references|check|unique|generated|constraint|collate)\b/;

function readColumn(item: string): { column: Column; foreignKey: ForeignKey | null } {
  const match = /^"?([a-z_0-9]+)"?\s+(.*)$/s.exec(item);
  if (!match) throw new Error(`Cannot read the column definition: ${item}`);
  const name = match[1]!;
  const rest = stripBalanced(stripBalanced(match[2]!, /\bcheck\b/), /\bdefault\b\s*(?=\()/);
  const end = TYPE_END.exec(` ${rest}`);
  const type = (end ? ` ${rest}`.slice(0, end.index) : rest).trim().replace(/\s+/g, " ");
  const primaryKey = /\bprimary\s+key\b/.test(rest);
  const column: Column = {
    name,
    type,
    primaryKey,
    notNull: primaryKey || /\bnot\s+null\b/.test(rest),
    unique: /\bunique\b/.test(rest),
  };
  return { column, foreignKey: readReference(rest, [name]) };
}

const key = (schema: string, name: string) => `${schema}.${name}`;

function applyTableConstraint(table: Table, item: string): boolean {
  const text = item.replace(/^constraint\s+\S+\s+/, "");
  let match = /^primary\s+key\s*\(([^)]*)\)/.exec(text);
  if (match) {
    for (const name of list(match[1]!)) {
      const column = table.columns.find((c) => c.name === name);
      if (column) {
        column.primaryKey = true;
        column.notNull = true;
      }
    }
    return true;
  }
  match = /^unique\s*\(([^)]*)\)/.exec(text);
  if (match) {
    const names = list(match[1]!);
    const only = names.length === 1 ? table.columns.find((c) => c.name === names[0]) : undefined;
    if (only) only.unique = true;
    return true;
  }
  match = /^foreign\s+key\s*\(([^)]*)\)\s*(.*)$/s.exec(text);
  if (match) {
    const foreignKey = readReference(match[2]!, list(match[1]!));
    if (foreignKey) table.foreignKeys.push(foreignKey);
    return true;
  }
  return /^(check|exclude)\b/.test(text);
}

function createTable(catalogue: Catalogue, statement: string): void {
  const match = /^create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)\.([a-z_0-9]+)\s*\((.*)\)\s*(?:partition\s+by.*)?$/s.exec(statement);
  if (!match) throw new Error(`Cannot read the CREATE TABLE statement (is the table schema-qualified?): ${statement.slice(0, 120)}`);
  const table: Table = { schema: match[1]!, name: match[2]!, columns: [], foreignKeys: [] };
  for (const item of splitTopLevel(match[3]!)) {
    if (/^(constraint|primary\s+key|unique|foreign\s+key|check|exclude)\b/.test(item)) {
      if (!applyTableConstraint(table, item)) throw new Error(`Cannot read the constraint on ${table.schema}.${table.name}: ${item}`);
    } else if (/^like\b/.test(item)) {
      throw new Error(`CREATE TABLE ... LIKE is not supported (${table.schema}.${table.name})`);
    } else {
      const { column, foreignKey } = readColumn(item);
      table.columns.push(column);
      if (foreignKey) table.foreignKeys.push(foreignKey);
    }
  }
  catalogue.set(key(table.schema, table.name), table);
}

function alterTable(catalogue: Catalogue, statement: string): void {
  const match = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([a-z_0-9]+)\.([a-z_0-9]+)\s+(.*)$/s.exec(statement);
  if (!match) return;
  const table = catalogue.get(key(match[1]!, match[2]!));
  if (!table) throw new Error(`ALTER TABLE names ${match[1]}.${match[2]}, which no earlier migration created`);
  for (const action of splitTopLevel(match[3]!)) {
    let m = /^add\s+column\s+(?:if\s+not\s+exists\s+)?(.*)$/s.exec(action);
    if (m) {
      const { column, foreignKey } = readColumn(m[1]!);
      if (!table.columns.some((c) => c.name === column.name)) table.columns.push(column);
      if (foreignKey) table.foreignKeys.push(foreignKey);
      continue;
    }
    m = /^drop\s+column\s+(?:if\s+exists\s+)?"?([a-z_0-9]+)"?/.exec(action);
    if (m) {
      table.columns = table.columns.filter((c) => c.name !== m![1]);
      table.foreignKeys = table.foreignKeys.filter((fk) => !fk.columns.includes(m![1]!));
      continue;
    }
    m = /^alter\s+column\s+"?([a-z_0-9]+)"?\s+(set|drop)\s+not\s+null/.exec(action);
    if (m) {
      const column = table.columns.find((c) => c.name === m![1]);
      if (column) column.notNull = m[2] === "set" || column.primaryKey;
      continue;
    }
    m = /^add\s+(constraint\s+\S+\s+)?(primary\s+key|unique|foreign\s+key)\b(.*)$/s.exec(action);
    if (m) applyTableConstraint(table, `${m[2]}${m[3]}`);
  }
}

/** Replays every migration in `folders` and returns the tables that exist at the end. */
export function buildCatalogue(sqlFiles: readonly string[]): Catalogue {
  const catalogue: Catalogue = new Map();
  for (const file of sqlFiles) {
    for (const raw of splitStatements(file)) {
      const statement = withoutLiterals(raw).toLowerCase().replace(/\s+/g, " ");
      if (statement.startsWith("create table")) createTable(catalogue, statement);
      else if (statement.startsWith("alter table")) alterTable(catalogue, statement);
      else {
        const drop = /^drop\s+table\s+(?:if\s+exists\s+)?([a-z_0-9]+)\.([a-z_0-9]+)/.exec(statement);
        if (drop) catalogue.delete(key(drop[1]!, drop[2]!));
      }
    }
  }
  return catalogue;
}

function sqlFilesIn(folder: string): string[] {
  return readdirSync(join(REPO, folder))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(REPO, folder, name), "utf8"));
}

export function catalogueFromRepository(): Catalogue {
  // The folders are independent databases' schemas in one Postgres; replay them in a fixed order.
  return buildCatalogue(MIGRATION_FOLDERS.flatMap(sqlFilesIn));
}

const entityId = (schema: string, name: string) => `${schema}_${name}`;

function primaryKeyOf(catalogue: Catalogue, schema: string, name: string): string[] {
  return catalogue.get(key(schema, name))?.columns.filter((c) => c.primaryKey).map((c) => c.name) ?? [];
}

function describe(column: Column, foreignKeyColumns: Set<string>): string {
  const marks = [column.primaryKey ? "PK" : "", foreignKeyColumns.has(column.name) ? "FK" : "", column.unique ? "UK" : ""].filter(Boolean);
  const suffix = marks.length ? ` <<${marks.join(", ")}>>` : "";
  return `${column.notNull ? "*" : " "} ${column.name} : ${column.type}${suffix}`;
}

/** The PlantUML source for one schema's diagram. */
export function renderSchema(catalogue: Catalogue, schema: string): string {
  const tables = [...catalogue.values()].filter((t) => t.schema === schema).sort((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [
    `@startuml ${schema}-schema`,
    "' Generated by documentation/scripts/generate-er-diagrams.ts from the migrations. Do not edit by hand.",
    `title ${schema} schema (generated from the migrations)`,
    "hide circle",
    "skinparam linetype ortho",
    "skinparam shadowing false",
    "skinparam entity {",
    "  BackgroundColor #FFFFFF",
    "  BorderColor #1F4E79",
    "}",
    "legend right",
    "  * means NOT NULL. PK primary key, FK foreign key, UK single-column unique.",
    "  Grey entities belong to another schema and are shown only as the target of a foreign key.",
    "endlegend",
    "",
  ];
  const stubs = new Map<string, Table>();
  const relations: string[] = [];
  for (const table of tables) {
    const foreignKeyColumns = new Set(table.foreignKeys.flatMap((fk) => fk.columns));
    lines.push(`entity "${table.name}" as ${entityId(schema, table.name)} {`);
    const primary = table.columns.filter((c) => c.primaryKey);
    const others = table.columns.filter((c) => !c.primaryKey);
    for (const column of primary) lines.push(`  ${describe(column, foreignKeyColumns)}`);
    if (primary.length && others.length) lines.push("  --");
    for (const column of others) lines.push(`  ${describe(column, foreignKeyColumns)}`);
    lines.push("}", "");
    for (const fk of table.foreignKeys) {
      const target = catalogue.get(key(fk.refSchema, fk.refTable));
      if (!target) throw new Error(`${table.schema}.${table.name} references ${fk.refSchema}.${fk.refTable}, which does not exist`);
      if (fk.refSchema !== schema) stubs.set(key(fk.refSchema, fk.refTable), target);
      const optional = fk.columns.some((name) => !table.columns.find((c) => c.name === name)?.notNull);
      const refColumns = fk.refColumns.length ? fk.refColumns : primaryKeyOf(catalogue, fk.refSchema, fk.refTable);
      const label = `${fk.columns.join(", ")} -> ${refColumns.join(", ")}`;
      const to = fk.refSchema === schema ? entityId(schema, fk.refTable) : entityId(fk.refSchema, fk.refTable);
      relations.push(`${entityId(schema, table.name)} }o--${optional ? "o|" : "||"} ${to} : "${label}"`);
    }
  }
  for (const stub of [...stubs.values()].sort((a, b) => key(a.schema, a.name).localeCompare(key(b.schema, b.name)))) {
    lines.push(`entity "${stub.schema}.${stub.name}" as ${entityId(stub.schema, stub.name)} #E8E8E8 {`);
    for (const column of stub.columns.filter((c) => c.primaryKey)) lines.push(`  * ${column.name} : ${column.type} <<PK>>`);
    lines.push("}", "");
  }
  lines.push(...relations, "", "@enduml", "");
  return lines.join("\n");
}

/** Every generated file: relative path -> content. */
export function renderAll(catalogue: Catalogue): Map<string, string> {
  const files = new Map<string, string>();
  for (const schema of SCHEMAS) {
    if (![...catalogue.values()].some((t) => t.schema === schema)) throw new Error(`No table found in the ${schema} schema`);
    files.set(`${OUTPUT_DIR}/${schema}.puml`, renderSchema(catalogue, schema));
  }
  return files;
}

function main(): void {
  const check = process.argv.includes("--check");
  const files = renderAll(catalogueFromRepository());
  const stale: string[] = [];
  for (const [path, content] of files) {
    const absolute = join(REPO, path);
    const current = existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
    if (current === content) continue;
    if (check) stale.push(path);
    else {
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, content);
      console.log(`wrote ${path}`);
    }
  }
  if (existsSync(join(REPO, OUTPUT_DIR))) {
    const expected = new Set([...files.keys()].map((path) => path.slice(OUTPUT_DIR.length + 1)));
    for (const name of readdirSync(join(REPO, OUTPUT_DIR))) {
      if (name.endsWith(".puml") && !expected.has(name)) stale.push(`${OUTPUT_DIR}/${name} (no such schema any more)`);
    }
  }
  if (check && stale.length) {
    console.error(`These diagrams do not match the migrations:\n  ${stale.join("\n  ")}\nRun: npm run diagrams:er, then commit the changed .puml files and re-render the images.`);
    process.exit(1);
  }
  if (check) console.log(`The ${files.size} data-model diagrams match the migrations.`);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
