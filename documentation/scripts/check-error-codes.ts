#!/usr/bin/env node
/**
 * Part of `npm run lint:api`. Contracts' ERROR_CODES and every OpenAPI `ErrorCode` enum must be in
 * alphabetical order, so that a new code goes in its own place instead of at the end, where every
 * pull request used to add one and conflict. planning-core's enum must hold exactly ERROR_CODES;
 * another service's enum lists the codes it returns, so it must be a subset.
 *
 * Usage: tsx documentation/scripts/check-error-codes.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { ERROR_CODES } from "../../backend/packages/contracts/src/errorCodes.ts";

export interface SpecEnum {
  file: string;
  codes: string[];
}

/** The first pair of neighbours out of alphabetical (code unit) order, or null. */
export function firstUnsorted(codes: readonly string[]): [string, string] | null {
  for (let i = 1; i < codes.length; i++) if (codes[i - 1]! >= codes[i]!) return [codes[i - 1]!, codes[i]!];
  return null;
}

export function errorCodeProblems(contracts: readonly string[], specs: SpecEnum[]): string[] {
  const order = (where: string, codes: readonly string[]) => {
    const pair = firstUnsorted(codes);
    return pair ? [`${where}: ${pair[1]} must come before ${pair[0]} (keep the codes in alphabetical order, without repeats)`] : [];
  };
  const known = new Set(contracts);
  return [
    ...order("ERROR_CODES", contracts),
    ...specs.flatMap(({ file, codes }) => {
      const listed = new Set(codes);
      const unknown = codes.filter((code) => !known.has(code)).map((code) => `${file}: ${code} is not in ERROR_CODES`);
      const missing = file.endsWith("planning-core.openapi.yaml") ? contracts.filter((code) => !listed.has(code)).map((code) => `${file}: ERROR_CODES has ${code}, the ErrorCode enum does not`) : [];
      return [...order(file, codes), ...unknown, ...missing];
    }),
  ];
}

/** Every documentation/api/*.openapi.yaml with a components.schemas.ErrorCode enum. */
export function readSpecEnums(dir: string): SpecEnum[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".openapi.yaml"))
    .sort()
    .flatMap((name) => {
      const codes = parse(readFileSync(join(dir, name), "utf8"))?.components?.schemas?.ErrorCode?.enum;
      return Array.isArray(codes) ? [{ file: `documentation/api/${name}`, codes: codes.map(String) }] : [];
    });
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const specs = readSpecEnums(join(process.cwd(), "documentation/api"));
  const problems = errorCodeProblems(ERROR_CODES, specs);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0 || !specs.some((s) => s.file.endsWith("planning-core.openapi.yaml"))) process.exit(1);
  console.log(`Error codes: ${ERROR_CODES.length} in ERROR_CODES, in order; ${specs.map((s) => `${s.file} (${s.codes.length})`).join(", ")} in order and consistent.`);
}
