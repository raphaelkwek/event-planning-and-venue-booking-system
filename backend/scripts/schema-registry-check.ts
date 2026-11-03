#!/usr/bin/env node
import { COMPAT_CASES } from "../packages/contracts/src/compat/cases.js";
import { checkBackwardCompatible, type JsonSchema } from "../packages/contracts/src/compat/schemaCompat.js";
import { generatedSnapshotFiles, nameFromFile } from "../packages/contracts/src/compat/snapshot.js";
import { baseSnapshots } from "./support/schemaFiles.js";

// EN-05 (SPM-123), CI only. Asks a real schema registry, Redpanda's, the question
// the in-process checker answers, so the checker is shown to follow the registry
// and the branch is checked by the registry itself. It never talks to a registry
// but the one SCHEMA_REGISTRY_URL names, and CI starts that one on the runner.
//
//   1. Every case in contracts/src/compat/cases.ts: register the previous schema
//      under a throwaway subject set to BACKWARD, ask whether the next is
//      compatible, and require the checker to give the case's verdict and the
//      registry to give the case's registry verdict (`registry` when the case
//      records that Redpanda differs from JSON Schema's meaning, else `compatible`).
//   2. The branch against its base: register the base ref's schemas, ask about
//      the branch's (BASE_REF; skipped when the base has none yet). This is the
//      check that decides what a deployed registry would accept.
//   3. A control: a breaking change to a real message must be refused.
//
// `npx tsx schema-registry-check.ts cases` runs only 1 and 3, `branch` only 2.

const registry = process.env.SCHEMA_REGISTRY_URL ?? "http://127.0.0.1:8081";
const baseRef = process.env.BASE_REF;
const only = process.argv[2];
const CONTENT_TYPE = "application/vnd.schemaregistry.v1+json";

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

async function call(method: string, path: string, body?: unknown): Promise<Reply> {
  const response = await fetch(`${registry}${path}`, {
    method,
    headers: { "Content-Type": CONTENT_TYPE, Accept: CONTENT_TYPE },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed };
}

const subjectPath = (subject: string) => encodeURIComponent(subject);

async function register(subject: string, schema: JsonSchema): Promise<void> {
  const config = await call("PUT", `/config/${subjectPath(subject)}`, { compatibility: "BACKWARD" });
  if (config.status !== 200) throw new Error(`Could not set ${subject} to BACKWARD: ${config.status} ${JSON.stringify(config.body)}`);
  const created = await call("POST", `/subjects/${subjectPath(subject)}/versions`, {
    schemaType: "JSON",
    schema: JSON.stringify(schema),
  });
  if (created.status !== 200) throw new Error(`Could not register ${subject}: ${created.status} ${JSON.stringify(created.body)}`);
}

async function registryAccepts(subject: string, schema: JsonSchema): Promise<boolean> {
  const reply = await call("POST", `/compatibility/subjects/${subjectPath(subject)}/versions/latest`, {
    schemaType: "JSON",
    schema: JSON.stringify(schema),
  });
  if (reply.status !== 200 || typeof reply.body.is_compatible !== "boolean") {
    throw new Error(`Unexpected reply for ${subject}: ${reply.status} ${JSON.stringify(reply.body)}`);
  }
  return reply.body.is_compatible;
}

async function waitForRegistry(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await call("GET", "/subjects")).status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`The schema registry at ${registry} did not answer.`);
}

async function checkCases(): Promise<string[]> {
  const problems: string[] = [];
  const stamp = Date.now();
  for (const [index, testCase] of COMPAT_CASES.entries()) {
    const subject = `en05-selftest-${stamp}-${index}`;
    await register(subject, testCase.previous);
    const registryVerdict = await registryAccepts(subject, testCase.next);
    const checkerVerdict = checkBackwardCompatible(testCase.previous, testCase.next).length === 0;
    const expectedByRegistry = testCase.registry ?? testCase.compatible;
    const ok = registryVerdict === expectedByRegistry && checkerVerdict === testCase.compatible;
    const note = testCase.registry === undefined ? "" : `  (known: Redpanda says ${testCase.registry})`;
    const line = `${ok ? "agree   " : "DISAGREE"} registry=${registryVerdict} checker=${checkerVerdict} expected=${testCase.compatible}  ${testCase.name}${note}`;
    console.log(line);
    if (!ok) problems.push(line);
  }
  return problems;
}

async function checkBranchAgainstBase(ref: string): Promise<string[]> {
  const base = baseSnapshots(ref);
  if (base === null) {
    console.log(`"${ref}" has no committed schema files yet, so the branch is not compared with it.`);
    return [];
  }
  const head = generatedSnapshotFiles();
  const problems: string[] = [];
  let compared = 0;
  for (const [fileName, text] of base) {
    const name = nameFromFile(fileName);
    const headText = head.get(fileName);
    if (headText === undefined) {
      problems.push(`${name}: removed from the branch`);
      continue;
    }
    const subject = `connectsphere.${name}-${Date.now()}`;
    await register(subject, JSON.parse(text) as JsonSchema);
    compared += 1;
    if (!(await registryAccepts(subject, JSON.parse(headText) as JsonSchema))) {
      problems.push(`${name}: the registry says the branch's schema is not backward compatible with ${ref}`);
    }
  }
  console.log(`The registry compared ${compared} message schemas of the branch with ${ref}.`);
  return problems;
}

async function checkControl(): Promise<string[]> {
  const files = generatedSnapshotFiles();
  const text = files.get("event.approved.json");
  if (!text) return ["event.approved.json is not generated; the control cannot run"];
  const schema = JSON.parse(text) as { properties: Record<string, unknown>; required: string[] };
  const broken = {
    ...schema,
    properties: Object.fromEntries(Object.entries(schema.properties).filter(([name]) => name !== "approvedBy")),
    required: schema.required.filter((name) => name !== "approvedBy"),
  };
  const subject = `en05-control-${Date.now()}`;
  await register(subject, schema);
  const registryVerdict = await registryAccepts(subject, broken);
  const checkerVerdict = checkBackwardCompatible(schema, broken).length === 0;
  console.log(`control (event.approved loses approvedBy): registry=${registryVerdict} checker=${checkerVerdict}, both must be false`);
  return registryVerdict || checkerVerdict ? ["the control, a breaking change to event.approved, was not refused"] : [];
}

async function main(): Promise<number> {
  await waitForRegistry();
  const problems: string[] = [];
  if (only !== "branch") problems.push(...(await checkCases()), ...(await checkControl()));
  if (only !== "cases") {
    if (baseRef) problems.push(...(await checkBranchAgainstBase(baseRef)));
    else console.log("BASE_REF is not set; the branch is not compared with a base.");
  }
  if (problems.length === 0) {
    console.log("The registry and the checker give the expected verdict on every case, and the branch is compatible with its base.");
    return 0;
  }
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  return 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: Error) => {
    console.error(error.message);
    process.exitCode = 2;
  },
);
