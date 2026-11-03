// EN-16 demonstration service. Stands in for planning-core in the canary test because
// EN-17 (the real /metrics endpoint) has not landed. It exposes the two metric names the
// AnalysisTemplate queries, with the same shapes prom-client gives:
//   http_requests_total{status}                      counter
//   http_request_duration_seconds_{bucket,sum,count} histogram
// MODE=good answers 200; MODE=bad answers 500 on "/" while /healthz stays 200, so the bad
// version passes its readiness probe and only the error rate can catch it.
"use strict";
const http = require("node:http");

const mode = process.env.MODE === "bad" ? "bad" : "good";
const version = process.env.VERSION || "unknown";
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const requests = new Map(); // status -> count
const bucketCounts = new Array(BUCKETS.length).fill(0);
let durationSum = 0;
let durationCount = 0;

function observe(status, seconds) {
  requests.set(status, (requests.get(status) || 0) + 1);
  durationSum += seconds;
  durationCount += 1;
  BUCKETS.forEach((le, i) => {
    if (seconds <= le) bucketCounts[i] += 1;
  });
}

function metrics() {
  const lines = ["# TYPE http_requests_total counter"];
  for (const [status, count] of requests) lines.push(`http_requests_total{status="${status}"} ${count}`);
  lines.push("# TYPE http_request_duration_seconds histogram");
  BUCKETS.forEach((le, i) => lines.push(`http_request_duration_seconds_bucket{le="${le}"} ${bucketCounts[i]}`));
  lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${durationCount}`);
  lines.push(`http_request_duration_seconds_sum ${durationSum}`);
  lines.push(`http_request_duration_seconds_count ${durationCount}`);
  lines.push("# TYPE demo_app_info gauge", `demo_app_info{version="${version}",mode="${mode}"} 1`);
  return lines.join("\n") + "\n";
}

const server = http.createServer((req, res) => {
  const started = process.hrtime.bigint();
  if (req.url === "/healthz") {
    res.writeHead(200).end("ok\n");
    return;
  }
  if (req.url === "/metrics") {
    res.writeHead(200, { "content-type": "text/plain; version=0.0.4" }).end(metrics());
    return;
  }
  const status = mode === "bad" ? 500 : 200;
  res.writeHead(status, { "content-type": "text/plain" }).end(`version ${version} (${mode})\n`);
  observe(status, Number(process.hrtime.bigint() - started) / 1e9);
});

server.listen(8080, () => console.log(`demo-app ${version} (${mode}) listening on :8080`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
