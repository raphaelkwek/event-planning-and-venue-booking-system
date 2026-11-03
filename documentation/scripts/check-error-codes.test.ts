import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES } from "../../backend/packages/contracts/src/errorCodes.ts";
import { errorCodeProblems, firstUnsorted, readSpecEnums } from "./check-error-codes.ts";

const PLANNING = "documentation/api/planning-core.openapi.yaml";
const REGISTRATION = "documentation/api/registration.openapi.yaml";

test("firstUnsorted finds the first pair out of order, or a repeat", () => {
  assert.equal(firstUnsorted(["A", "B_C", "B_D"]), null);
  assert.deepEqual(firstUnsorted(["A", "C", "B"]), ["C", "B"]);
  assert.deepEqual(firstUnsorted(["A", "A"]), ["A", "A"]);
});

test("errorCodeProblems wants sorted lists, planning-core's enum equal to ERROR_CODES and the others a subset", () => {
  assert.deepEqual(errorCodeProblems(["A", "B", "C"], [{ file: PLANNING, codes: ["A", "B", "C"] }, { file: REGISTRATION, codes: ["B"] }]), []);
  assert.deepEqual(errorCodeProblems(["B", "A"], []), ["ERROR_CODES: A must come before B (keep the codes in alphabetical order, without repeats)"]);
  assert.deepEqual(errorCodeProblems(["A", "B"], [{ file: PLANNING, codes: ["A", "Z"] }, { file: REGISTRATION, codes: ["B", "A"] }]), [
    `${PLANNING}: Z is not in ERROR_CODES`,
    `${PLANNING}: ERROR_CODES has B, the ErrorCode enum does not`,
    `${REGISTRATION}: A must come before B (keep the codes in alphabetical order, without repeats)`,
  ]);
});

test("the repository's error codes and OpenAPI enums are sorted and consistent", () => {
  const specs = readSpecEnums(join(dirname(fileURLToPath(import.meta.url)), "..", "api"));
  assert.ok(specs.some((s) => s.file === PLANNING));
  assert.deepEqual(errorCodeProblems(ERROR_CODES, specs), []);
});
