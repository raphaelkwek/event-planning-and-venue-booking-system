import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..");

/**
 * ADR-0016: built for Vercel, the app calls the API on another origin, given
 * by VITE_API_BASE_URL (e.g. https://api.staging.<ip>.sslip.io). Empty, as on
 * a laptop and in the nginx image, every call stays a relative path.
 */
function apiBaseUrl(value: string | undefined): string {
  const base = (value ?? "").trim().replace(/\/+$/, "");
  if (base === "") return "";
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`VITE_API_BASE_URL must be an absolute URL such as https://api.example.org, got "${base}"`);
  }
  const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if ((url.protocol !== "https:" && !local) || url.origin !== base) {
    throw new Error(`VITE_API_BASE_URL must be an https origin with no path, got "${base}"`);
  }
  return base;
}

/**
 * On a laptop the browser only ever talks to this dev server, which proxies
 * through to the services, so no CORS is involved. Staging and production
 * serve the app from Vercel and the services answer CORS for it (ADR-0016).
 *
 * Config is read from the repo-root .env, the same file the services use.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  // Identity and Event are modules of one planning-core process (ADR-0004).
  // The two prefixes stay so the app's API calls did not have to change.
  const planningCore = `http://127.0.0.1:${env.PLANNING_CORE_PORT || 8090}`;
  const notification = `http://127.0.0.1:${env.NOTIFICATION_PORT || 8091}`;

  return {
    plugins: [react()],
    envDir: repoRoot,
    define: {
      // VITE_* is what the Vercel build sets per environment; the plain names are the repo-root .env.
      __SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ""),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ""),
      __API_BASE_URL__: JSON.stringify(apiBaseUrl(env.VITE_API_BASE_URL)),
    },
    server: {
      port: 5173,
      proxy: {
        "/identity": {
          target: planningCore,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/identity/, ""),
        },
        "/event": {
          target: planningCore,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/event/, ""),
        },
        // The venue module (H1, H2), also in planning-core.
        "/venue": {
          target: planningCore,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/venue/, ""),
        },
        // The equipment module (P1, P2, Q1, Q2), also in planning-core.
        "/equipment": {
          target: planningCore,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/equipment/, ""),
        },
        // The notification service (T2).
        "/notification": {
          target: notification,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/notification/, ""),
        },
      },
    },
  };
});
