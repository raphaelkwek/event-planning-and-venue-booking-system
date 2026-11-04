# Evidence: the first live deploy on the Azure VM (4 Nov 2026)

The first deploy of both environments with `npm run deploy:vm` from Joash's laptop, from commit
`c1566acabeac`. The output below is the script's own; it is masked and holds no secret.

| | Staging | Production |
|---|---|---|
| Web | https://connectsphere-staging.vercel.app | https://connectsphere-blush.vercel.app (the first alias; `connectsphere-is212.vercel.app` was added afterwards) |
| API | https://api.staging.4.194.57.47.sslip.io | https://api.4.194.57.47.sslip.io |
| Supabase project | wxfkaoxkwtdkrhtlqwxy | hjgswgntfwshpyoiswns |
| Image | `connectsphere-space:c1566acabeac`, built on the VM (arm64) | the same image |
| Demo users | seeded (identity seeds and their Auth users) | none |
| Lead invite | sent to joash.lau.2024@computing.smu.edu.sg | sent to the same address |

**Smoke tests that passed in both environments:**
- `/healthz` over TLS (certificates from Let's Encrypt through the host Caddy);
- the API routes answered 401 with the error envelope, and nothing else was routed;
- CORS allowed the environment's own origin only;
- planning-core, notification and registration reported `{"status":"ready","checks":{"database":"ok","kafka":"reachable"}}`;
- Cerbos reported `{"status":"SERVING"}`;
- the SPA was served, built for its own API.

Every supervisord program in each container was RUNNING. Neither container restarted, and neither
was killed for memory. With both running, the VM had about 2.3 GB of its 4 GB available (`docker stats`:
staging about 540 MB, production about 480 MB, Caddy 26 MB), so `Standard_B2pls_v2` fits.

The deploy gate was checked with the per-environment keys:
- `health` answered for each environment;
- a shell command and an image given by tag were refused;
- the staging key could not reach production.

**Not shown yet:**
- the automated path (`release.yml` to `deploy-vm-environment.yml`), which waits for the GitHub
  environments' secrets and variables;
- the Lead accepting the invite and signing in;
- a production redeploy on `connectsphere-is212.vercel.app`, which Joash runs.
