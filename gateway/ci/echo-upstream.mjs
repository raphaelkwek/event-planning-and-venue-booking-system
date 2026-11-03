// CI ONLY. An upstream that answers with the request it received, so the gateway tests can see exactly
// which headers Kong passed on (EN-12). It is reached only through the routes `render-config.mjs
// --with-ci-echo` adds to the rendered configuration, never through the committed gateway/kong.yml.
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

export function startEcho({ port }) {
  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers }));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ close: () => new Promise((done) => server.close(done)) }));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.GATEWAY_CI_ECHO_PORT ?? 9100);
  startEcho({ port }).then(() => console.log(`echo upstream listening on 127.0.0.1:${port} (gateway CI only)`));
}
