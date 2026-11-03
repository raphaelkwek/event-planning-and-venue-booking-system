// CI: hardening checks on the rendered gateway manifests (kubeconform checks they are valid
// Kubernetes; this checks they are also what we meant). Nothing is applied anywhere.
//   node gateway/ci/check-manifests.mjs <rendered.yaml>
import { readFileSync } from "node:fs";
import YAML from "yaml";

const documents = YAML.parseAllDocuments(readFileSync(process.argv[2], "utf8")).map((d) => d.toJSON());
const problems = [];

for (const doc of documents) {
  if (doc.kind === "Secret") problems.push(`${doc.metadata.name}: a Secret is in the manifests`);
  if (doc.kind !== "Deployment") continue;
  const pod = doc.spec.template.spec;
  const who = doc.metadata.name;
  if (pod.automountServiceAccountToken !== false) problems.push(`${who}: mounts a service account token`);
  if (pod.securityContext?.runAsNonRoot !== true) problems.push(`${who}: does not run as non-root`);
  for (const container of [...(pod.initContainers ?? []), ...pod.containers]) {
    const name = `${who}/${container.name}`;
    if (container.securityContext?.readOnlyRootFilesystem !== true) problems.push(`${name}: root filesystem is writable`);
    if (container.securityContext?.allowPrivilegeEscalation !== false) problems.push(`${name}: may escalate privileges`);
    if (!container.securityContext?.capabilities?.drop?.includes("ALL")) problems.push(`${name}: keeps capabilities`);
    if (!container.resources?.requests || !container.resources?.limits) problems.push(`${name}: has no requests and limits`);
    if (/:latest$/.test(container.image)) problems.push(`${name}: uses :latest`);
  }
  for (const container of pod.containers) {
    if (!container.readinessProbe) problems.push(`${who}/${container.name}: no readiness probe`);
    if (!container.livenessProbe) problems.push(`${who}/${container.name}: no liveness probe`);
  }
}

const kinds = (kind) => documents.filter((d) => d.kind === kind).map((d) => d.metadata.name);
if (!kinds("PodDisruptionBudget").includes("kong")) problems.push("kong has no PodDisruptionBudget");
if (!kinds("HorizontalPodAutoscaler").includes("kong")) problems.push("kong has no HorizontalPodAutoscaler");
const kong = documents.find((d) => d.kind === "Deployment" && d.metadata.name === "kong");
const env = Object.fromEntries(kong.spec.template.spec.containers[0].env.map((e) => [e.name, e.value]));
if (env.KONG_DATABASE !== "off") problems.push("kong is not DB-less");
if (env.KONG_ADMIN_LISTEN !== "off") problems.push("the Kong Admin API is on");
if (kinds("Service").includes("kong") && documents.find((d) => d.kind === "Service" && d.metadata.name === "kong").spec.ports.some((p) => p.targetPort === "status")) {
  problems.push("the Kong status port is exposed by a Service");
}

if (problems.length > 0) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log(`${documents.length} resources checked: hardened, DB-less, no Admin API, no Secret.`);
