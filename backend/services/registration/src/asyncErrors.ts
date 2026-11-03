import { createRequire } from "node:module";

/**
 * Express 4 never looks at the promise an async route handler returns, so a
 * rejection after the handler's first `await` is nobody's problem: Node 20
 * raises `unhandledRejection` and exits, and `concurrently --kill-others-on-fail`
 * then takes the whole dev stack down with it.
 *
 * This makes Express's router layer pass a rejected promise to `next(error)`,
 * which ends at the final error handler (errorHandler.ts). It is one patch that
 * covers every router and every handler, including ones added later, so no
 * route has to remember a try/catch or a wrapper. The same behaviour as the
 * `express-async-errors` package, kept local because it is twenty lines.
 *
 * Importing this file applies the patch once; it is safe to import repeatedly.
 */
interface RouterLayer {
  handle: (...args: unknown[]) => unknown;
  handle_request: (req: unknown, res: unknown, next: (error?: unknown) => void) => void;
}

const PATCHED = Symbol.for("connectsphere.asyncErrors");

export function patchExpressLayer(layer: { prototype: RouterLayer }): void {
  const proto = layer.prototype as RouterLayer & { [PATCHED]?: true };
  if (proto[PATCHED]) return;
  proto[PATCHED] = true;

  proto.handle_request = function handleRequest(this: RouterLayer, req, res, next) {
    const handler = this.handle;
    // An error-handling layer (four arguments) is skipped by a normal request.
    if (handler.length > 3) return next();
    try {
      const result = handler(req, res, next);
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        (result as Promise<unknown>).catch(next);
      }
    } catch (error) {
      next(error);
    }
  };
}

const require = createRequire(import.meta.url);
patchExpressLayer(require("express/lib/router/layer") as { prototype: RouterLayer });
