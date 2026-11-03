import { startFakeAuthServer } from "./fake-supabase-auth.js";

/**
 * Starts the fake Supabase Auth server for the browser tests. tests/playwright.config.ts runs
 * this as one of its web servers; it refuses to start outside that harness
 * (assertTestHarnessOnly).
 */
const port = Number(process.env.E2E_AUTH_PORT ?? 9999);
const webOrigin = process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:4173";

startFakeAuthServer({
  port,
  anonKey: process.env.SUPABASE_ANON_KEY ?? "",
  allowedOrigins: [webOrigin],
})
  .then(({ url }) => {
    console.log(`fake Supabase Auth listening on ${url} (browser tests only)`);
  })
  .catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
