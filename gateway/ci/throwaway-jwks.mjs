// CI ONLY. Writes a JWKS holding one freshly made key, for validating the rendering step
// (`kong config parse` of a rendered file) without starting anything. The private half is discarded.
//   node gateway/ci/throwaway-jwks.mjs <out-file>
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const out = process.argv[2];
if (!out) throw new Error("Give an output file.");
const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
writeFileSync(out, JSON.stringify({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: randomUUID(), alg: "ES256", use: "sig" }] }));
