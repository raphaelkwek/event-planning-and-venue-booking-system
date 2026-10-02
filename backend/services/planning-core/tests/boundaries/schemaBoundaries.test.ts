import { describe, expect, it } from "vitest";
import { findSchemaViolations, owningModule } from "../../scripts/schemaBoundaries.js";

describe("owningModule", () => {
  it("names the module a source file belongs to", () => {
    expect(owningModule("src/modules/venue/repo/venues.ts")).toBe("venue");
  });

  it("names the module a migration belongs to, including seed files", () => {
    expect(owningModule("migrations/identity/seed/0001_seed_users.sql")).toBe("identity");
  });

  it("treats shared code and the app wiring as belonging to no module", () => {
    expect(owningModule("src/shared/db.ts")).toBe("shared");
    expect(owningModule("src/app.ts")).toBe("shared");
  });
});

describe("findSchemaViolations", () => {
  it("allows a module to query its own schema", () => {
    const files = [
      { path: "src/modules/event/repo/events.ts", text: "await sql`select * from event.events`;" },
    ];
    expect(findSchemaViolations(files)).toEqual([]);
  });

  it("refuses a module reading another module's schema", () => {
    const files = [
      {
        path: "src/modules/event/repo/owners.ts",
        text: "const a = 1;\nawait sql`select email from identity.users where id = ${id}`;",
      },
    ];
    expect(findSchemaViolations(files)).toEqual([
      expect.objectContaining({
        path: "src/modules/event/repo/owners.ts",
        line: 2,
        module: "event",
        schema: "identity",
      }),
    ]);
  });

  it("catches every statement shape that names a table: join, insert, update, alter, references, index", () => {
    const text = [
      "select 1 from venue.venues v join equipment.equipment_types t on true",
      "insert into equipment.unit_reservations (id) values (1)",
      "update equipment.equipment_types set total_quantity = 0",
      "alter table equipment.units add column x int",
      "venue_id uuid references venue.venues (id)",
      "create index on equipment.units (type_id)",
      "create table if not exists equipment.units (id uuid)",
    ].join("\n");
    const violations = findSchemaViolations([{ path: "src/modules/change/repo/x.ts", text }]);
    expect(violations.map((v) => [v.line, v.schema])).toEqual([
      [1, "venue"],
      [1, "equipment"],
      [2, "equipment"],
      [3, "equipment"],
      [4, "equipment"],
      [5, "venue"],
      [6, "equipment"],
      [7, "equipment"],
    ]);
  });

  it("catches a reference split across lines, and reports the line the schema is on", () => {
    const text = "const rows = await sql`\n  select email\n  from\n    identity.users\n`;";
    const violations = findSchemaViolations([{ path: "src/modules/event/repo/x.ts", text }]);
    expect(violations).toEqual([expect.objectContaining({ line: 4, schema: "identity", text: "identity.users" })]);
  });

  it("is case-insensitive and tolerates quoted schema names", () => {
    const files = [{ path: "migrations/venue/0001_x.sql", text: 'SELECT 1 FROM "event".events' }];
    expect(findSchemaViolations(files)).toHaveLength(1);
  });

  it("refuses shared code touching any module's schema", () => {
    const files = [{ path: "src/shared/health.ts", text: "await sql`select 1 from identity.users limit 1`;" }];
    expect(findSchemaViolations(files)).toEqual([expect.objectContaining({ module: "shared", schema: "identity" })]);
  });

  it("ignores schemas that belong to no module, such as public and Supabase's auth", () => {
    const files = [
      {
        path: "migrations/identity/seed/0001_seed_users.sql",
        text: "insert into public.schema_migrations values (1);\nselect id from auth.users;",
      },
    ];
    expect(findSchemaViolations(files)).toEqual([]);
  });

  it("does not mistake a property access for a schema reference", () => {
    const files = [
      { path: "src/modules/venue/domain/fit.ts", text: "const start = event.proposedStartAt; // read from event" },
    ];
    expect(findSchemaViolations(files)).toEqual([]);
  });
});
