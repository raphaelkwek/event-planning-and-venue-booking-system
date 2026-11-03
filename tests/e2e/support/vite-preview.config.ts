import { Agent } from "node:http";
import { createConnection, type NetConnectOpts } from "node:net";
import { defineConfig, type ProxyOptions } from "vite";

/**
 * `vite preview` for the browser tests (EN-14). It serves the web app the run has just built and
 * proxies the API prefixes exactly as frontend/vite.config.ts does for the dev server.
 *
 * The one difference: on Linux each proxied connection leaves from the next of 32 loopback
 * addresses (127.0.1.1 to 127.0.1.32). planning-core limits requests per address, as it should
 * for real users, who each have their own. Without this every journey's browser traffic would
 * share one address and one budget, and identity would refuse the screens' name look-ups part
 * way through the run. The limits themselves are unchanged.
 */
const ADDRESSES = Array.from({ length: 32 }, (_, i) => `127.0.1.${i + 1}`);
let next = 0;

const agent = new Agent({ keepAlive: false });
// Node's own Agent opens sockets with net.createConnection; this does the same, from the next address.
(agent as unknown as { createConnection: (options: NetConnectOpts) => ReturnType<typeof createConnection> }).createConnection = (
  options,
) => {
  const local = process.platform === "linux" ? { localAddress: ADDRESSES[next++ % ADDRESSES.length] } : {};
  return createConnection({ ...options, ...local } as NetConnectOpts);
};
const planningCore = `http://127.0.0.1:${process.env.PLANNING_CORE_PORT || 8090}`;
const notification = `http://127.0.0.1:${process.env.NOTIFICATION_PORT || 8091}`;
const registration = `http://127.0.0.1:${process.env.REGISTRATION_PORT || 8092}`;

function to(target: string, prefix: string): ProxyOptions {
  return { target, changeOrigin: true, agent, rewrite: (path) => path.replace(new RegExp(`^${prefix}`), "") };
}

export default defineConfig({
  preview: {
    proxy: {
      "/identity": to(planningCore, "/identity"),
      "/event": to(planningCore, "/event"),
      "/venue": to(planningCore, "/venue"),
      "/equipment": to(planningCore, "/equipment"),
      // The registration service (R1 to R4): the attendee API.
      "/registration": to(registration, "/registration"),
      "/notification": to(notification, "/notification"),
    },
  },
});
