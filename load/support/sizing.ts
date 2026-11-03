/**
 * The arithmetic behind the registration service's HorizontalPodAutoscaler (EN-18).
 *
 * Three things bound how many pods the service may run, and the HPA's numbers come from them, not from a
 * guess:
 *
 * 1. CPU. At the design peak the pods together must have the cores the measured cost per request needs,
 *    when each runs at the HPA's target utilisation of its CPU request.
 * 2. Connections. Pods x pool size must stay within 80% of the database pooler's limit (architecture
 *    section 6: "HPA maximums come from this formula"), or a scale-out could exhaust the database.
 * 3. Availability. At least two pods, so one can be lost or rolled without an outage.
 *
 * The cost per request is a measurement from a CI runner (documentation/evidence/EN-18); the pooler's
 * limit is an assumption about the team's Supabase plan, written in sizing.json for the team to confirm.
 */

export interface SizingInputs {
  /** CPU the service used per request in the load run, in milliseconds (a measurement). */
  cpuMsPerRequest: number;
  /** The requests per second the cluster must carry: the load model's peak, or the SLO's test rate. */
  peakRequestsPerSecond: number;
  /** The container's CPU request, which the HPA's utilisation target is a percentage of. */
  cpuRequestMillicores: number;
  targetUtilisationPercent: number;
  /** Connections one pod may open (REGISTRATION_DB_POOL_MAX). */
  poolSizePerPod: number;
  /** Connections the database pooler accepts (an assumption to confirm). */
  poolerConnectionLimit: number;
  /** Pods that stay up with one lost. */
  minimumForAvailability: number;
  /** Extra room above the pods the peak needs, for a pod that is starting or not yet ready. */
  headroomFactor: number;
}

export interface Sizing {
  coresNeededAtPeak: number;
  podsNeededAtPeak: number;
  maxByConnections: number;
  minReplicas: number;
  maxReplicas: number;
  /** False when the pods the peak needs would break the connection budget. */
  feasible: boolean;
  reasons: string[];
}

export const CONNECTION_BUDGET_FRACTION = 0.8;

export function sizeAutoscaling(i: SizingInputs): Sizing {
  const coresNeededAtPeak = (i.peakRequestsPerSecond * i.cpuMsPerRequest) / 1000;
  const usableCoresPerPod = (i.cpuRequestMillicores / 1000) * (i.targetUtilisationPercent / 100);
  const podsNeededAtPeak = Math.max(1, Math.ceil(coresNeededAtPeak / usableCoresPerPod));
  const maxByConnections = Math.floor((CONNECTION_BUDGET_FRACTION * i.poolerConnectionLimit) / i.poolSizePerPod);
  const minReplicas = i.minimumForAvailability;
  const wanted = Math.max(minReplicas, Math.ceil(podsNeededAtPeak * i.headroomFactor));
  const maxReplicas = Math.min(wanted, maxByConnections);
  const feasible = podsNeededAtPeak <= maxByConnections;
  const reasons = [
    `${i.peakRequestsPerSecond} req/s x ${i.cpuMsPerRequest} ms of CPU = ${coresNeededAtPeak.toFixed(2)} cores at the peak`,
    `one pod at ${i.targetUtilisationPercent}% of a ${i.cpuRequestMillicores}m request carries ${usableCoresPerPod.toFixed(3)} cores, so the peak needs ${podsNeededAtPeak} pods`,
    `${i.poolSizePerPod} connections a pod against ${CONNECTION_BUDGET_FRACTION * 100}% of a ${i.poolerConnectionLimit}-connection pooler allows ${maxByConnections} pods`,
    feasible ? `maximum ${maxReplicas} = the ${podsNeededAtPeak} the peak needs x ${i.headroomFactor} headroom, held to the connection budget` : "the peak needs more pods than the connection budget allows: raise the pod's CPU request or the pooler's limit",
  ];
  return { coresNeededAtPeak, podsNeededAtPeak, maxByConnections, minReplicas, maxReplicas, feasible, reasons };
}
