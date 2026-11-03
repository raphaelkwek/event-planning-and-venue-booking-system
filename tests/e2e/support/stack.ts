/**
 * Where each process of the browser tests' stack listens. E2E_PORT_OFFSET moves them all, so
 * two copies of the stack can run on one machine without meeting.
 */
const offset = Number(process.env.E2E_PORT_OFFSET ?? 0);

export const HOST = "127.0.0.1";
export const PORTS = {
  auth: 9999 + offset,
  planningCore: 8090 + offset,
  notification: 8091 + offset,
  registration: 8092 + offset,
  web: 4173 + offset,
};
export const AUTH_URL = `http://${HOST}:${PORTS.auth}`;
export const WEB_URL = `http://${HOST}:${PORTS.web}`;
/** Not a secret: the fake auth server checks it the way Supabase checks its anon key. */
export const ANON_KEY = "connectsphere-e2e-anon-key";
