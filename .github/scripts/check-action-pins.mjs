// EN-21. Fails when a workflow or composite action uses a third-party action that is pinned to a
// tag or branch instead of a full commit SHA: a tag can be moved to different code, a SHA cannot.
//
//   node .github/scripts/check-action-pins.mjs [file ...]
//
// With no arguments it checks the supply-chain and deploy workflows (deploy.yml's image job holds
// id-token: write, so a moved tag there could sign as main) and every composite action under
// .github/actions. Local actions (./...) and docker:// references pinned by digest are fine.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /@sha256:[0-9a-f]{64}$/;

/** Every `uses:` value in the text, with its line number. */
export function findUses(text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const match = /^\s*(?:-\s+)?uses:\s*([^\s#]+)/.exec(line);
    if (match) found.push({ line: index + 1, ref: match[1].replace(/^['"]|['"]$/g, "") });
  });
  return found;
}

/** Why a reference is not pinned, or null when it is. */
export function problemWith(ref) {
  if (ref.startsWith("./")) return null;
  if (ref.startsWith("docker://")) return DIGEST.test(ref) ? null : "docker image not pinned by digest";
  const at = ref.lastIndexOf("@");
  if (at === -1) return "no version at all";
  return SHA.test(ref.slice(at + 1)) ? null : `pinned to "${ref.slice(at + 1)}", not a 40-character commit SHA`;
}

function defaultFiles() {
  const files = [".github/workflows/supply-chain.yml", ".github/workflows/deploy.yml", ".github/workflows/release.yml", ".github/workflows/deploy-environment.yml", ".github/workflows/deploy-vm-environment.yml"];
  const root = ".github/actions";
  for (const name of readdirSync(root)) {
    const file = join(root, name, "action.yml");
    if (statSync(join(root, name)).isDirectory()) files.push(file);
  }
  return files;
}

function main(files) {
  let failures = 0;
  for (const file of files) {
    for (const { line, ref } of findUses(readFileSync(file, "utf8"))) {
      const problem = problemWith(ref);
      if (problem) {
        failures += 1;
        console.error(`::error file=${file},line=${line}::${ref}: ${problem}`);
      } else {
        console.log(`ok  ${file}:${line}  ${ref}`);
      }
    }
  }
  if (failures > 0) {
    console.error(`${failures} action(s) are not pinned by commit SHA.`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("check-action-pins.mjs")) {
  const args = process.argv.slice(2);
  main(args.length > 0 ? args : defaultFiles());
}
