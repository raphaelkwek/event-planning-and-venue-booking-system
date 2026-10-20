import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bundleWorkflowCode, type WorkflowBundleWithSourceMap } from "@temporalio/worker";

/**
 * The workflows' entry file: the TypeScript source under tsx and in tests, the
 * compiled JavaScript under `npm run start`. Temporal's bundler compiles either.
 */
export function workflowsPath(): string {
  const source = fileURLToPath(new URL("./workflows/index.ts", import.meta.url));
  return existsSync(source) ? source : fileURLToPath(new URL("./workflows/index.js", import.meta.url));
}

/** Bundles the workflows once, so a worker (or a test) needn't rebuild them. */
export function bundleCompletionWorkflows(): Promise<WorkflowBundleWithSourceMap> {
  return bundleWorkflowCode({ workflowsPath: workflowsPath() });
}
