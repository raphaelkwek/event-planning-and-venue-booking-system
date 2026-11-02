import { describe, expect, it } from "vitest";
import { CONNECTION_BUDGET_FRACTION, sizeAutoscaling, type SizingInputs } from "../support/sizing.js";

/**
 * EN-18-T7: the autoscaling arithmetic. The HPA's maximum must keep pods x pool size inside 80% of the
 * pooler's connections, and the pods the peak needs come from the measured CPU cost, not a guess.
 */

const base: SizingInputs = {
  cpuMsPerRequest: 2,
  peakRequestsPerSecond: 500,
  cpuRequestMillicores: 250,
  targetUtilisationPercent: 60,
  poolSizePerPod: 5,
  poolerConnectionLimit: 60,
  minimumForAvailability: 2,
  headroomFactor: 1.5,
};

describe("sizeAutoscaling (EN-18-T7)", () => {
  it("works out the cores, then the pods, the peak needs from the measured CPU per request", () => {
    const sizing = sizeAutoscaling(base);
    expect(sizing.coresNeededAtPeak).toBeCloseTo(1); // 500 req/s x 2 ms
    expect(sizing.podsNeededAtPeak).toBe(7); // 1 core / (0.25 cores x 60%) = 6.67
  });

  it("bounds the maximum by the connection budget: pods x pool at most 80% of the pooler", () => {
    const sizing = sizeAutoscaling(base);
    expect(sizing.maxByConnections).toBe(9); // 0.8 x 60 / 5 = 9.6
    expect(sizing.maxReplicas * base.poolSizePerPod).toBeLessThanOrEqual(CONNECTION_BUDGET_FRACTION * base.poolerConnectionLimit);
    expect(sizing.maxReplicas).toBe(9); // 7 x 1.5 = 10.5, held to 9
    expect(sizing.feasible).toBe(true);
  });

  it("keeps the minimum for availability, however little load there is", () => {
    const sizing = sizeAutoscaling({ ...base, peakRequestsPerSecond: 1 });
    expect(sizing.podsNeededAtPeak).toBe(1);
    expect(sizing.minReplicas).toBe(2);
    expect(sizing.maxReplicas).toBe(2);
  });

  it("says so when the peak needs more pods than the connections allow", () => {
    const sizing = sizeAutoscaling({ ...base, cpuMsPerRequest: 10 });
    expect(sizing.podsNeededAtPeak).toBe(34);
    expect(sizing.feasible).toBe(false);
    expect(sizing.maxReplicas).toBe(sizing.maxByConnections);
    expect(sizing.reasons.at(-1)).toMatch(/raise the pod's CPU request or the pooler's limit/);
  });

  it("explains every step in words", () => {
    const { reasons } = sizeAutoscaling(base);
    expect(reasons).toHaveLength(4);
    expect(reasons[0]).toMatch(/500 req\/s x 2 ms/);
    expect(reasons[2]).toMatch(/allows 9 pods/);
  });
});
