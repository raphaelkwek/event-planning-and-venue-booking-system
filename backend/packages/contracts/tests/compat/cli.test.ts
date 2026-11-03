import { describe, expect, it } from "vitest";
import { EXIT_BREAKING, EXIT_OK, EXIT_USAGE, runCli, type CliDeps } from "../../src/compat/cli.js";
import { canonicalJson } from "../../src/compat/snapshot.js";

const file = (schema: unknown) => canonicalJson(schema);

const approved = (extra: Record<string, unknown> = {}, required = ["id", "approvedBy"]) =>
  file({
    type: "object",
    properties: { id: { type: "string" }, approvedBy: { type: "string" }, ...extra },
    required,
    additionalProperties: false,
  });

interface Fake {
  deps: CliDeps;
  printed: string[];
  written: Map<string, string>[];
}

function fake(options: {
  generated?: Map<string, string>;
  committed?: Map<string, string>;
  base?: Map<string, string> | null | Error;
}): Fake {
  const printed: string[] = [];
  const written: Map<string, string>[] = [];
  const deps: CliDeps = {
    generated: () => options.generated ?? new Map(),
    committed: () => options.committed ?? new Map(),
    writeCommitted: (files) => {
      written.push(files);
    },
    baseSnapshots: () => {
      if (options.base instanceof Error) throw options.base;
      return options.base ?? null;
    },
    print: (line) => printed.push(line),
  };
  return { deps, printed, written };
}

describe("EN-05-T4 schemas:generate and schemas:check", () => {
  it("EN-05-T4 generate writes every generated file and says how many", () => {
    const generated = new Map([["event.approved.json", approved()]]);
    const { deps, printed, written } = fake({ generated });
    expect(runCli(["generate"], deps)).toBe(EXIT_OK);
    expect(written).toEqual([generated]);
    expect(printed).toEqual(["Wrote 1 schema files."]);
  });

  it("EN-05-T4 check passes when the committed files are exactly the generated ones", () => {
    const files = new Map([["event.approved.json", approved()]]);
    const { deps, printed } = fake({ generated: files, committed: new Map(files) });
    expect(runCli(["check"], deps)).toBe(EXIT_OK);
    expect(printed).toEqual(["The 1 committed schema files match contracts."]);
  });

  it("EN-05-T4 check fails and names a file whose contents differ", () => {
    const { deps, printed } = fake({
      generated: new Map([["event.approved.json", approved()]]),
      committed: new Map([["event.approved.json", approved({ note: { type: "string" } })]]),
    });
    expect(runCli(["check"], deps)).toBe(EXIT_BREAKING);
    expect(printed).toEqual([
      "differs: event.approved.json is not what contracts generates",
      "Run `npm run schemas:generate` and commit the result.",
    ]);
  });

  it("EN-05-T4 check fails and names a file that was never committed", () => {
    const { deps, printed } = fake({ generated: new Map([["event.new.json", approved()]]) });
    expect(runCli(["check"], deps)).toBe(EXIT_BREAKING);
    expect(printed[0]).toBe("missing: event.new.json is not committed");
  });

  it("EN-05-T4 check fails and names a committed file whose message type is gone", () => {
    const { deps, printed } = fake({ committed: new Map([["event.gone.json", approved()]]) });
    expect(runCli(["check"], deps)).toBe(EXIT_BREAKING);
    expect(printed[0]).toBe("stale: event.gone.json has no schema in contracts");
  });
});

describe("EN-05-T5 schemas:compat", () => {
  const generated = (extra: Record<string, unknown> = {}, required?: string[]) =>
    new Map([["event.approved.json", approved(extra, required)]]);

  it("EN-05-T5 exits 0 and says so when the branch changes nothing", () => {
    const { deps, printed } = fake({ generated: generated(), base: generated() });
    expect(runCli(["compat", "--base", "origin/main"], deps)).toBe(EXIT_OK);
    expect(printed[0]).toBe("Compared against origin/main: 1 unchanged, 0 changed compatibly, 0 new, 0 breaking.");
  });

  it("EN-05-T5 exits 0 when the branch adds an optional field", () => {
    const { deps, printed } = fake({ generated: generated({ note: { type: "string" } }), base: generated() });
    expect(runCli(["compat", "--base", "origin/main"], deps)).toBe(EXIT_OK);
    expect(printed).toContain("  changed compatibly: event.approved");
  });

  it("EN-05-T5 exits 1 and prints the finding when the branch removes a required field", () => {
    const head = new Map([
      [
        "event.approved.json",
        file({ type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false }),
      ],
    ]);
    const { deps, printed } = fake({ generated: head, base: generated() });
    expect(runCli(["compat", "--base", "origin/main"], deps)).toBe(EXIT_BREAKING);
    expect(printed.some((line) => line.startsWith("  BREAKING event.approved $.approvedBy [property-removed]"))).toBe(true);
  });

  it("EN-05-T5 exits 0 and says there is nothing to compare when the base has no schema files yet", () => {
    const { deps, printed } = fake({ generated: generated(), base: null });
    expect(runCli(["compat", "--base", "origin/main"], deps)).toBe(EXIT_OK);
    expect(printed).toEqual(['"origin/main" has no committed schema files yet, so there is nothing to compare with.']);
  });

  it("EN-05-T5 exits non-zero and names the ref when the ref cannot be read", () => {
    const { deps, printed } = fake({ generated: generated(), base: new Error("no such ref") });
    expect(runCli(["compat", "--base", "nope"], deps)).toBe(EXIT_USAGE);
    expect(printed).toEqual(['Cannot read the schemas at "nope": no such ref']);
  });

  it("EN-05-T5 exits non-zero when a schema file at the base is not JSON", () => {
    const { deps, printed } = fake({ generated: generated(), base: new Map([["event.approved.json", "{not json"]]) });
    expect(runCli(["compat", "--base", "origin/main"], deps)).toBe(EXIT_USAGE);
    expect(printed).toEqual(["origin/main: event.approved.json is not valid JSON"]);
  });

  it("EN-05-T5 exits non-zero without --base, or with --base and nothing after it", () => {
    for (const args of [["compat"], ["compat", "--base"]]) {
      const { deps, printed } = fake({ generated: generated() });
      expect(runCli(args, deps)).toBe(EXIT_USAGE);
      expect(printed).toEqual(["usage: schema-compat generate | check | compat --base <git-ref>"]);
    }
  });

  it("EN-05-T5 exits non-zero for a command it does not know, or none", () => {
    for (const args of [["frobnicate"], []]) {
      const { deps, printed } = fake({});
      expect(runCli(args, deps)).toBe(EXIT_USAGE);
      expect(printed).toEqual(["usage: schema-compat generate | check | compat --base <git-ref>"]);
    }
  });
});
