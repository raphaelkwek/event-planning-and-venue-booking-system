#!/usr/bin/env node
// ADR-0016. Writes one environment's deploy state: the kustomization Argo CD syncs from the
// deploy-state branch (environments/<environment>/kustomization.yaml), plus release.json.
//
// The state is small on purpose. It names the k3s overlay of ONE commit (a kustomize remote
// base pinned with ?ref=<commit>), the image of each service by digest, the environment's API
// host and its web origin. Promotion to production writes the same commit and the same digests
// under environments/production; a rollback is a revert of a state commit. Nothing secret is
// ever in it: the Secrets reach the cluster over SSH (deploy/oracle/connectsphere-deploy).
//
//   node deploy/release/write-state.mjs --environment staging --release release.json \
//     --api-host api.staging.203.0.113.7.sslip.io --web-origin https://connectsphere-staging.vercel.app \
//     --out state/environments/staging
//
// --source replaces the remote base (the kind job points it at a local copy), and --allow-tags
// accepts image tags instead of digests (only the kind job's locally built images have no digest).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const REPOSITORY = "https://github.com/raphaelkwek/event-planning-and-venue-booking-system";
export const IMAGE_PREFIX = "ghcr.io/raphaelkwek/connectsphere-";
/** The images the k3s overlays run. The web app is on Vercel, so it is not one of them. */
export const IMAGES = ["planning-core", "registration", "notification", "migrate", "cerbos"];
export const ENVIRONMENTS = ["staging", "production"];

const COMMIT = /^[0-9a-f]{40}$/;
const DIGEST_REF = /^([a-z0-9][a-z0-9._/-]*)@(sha256:[0-9a-f]{64})$/;
const TAG_REF = /^([a-z0-9][a-z0-9._/-]*):([A-Za-z0-9_][A-Za-z0-9._-]{0,127})$/;
const HOST = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export class StateError extends Error {}

/** A release as the Release workflow passes it: the commit and each image's full reference. */
export function parseRelease(text) {
  let release;
  try {
    release = JSON.parse(text);
  } catch {
    throw new StateError("the release is not JSON");
  }
  if (!release || typeof release.commit !== "string" || !COMMIT.test(release.commit)) {
    throw new StateError("the release must name a full 40-character commit sha");
  }
  if (!release.images || typeof release.images !== "object") throw new StateError("the release names no images");
  return { commit: release.commit, images: release.images };
}

/** One kustomize `images` entry, by digest, or by tag only when tags are allowed. */
export function imageEntry(name, ref, allowTags) {
  if (typeof ref !== "string") throw new StateError(`the release has no image for ${name}`);
  const digest = DIGEST_REF.exec(ref);
  if (digest) return { name: IMAGE_PREFIX + name, newName: digest[1], digest: digest[2] };
  const tag = TAG_REF.exec(ref);
  if (tag && allowTags) return { name: IMAGE_PREFIX + name, newName: tag[1], newTag: tag[2] };
  throw new StateError(`${name} must be given by digest (name@sha256:...), got ${JSON.stringify(ref)}`);
}

/** An exact https origin, as CORS compares it: scheme, host and an optional port, nothing else. */
export function checkOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new StateError(`the web origin ${JSON.stringify(origin)} is not a URL`);
  }
  if (url.protocol !== "https:" || url.origin !== origin) {
    throw new StateError(`the web origin must be an exact https origin with no path, got ${JSON.stringify(origin)}`);
  }
  return origin;
}

export function checkHost(host) {
  if (typeof host !== "string" || !HOST.test(host)) {
    throw new StateError(`the API host must be a bare lower-case hostname (no scheme, port or path), got ${JSON.stringify(host)}`);
  }
  return host;
}

const q = (value) => JSON.stringify(value);

/** The state kustomization, as text. */
export function renderState({ environment, release, apiHost, webOrigin, source, allowTags = false }) {
  if (!ENVIRONMENTS.includes(environment)) throw new StateError(`unknown environment ${JSON.stringify(environment)}`);
  checkHost(apiHost);
  checkOrigin(webOrigin);
  const base = source ?? `${REPOSITORY}//deploy/k8s/overlays/k3s-${environment}?ref=${release.commit}`;
  const images = IMAGES.map((name) => imageEntry(name, release.images[name], allowTags));
  const lines = [
    `# ConnectSphere ${environment}: written by the Release workflow (deploy/release/write-state.mjs).`,
    "# Do not edit by hand. Argo CD syncs this file; reverting the commit that wrote it is a rollback.",
    `# Release ${release.commit}`,
    "apiVersion: kustomize.config.k8s.io/v1beta1",
    "kind: Kustomization",
    "resources:",
    `  - ${q(base)}`,
    "images:",
  ];
  for (const image of images) {
    lines.push(`  - name: ${q(image.name)}`, `    newName: ${q(image.newName)}`);
    lines.push(image.digest ? `    digest: ${q(image.digest)}` : `    newTag: ${q(image.newTag)}`);
  }
  lines.push(
    "patches:",
    "  - target:",
    "      kind: Ingress",
    "      name: api",
    "    patch: |-",
    "      - op: replace",
    "        path: /spec/rules/0/host",
    `        value: ${q(apiHost)}`,
    "      - op: replace",
    "        path: /spec/tls/0/hosts/0",
    `        value: ${q(apiHost)}`,
    "  - target:",
    "      kind: ConfigMap",
    "      name: connectsphere-config",
    "    patch: |-",
    "      - op: replace",
    "        path: /data/CORS_ALLOWED_ORIGINS",
    `        value: ${q(webOrigin)}`,
    ""
  );
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { allowTags: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--allow-tags") args.allowTags = true;
    else if (["--environment", "--release", "--api-host", "--web-origin", "--out", "--source"].includes(flag)) {
      const value = argv[i + 1];
      if (value === undefined) throw new StateError(`${flag} needs a value`);
      args[flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      i += 1;
    } else throw new StateError(`unknown argument ${flag}`);
  }
  for (const required of ["environment", "release", "apiHost", "webOrigin", "out"]) {
    if (!args[required]) throw new StateError(`--${required.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())} is required`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const release = parseRelease(readFileSync(args.release === "-" ? 0 : args.release, "utf8"));
  const text = renderState({ ...args, release });
  mkdirSync(args.out, { recursive: true });
  writeFileSync(join(args.out, "kustomization.yaml"), text);
  const record = { environment: args.environment, commit: release.commit, images: release.images, apiHost: args.apiHost, webOrigin: args.webOrigin };
  writeFileSync(join(args.out, "release.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(`wrote ${join(args.out, "kustomization.yaml")} for ${args.environment} at ${release.commit}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof StateError ? `write-state: ${error.message}` : error);
    process.exit(1);
  }
}
