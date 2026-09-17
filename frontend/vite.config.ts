import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..");

/**
 * The browser only ever talks to this dev server, which proxies through to the
 * services. That keeps CORS out of the picture entirely, so neither service
 * needs a CORS middleware it would not want in production.
 *
 * Config is read from the repo-root .env, the same file the services use.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");

  return {
    plugins: [react()],
    envDir: repoRoot,
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ""),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? ""),
    },
    server: {
      port: 5173,
      proxy: {
        "/identity": {
          target: env.IDENTITY_BASE_URL || "http://127.0.0.1:8081",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/identity/, ""),
        },
        "/event": {
          target: `http://127.0.0.1:${env.EVENT_PORT || 8082}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/event/, ""),
        },
      },
    },
  };
});
