import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, parseAllDocuments } from "yaml";
import { REPO_ROOT } from "../support/stack.js";
import { sizeAutoscaling, CONNECTION_BUDGET_FRACTION, type SizingInputs } from "../support/sizing.js";

/**
 * EN-18-T7: the committed autoscaling follows from its inputs. The component's numbers (the HPA's minimum, maximum
 * and target, the pod's CPU request and pool size) must be what sizeAutoscaling works out from sizing.json, and the
 * CPU cost per request it assumes must not be below any of the figures the load runs measured. Kubernetes is not
 * run here; CI renders the component with kubectl and validates the result with kubeconform.
 */

const DIR = join(REPO_ROOT, "deploy/k8s/components/autoscaling");
const read = (...parts: string[]) => readFileSync(join(DIR, ...parts), "utf8");

interface Sizing {
  inputs: SizingInputs;
  measurements: Array<{ scenario: string; run: string; cpuMsPerRequest: number }>;
}
interface PatchOp {
  op: "replace" | "add";
  path: string;
  value: unknown;
}
type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- manifests are walked by JSON pointer

const sizing = JSON.parse(read("sizing.json")) as Sizing;
const component = parse(read("kustomization.yaml")) as { patches: Array<{ target: { kind: string; name: string }; patch: string }> };
const patchFor = (kind: string) => parse(component.patches.find((p) => p.target.kind.includes(kind))!.patch) as PatchOp[];

/** Applies the two JSON Patch operations the component uses, on a copy. */
function apply(doc: Doc, ops: PatchOp[]): Doc {
  const out = structuredClone(doc);
  for (const { op, path, value } of ops) {
    const keys = path.split("/").slice(1);
    const last = keys.pop()!;
    const parent = keys.reduce<Doc>((node, key) => node[Array.isArray(node) ? Number(key) : key], out);
    if (Array.isArray(parent)) {
      if (op === "add" && last === "-") parent.push(value);
      else parent[Number(last)] = value;
    } else {
      if (op === "replace" && !(last in parent)) throw new Error(`cannot replace ${path}: it is not there`);
      parent[last] = value;
    }
  }
  return out;
}

const base = parseAllDocuments(readFileSync(join(REPO_ROOT, "deploy/k8s/test/autoscaling/registration-from-pr75.yaml"), "utf8")).map((d) => d.toJSON() as Doc);
const baseOf = (kind: string) => base.find((d) => d.kind === kind)!;

describe("the autoscaling component (EN-18-T7)", () => {
  const hpa = apply(baseOf("HorizontalPodAutoscaler"), patchFor("HorizontalPodAutoscaler"));
  const deployment = apply(baseOf("Deployment"), patchFor("Deployment"));
  const expected = sizeAutoscaling(sizing.inputs);

  it("sets the HPA's minimum and maximum to what the sizing works out", () => {
    expect(hpa.spec.minReplicas).toBe(expected.minReplicas);
    expect(hpa.spec.maxReplicas).toBe(expected.maxReplicas);
  });

  it("sets the CPU target to the sizing's, as a percentage of the pod's request", () => {
    expect(hpa.spec.metrics[0].resource.target).toEqual({ type: "Utilization", averageUtilization: sizing.inputs.targetUtilisationPercent });
    expect(deployment.spec.template.spec.containers[0].resources.requests.cpu).toBe(`${sizing.inputs.cpuRequestMillicores}m`);
  });

  it("keeps pods x pool size within 80% of the pooler's connections at the maximum", () => {
    const env = deployment.spec.template.spec.containers[0].env as Array<{ name: string; value: string }>;
    const pool = Number(env.find((e) => e.name === "REGISTRATION_DB_POOL_MAX")!.value);
    expect(pool).toBe(sizing.inputs.poolSizePerPod);
    expect(hpa.spec.maxReplicas * pool).toBeLessThanOrEqual(CONNECTION_BUDGET_FRACTION * sizing.inputs.poolerConnectionLimit);
    expect(expected.feasible).toBe(true);
  });

  it("lets the pods the peak needs fit under the maximum, and the minimum survive the loss of a pod", () => {
    expect(hpa.spec.maxReplicas).toBeGreaterThanOrEqual(expected.podsNeededAtPeak);
    expect(hpa.spec.minReplicas).toBeGreaterThanOrEqual(2);
  });

  it("lets one pod use the core the stress run saturated, and does not throttle it below its request", () => {
    const resources = deployment.spec.template.spec.containers[0].resources;
    expect(resources.limits.cpu).toBe("1000m");
    expect(parseInt(resources.limits.cpu)).toBeGreaterThan(parseInt(resources.requests.cpu));
  });

  it("scales up at once and down slowly, so a spike is met and a lull does not flap", () => {
    const { scaleUp, scaleDown } = hpa.spec.behavior;
    expect(scaleUp.stabilizationWindowSeconds).toBe(0);
    expect(scaleDown.stabilizationWindowSeconds).toBeGreaterThanOrEqual(300);
  });

  it("assumes a CPU cost per request no lower than any run measured, and names the runs", () => {
    expect(sizing.measurements.length).toBeGreaterThanOrEqual(3);
    for (const m of sizing.measurements) {
      expect(m.run).toMatch(/^https:\/\/github\.com\/.+\/actions\/runs\/\d+$/);
      expect(sizing.inputs.cpuMsPerRequest, `${m.scenario} measured ${m.cpuMsPerRequest} ms`).toBeGreaterThanOrEqual(m.cpuMsPerRequest);
    }
  });

  it("does not patch a field the base lacks (a replace of a missing path would fail in kustomize)", () => {
    expect(() => apply(baseOf("HorizontalPodAutoscaler"), [{ op: "replace", path: "/spec/nope", value: 1 }])).toThrow(/not there/);
  });
});
