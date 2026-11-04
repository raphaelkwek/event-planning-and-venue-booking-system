# Staging and production: the runbook (ADR-0016)

The live environments run on **one Azure VM** (the ADR-0016 amendment of 4 Nov 2026). Two other
paths are kept, documented below:

1. **Azure VM (in use):** one Ubuntu VM, one container per environment, the web app on Vercel, and
   one Supabase project per environment. You deploy from your laptop with `npm run deploy:vm`.
2. **k3s on a bigger VM (the scale-up option):** the Oracle and k3s path, deployed by `release.yml`
   through GitHub environments.
3. **Hugging Face Spaces:** this works only with a PRO subscription (USD 9 a month). The free
   cpu-basic tier no longer hosts Docker Spaces.

In all three, staging and production differ only in credentials and hostnames.

## The Azure path

### What runs

| | Staging | Production |
|---|---|---|
| API | `https://api.staging.<ip>.sslip.io` | `https://api.<ip>.sslip.io` |
| Web | the Vercel project `connectsphere-staging` | the Vercel project `connectsphere` |
| Container on the VM | `connectsphere-staging`, 127.0.0.1:7861 | `connectsphere-production`, 127.0.0.1:7862 |
| Database and Auth | its own Supabase project (ref in `staging.env`) | its own Supabase project (ref in `production.env`) |
| Demo users | yes (`--seed`: the identity seeds and `seed:auth`, password on the sign-in page) | never |

- **The VM:** one `Standard_B2pls_v2` (2 Ampere vCPUs, 4 GB, arm64), Ubuntu 24.04, in `connectsphere-rg`
  in southeastasia. Every resource is tagged `project=connectsphere`. The subscription offers neither
  `Standard_B2s` nor `B2ms` there.
- **The NSG** allows only TCP 22, 80 and 443 in.
- **Caddy on the host** (a container on ports 80 and 443) takes the certificates from Let's Encrypt,
  with ZeroSSL as its fallback, and routes each host to its environment's container. Nothing else is
  published: each container listens only on 127.0.0.1.
- **Each container** is the single-container image of `deploy/space`:
  - planning-core, its Temporal worker, registration and notification;
  - Redpanda (SASL/SCRAM over TLS, 512 MB on the VM), the Temporal dev server and a Cerbos PDP
    (`CERBOS_URL=http://127.0.0.1:3592`, so EN-07's checks have their PDP);
  - an inner Caddy on 7860 that routes only the public API prefixes, plus a static `/healthz`.

  Migrations run when the container starts, against the environment's own Supabase session pooler.
  Temporal keeps its state on the environment's named volume, `connectsphere-<env>-temporal`; see
  [What survives a redeploy](#what-survives-a-redeploy).
- **Cost:** about USD 31–38 a month for the VM, USD 4.4 for the static IP and USD 2.5 for the 32 GB
  disk. That is about **USD 40 a month**; nothing else in the resource group bills by the hour.

### What survives a redeploy

Every merge to main redeploys staging: the deploy gate stops the container, removes it, and starts
the new image. Until 4 Nov 2026 Temporal kept its SQLite file in the container's `/tmp`, so every
redeploy lost every workflow and timer. That day an event confirmed before a redeploy stayed
Confirmed 30 minutes past its end, until the completion sweep was run by hand.

| What | After a redeploy on the VM | How |
|---|---|---|
| Events, holds, bookings, users: all the data | Kept | Supabase holds it, outside the VM. |
| Temporal's workflows and timers: F1's completion of each Confirmed event, L6's reminder and expiry of each hold | Kept | Temporal's SQLite file is `/var/lib/connectsphere/temporal/temporal.db`, on the named volume `connectsphere-staging-temporal` or `connectsphere-production-temporal`. The gate and `deploy:vm` mount it, and it outlives every container. The image owns the directory to uid 1000, the user supervisord runs Temporal as, and an empty volume takes that owner. `start.sh` logs `Temporal's state: …, kept from the last container` or `…, new`. |
| A timer Temporal doesn't have anyway (its state was lost or reset, or the worker was down when the message came) | Re-created when the worker starts | The worker lists every Confirmed event with an end and every Held hold from the database, and signal-with-starts each workflow with the consumers' own ids, before its Kafka consumers start. A timer whose time passed while it was gone finishes at once; one that is still there is told what it already has, and ignores it. The worker logs `timers reconciled` with the counts. |
| An event past its end, or a hold past its expiry, that no timer acted on | Completed or expired within five minutes | The container's `sweeps` program runs F1's completion sweep and L6's hold-expiry sweep at start and every five minutes (`deploy/space/sweeps.sh`). Each logs `completion sweep finished` or `hold expiry sweep finished` with its outcome. |
| Redpanda's topics and consumer offsets | Lost | The broker's TLS certificate and Kafka password are made anew at each start, so its data stays in the container. The outbox relay republishes anything not yet published; a consumer group starts at the newest message. A notification for a message that was published but not yet consumed when the container went is not sent. |

A reminder that fell due while the worker was down is sent when the worker re-creates the hold's
timer, if the hold hasn't expired by then; otherwise the hold just expires.

**Check it:**
- `docker volume inspect connectsphere-staging-temporal`;
- `docker logs connectsphere-staging 2>&1 | grep -E "Temporal's state|timers reconciled|sweep finished"`.

**Run a sweep by hand** (`docker exec` doesn't get `start.sh`'s settings, so give it the JWKS URL):

```bash
docker exec connectsphere-staging sh -c 'cd /app/backend/services/planning-core && SUPABASE_JWKS_URL="$SUPABASE_URL/auth/v1/.well-known/jwks.json" node dist/modules/event/jobs/runCompleteEvents.js'
```

`dist/modules/venue/jobs/runExpireHolds.js` is the hold-expiry sweep.

**Start Temporal empty** (say, after a workflow change that cannot replay): stop and remove the
container, run `docker volume rm connectsphere-staging-temporal`, and deploy again. The worker
re-creates every timer from the database.

### Checklist

1. **Supabase, twice.** For staging and for production, fill
   `C:\Users\Joash Lau\connectsphere-secrets\staging.env` and `production.env` with these values,
   pasting the URIs as Supabase shows them, `[YOUR-PASSWORD]` included:
   - `DB_PASSWORD`;
   - `DATABASE_URL` (the transaction pooler);
   - `MIGRATE_DATABASE_URL` (the session pooler);
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

   `shared.env` holds `VERCEL_TOKEN`, plus `SUPABASE_ACCESS_TOKEN`, which lets the script set each
   project's Auth Site URL and redirect URLs.
2. **The VM, once:**
   `bash deploy/azure/create-vm.sh --subscription <id>`, with `az login` done and an SSH key at
   `~/.ssh/connectsphere-azure`. The script is idempotent and touches nothing outside its resource group.
   The subscription refuses a budget from the CLI, so set one in the portal: Cost Management → Budgets →
   Add, scope `connectsphere-rg`, USD 20 a month, alert at 80%.
3. **Deploy staging**, with the demo users and the first Lead:
   `npm run deploy:vm -- --env staging --seed --lead <email>`
4. **Deploy production**, with no demo users, once staging answers:
   `npm run deploy:vm -- --env production --lead <email>`
5. **The Lead** gets an email from each project. Its link opens the web app's **Set your password**
   screen, where the Lead chooses a password and then signs in.

**Redeploy both environments, one command,** from the commit you are on (main after a merge):

```bash
npm run deploy:vm -- --env staging && npm run deploy:vm -- --env production
```

### Automated: every merge to main (release.yml)

1. CI runs as on every pull request: lint, unit, integration, browser tests, CodeQL and supply chain.
2. `release.yml` builds every image once per architecture, including `connectsphere-space`, the image
   the VM runs. It joins each into one GHCR index, then signs and attests it.
3. **Deploy staging (Azure VM)** runs `deploy-vm-environment.yml` with `environment: staging`:
   - verifies the space image's signature;
   - sends the container's settings to the VM's deploy gate over SSH, with the staging deploy key;
   - pulls the image by digest with the job's own token (never stored on the VM) and replaces the staging
     container; the migrations run against staging's Supabase as it starts;
   - waits until every service is ready, smoke-tests the API over TLS, then builds and deploys the staging
     SPA to Vercel and smoke-tests it.
4. **Deploy production (Azure VM)** does the same with the same commit and image. It waits for the
   `production` environment's required reviewer (joass1), and starts only after staging is green.

To roll back, use **Actions → Release → Run workflow** with `release` set to an earlier commit on main.
That commit's signed images are looked up and verified, not rebuilt, then deployed to staging and, after
approval, to production. `target: k3s` sends the same release down the k3s path instead.

**The deploy gate** (`deploy/azure/connectsphere-vm-deploy`) is installed once by `setup-deploy-user.sh`.
The `cs-deploy` user has no password. Its `authorized_keys` let the staging key run only
`connectsphere-vm-deploy staging …` and the production key only `… production …`: no shell, no
forwarding, no other environment. The gate:

- accepts only `deploy <ghcr.io/…/connectsphere-space@sha256:…>` and `health`;
- accepts only the listed settings on stdin;
- stops the old container before removing it, and starts the new one with Temporal's volume
  (`connectsphere-<env>-temporal`), so workflows and timers survive the redeploy;
- writes `/etc/connectsphere/<env>.env` (mode 660, group `connectsphere`);
- prints key names, never values.

`npm run deploy:vm` stays the manual fallback, writing the same files and containers.

### GitHub environments for the Azure path

Each environment (`staging`, `production`) needs these names; the values are its own. Variables are
public values; secrets are secret.

| Name | Kind | Holds | Staging | Production |
|---|---|---|---|---|
| `VM_HOST` | variable | the VM's static IP | `4.194.57.47` | `4.194.57.47` |
| `VM_SSH_KNOWN_HOSTS` | variable | the VM's host key line, from `ssh-keyscan -t ed25519 <ip>` | the same | the same |
| `API_HOST` | variable | the environment's API host | `api.staging.4.194.57.47.sslip.io` | `api.4.194.57.47.sslip.io` |
| `WEB_ORIGIN` | variable | the environment's web origin (also its only CORS origin) | `https://connectsphere-staging.vercel.app` | `https://connectsphere-is212.vercel.app` |
| `SUPABASE_URL` | variable | `https://<ref>.supabase.co` | staging's project | production's project |
| `SUPABASE_ANON_KEY` | variable | the project's anon key (public by design) | staging's | production's |
| `VM_SSH_KEY` | secret | the private deploy key for this environment | `connectsphere-secrets\vm-deploy-staging` | `connectsphere-secrets\vm-deploy-production` |
| `DATABASE_URL` | secret | the transaction pooler URI, password filled in | staging's | production's |
| `MIGRATE_DATABASE_URL` | secret | the session pooler URI, password filled in | staging's | production's |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | the project's service_role key | staging's | production's |
| `VERCEL_TOKEN` | secret | a Vercel token | the same | the same |
| `VERCEL_ORG_ID` | secret | the Vercel account's id | the same | the same |
| `VERCEL_PROJECT_ID` | secret | the Vercel project's id | `connectsphere-staging` | `connectsphere` |
| `ALSO_WEB_ORIGINS` | variable, optional | more web origins the API accepts and Supabase may redirect to, comma-separated | — | `https://connectsphere-blush.vercel.app` |
| `SUPABASE_ACCESS_TOKEN` | secret, optional | a Supabase personal access token; with it the workflow sets the project's Auth Site URL and redirect URLs | the same | the same |

The `production` environment has a required reviewer, and both environments allow deployments from
`main` only. The GHCR packages may stay private: the gate pulls with each job's own token.

### What `deploy:vm` does

1. Reads the VM's address with `az` (or `--host`), and checks Docker on it over SSH.
2. Builds the image of this commit **on the VM** (arm64), from the committed files (`git archive HEAD`),
   unless that commit's image is already there. CI builds and runs the same image on amd64 and arm64.
3. Builds the web app in a throwaway worktree with `VITE_API_BASE_URL` set to the environment's API,
   and deploys it with the Vercel CLI and `VERCEL_TOKEN`. It creates the Vercel project if missing.
4. Sets the Supabase project's Auth Site URL and redirect URLs to the web origin.
5. Writes `/etc/connectsphere/<env>.env` over SSH, from stdin, mode 600. It holds the five Supabase
   values, `CORS_ALLOWED_ORIGINS` (the environment's web origin only) and `REDPANDA_MEMORY`.
6. Replaces the environment's container, and writes and reloads the host Caddy.
7. Smoke-tests the result:
   - `/healthz` over TLS;
   - the API routes (401 envelopes) and that nothing else is routed;
   - CORS for its origin only;
   - each service's `/readyz` (database ok, Kafka reachable) and Cerbos;
   - the web app, built for this API.
8. `--seed` (staging only) applies the identity seeds and creates their Auth users. `--lead <email>`
   runs `lead:create`, which sends the invite.

Production refuses to start unless staging's `/healthz` answers. The script never prints a value from
the secrets folder; everything it or a tool prints is masked.

### Look inside, roll back

- **Logs and status:**
  - `ssh -i ~/.ssh/connectsphere-azure azureuser@<ip> docker logs --tail 100 connectsphere-staging`;
  - `docker exec connectsphere-staging supervisorctl -c /app/deploy/space/supervisord.conf status`;
  - `docker stats --no-stream`;
  - Temporal's state, the reconcile and the sweeps: see [What survives a redeploy](#what-survives-a-redeploy).
- **Roll back:** check out the earlier commit and run `deploy:vm` again. That commit's image is reused
  if it is still on the VM.
- **Memory:** `docker stats` shows each container's use. If 4 GB is not enough, first lower
  `REDPANDA_MEMORY` in `deploy/azure/deploy-vm.mjs`. Only then resize:
  `az vm resize -g connectsphere-rg -n connectsphere-vm --size Standard_B2ps_v2` (8 GB, about USD 70 a month).

## k3s on a bigger VM (the scale-up option)

This section is the k3s path. It is written for one Oracle Cloud Always Free Ampere VM, but runs on any
Ubuntu VM with 4 vCPUs and 16 GB or more (bootstrap.sh is not Oracle-specific apart from the iptables
step). It is deployed by `release.yml` through GitHub environments, which need repository Admin. It is
kept for when the one small VM is no longer enough.

ConnectSphere's two live environments cost nothing. The backend runs on one Oracle Cloud Always Free
Ampere VM (arm64, ap-singapore-1) with k3s, one namespace per environment. The web app is on Vercel
(Hobby), with one project per environment. Each environment has its own Supabase project. The two
environments differ only in credentials and hostnames: the same images (by digest), the same
manifests, and the same workflow.

**Status, plainly.** Everything below that a pull request can check is checked in CI (the Deploy
workflow's `Manifests`, `Image arm64`, `kind: k3s staging overlay` and `lint-release` jobs, and
the unit tests). None of the accounts exist yet, so nothing has been deployed: no VM, no Supabase or
Vercel project, no GitHub environment, and no run of `release.yml` on main. Steps 1 to 8 are Joash's
checklist, in order. The first person through them should expect to correct a detail or two.

```
merge to main ──► release.yml
                   build (amd64 + arm64, native) ─► publish (one index per image, cosign sign + SBOM attestation)
                   └─► deploy staging   ─ Secret over SSH ─► deploy-state: environments/staging ─► Argo CD ─► smoke ─► Vercel
                        └─► deploy production (required reviewer) ─ same commit, same digests ─► environments/production ─► …

Oracle VM (k3s) ── Traefik :443 ── api.staging.<ip>.sslip.io ─► connectsphere-staging    (planning-core, registration, notification,
                               └── api.<ip>.sslip.io         ─► connectsphere-production  worker, Redpanda, Temporal, Cerbos)
Vercel ── connectsphere-staging ──► calls api.staging…   Supabase ── one project per environment (Auth + Postgres)
       └─ connectsphere         ──► calls api…
```

| Piece | Where it lives |
|---|---|
| Images | `ghcr.io/raphaelkwek/connectsphere-{planning-core,registration,notification,migrate,cerbos}`, built by `.github/workflows/release.yml` |
| Manifests | `deploy/k8s/overlays/k3s-{staging,production}` = EN-10's base + `deploy/k8s/components/k3s` |
| What each environment runs | `environments/<env>/kustomization.yaml` on the `deploy-state` branch (written by `deploy/release/write-state.mjs`) |
| Cluster set-up | `deploy/oracle/bootstrap.sh` (run once on the VM) |
| How CI reaches the VM | `deploy/oracle/connectsphere-deploy`, the deploy gate (SSH forced command) |
| Deploy steps | `.github/workflows/deploy-environment.yml`, called once per environment |

---

### 1. Oracle Cloud: the account and the VM

1. Sign up at <https://signup.cloud.oracle.com> with **Singapore (ap-singapore-1)** as the home region.
   The home region cannot be changed later, and Always Free Ampere capacity is only in the home region.
   A card is asked for to verify identity; Always Free resources are never charged.
2. **Networking → Virtual cloud networks → Start VCN Wizard → Create VCN with Internet Connectivity.**
   Keep the defaults.
3. **Security list (the cloud firewall).** VCN → Security Lists → *Default Security List* → *Add Ingress Rules*:

   | Source CIDR | Protocol | Destination port | Why |
   |---|---|---|---|
   | 0.0.0.0/0 | TCP | 22 | SSH (already there) |
   | 0.0.0.0/0 | TCP | 80 | Let's Encrypt's HTTP-01 challenge |
   | 0.0.0.0/0 | TCP | 443 | The API |

   Nothing else. Port 6443 (the Kubernetes API) stays closed: deployments come in over SSH.
4. **Compute → Instances → Create instance.**
   - Image: **Canonical Ubuntu 24.04** (the aarch64 build is picked automatically for Ampere).
   - Shape: **Ampere → VM.Standard.A1.Flex, 4 OCPU, 24 GB** (the whole Always Free allowance).
   - Networking: the VCN's public subnet, **Assign a public IPv4 address**.
   - SSH keys: upload your own public key (this is your admin login as `ubuntu`, separate from the
     deploy keys in step 5).
   - Boot volume: 100 GB is plenty (Always Free covers 200 GB in total).
5. **"Out of host capacity"** is common for Ampere in Singapore. In order of what usually works:
   - try again a few hours later, or early morning SGT; capacity frees up all the time;
   - try another fault domain (Create instance → Placement → *Show advanced options*);
   - start smaller (2 OCPU, 12 GB) and resize later (instance → *Edit shape*), which stays free up to 4 and 24;
   - upgrade the account to **Pay As You Go** (Billing → Upgrade). Always Free resources stay free and
     PAYG accounts get capacity first. Set a budget alert of USD 1 (Billing → Budgets) at the same time.
6. Note the instance's **public IP**. The hostnames in step 5 embed it, so keep the VM (stopping it
   keeps the IP; terminating it does not).

**The host firewall.** Oracle's Ubuntu images also block ports in iptables: `/etc/iptables/rules.v4`
accepts SSH and ends the INPUT and FORWARD chains with `REJECT --reject-with icmp-host-prohibited`.
That blocks 80 and 443 even after the security list allows them, and the FORWARD REJECT also breaks
k3s's pod network. `bootstrap.sh` puts these rules in front of the REJECTs, in the running tables and
in `rules.v4` (so a reboot keeps them):

```
-A INPUT -p tcp -m conntrack --ctstate NEW -m tcp --dport 80 -j ACCEPT
-A INPUT -p tcp -m conntrack --ctstate NEW -m tcp --dport 443 -j ACCEPT
-A INPUT -s 10.42.0.0/16 -j ACCEPT        # pods reaching the node (API server, kubelet, metrics)
-A FORWARD -s 10.42.0.0/16 -j ACCEPT      # pod traffic out
-A FORWARD -d 10.42.0.0/16 -j ACCEPT      # traffic to pods, including Traefik's 80/443 from outside
-A FORWARD -s 10.43.0.0/16 -j ACCEPT
-A FORWARD -d 10.43.0.0/16 -j ACCEPT
```

Do not flush the rules or disable the firewall: Oracle's own rules (for example to the metadata
service) are in the same file.

### 2. Supabase: one project per environment

Never point either environment at the team's shared project. Create two new ones (a free account may
own two active free projects; if yours already has one, make the second under a new organisation):

| | Staging | Production |
|---|---|---|
| Name | `connectsphere-staging` | `connectsphere-production` |
| Region | Southeast Asia (Singapore) | Southeast Asia (Singapore) |
| Database password | generate, keep in your password manager | generate, a different one |

For each project collect, from **Connect** (the button at the top of the dashboard) and
**Project Settings → API**:

| Value | Where | Becomes |
|---|---|---|
| Transaction pooler URI (port **6543**) | Connect → Transaction pooler | `DATABASE_URL` |
| Session pooler URI (port **5432** on `aws-0-ap-southeast-1.pooler.supabase.com`, user `postgres.<ref>`) | Connect → Session pooler | `MIGRATE_DATABASE_URL` |
| Project URL `https://<ref>.supabase.co` | Settings → API | `SUPABASE_URL` |
| `anon` key | Settings → API | `SUPABASE_ANON_KEY` |
| `service_role` key | Settings → API | `SUPABASE_SERVICE_ROLE_KEY` |

Why two database URLs: the services use the **transaction pooler** with `prepare: false`, as on a
laptop. The migrator (`backend/scripts/migrate.ts`, run by the migrate Job) uses postgres.js's default
prepared statements and one session, which the transaction pooler refuses. The **direct** host
(`db.<ref>.supabase.co`) is IPv6-only, and the VM and its pods are IPv4, so the migrator gets the
**session pooler**. Put the database password into both URIs where the dashboard shows `[YOUR-PASSWORD]`.

Then, once you know each environment's Vercel origin (step 3), in each project's
**Authentication → URL Configuration**:

- **Site URL:** the environment's web origin, e.g. `https://connectsphere-staging-g9.vercel.app`;
- **Redirect URLs:** `https://connectsphere-staging-g9.vercel.app/**`.

The app signs in with a password grant, so these matter only for links Supabase emails (password
reset, confirmation), but an unset Site URL sends those links to localhost.

A free project is paused after a week without activity. Unpause it from the dashboard; the data stays.

### 3. Vercel: the account and two projects

1. Sign up at <https://vercel.com/signup> (Hobby). You don't need to connect Git: the workflow
   deploys with the CLI, and `vercel.json` sets `git.deploymentEnabled: false` so Vercel never builds
   on its own.
2. From any empty folder on your laptop:

   ```bash
   npx vercel@65.10.0 login
   npx vercel@65.10.0 project add connectsphere-staging
   npx vercel@65.10.0 project add connectsphere
   npx vercel@65.10.0 link --yes --project connectsphere-staging && cat .vercel/project.json   # orgId, projectId
   rm -rf .vercel
   npx vercel@65.10.0 link --yes --project connectsphere && cat .vercel/project.json
   ```

   `orgId` is the same for both, and is `VERCEL_ORG_ID`. Each `projectId` is that environment's `VERCEL_PROJECT_ID`.
3. Give each project a production domain you know in advance: **Project → Settings → Domains → Add**,
   a free `*.vercel.app` name, e.g. `connectsphere-staging-g9.vercel.app` and `connectsphere-g9.vercel.app`
   (`connectsphere.vercel.app` is probably taken). `https://` plus that name is the environment's
   `WEB_ORIGIN`.
4. Leave **Settings → Deployment Protection** at *Standard*: the production domain stays public, and
   the per-deployment URLs stay behind Vercel login.
5. **Account Settings → Tokens → Create**: scope your Hobby account, expiry at least past the end of
   term. This is `VERCEL_TOKEN` (put the same token in both environments).

The build runs on the GitHub runner (`vercel build`), with `vercel.json`'s install and build commands
and the environment's `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then
`vercel deploy --prebuilt --prod`. Nothing is configured in Vercel's own environment variables.

### 4. Deploy keys and the bootstrap

On your laptop, make one key pair per environment (no passphrase: the workflow uses them unattended):

```bash
ssh-keygen -t ed25519 -N "" -C connectsphere-staging-deploy    -f connectsphere-staging-deploy
ssh-keygen -t ed25519 -N "" -C connectsphere-production-deploy -f connectsphere-production-deploy
scp connectsphere-*-deploy.pub ubuntu@<public IP>:
```

On the VM:

```bash
ssh ubuntu@<public IP>
git clone https://github.com/raphaelkwek/event-planning-and-venue-booking-system.git ~/connectsphere
cd ~/connectsphere && git checkout main
sudo bash deploy/oracle/bootstrap.sh \
  --email <your email, for Let's Encrypt> \
  --staging-key "$(cat ~/connectsphere-staging-deploy.pub)" \
  --production-key "$(cat ~/connectsphere-production-deploy.pub)"
```

It takes about ten minutes and is safe to run again (after a `git pull`, to pick up a change). It
installs the host firewall rules (step 1), k3s `v1.33.13+k3s2`, cert-manager `v1.21.3` with a
`letsencrypt` ClusterIssuer, Argo CD `v2.14.11` with the `connectsphere` AppProject and the two
Applications (`deploy/argocd/k3s/`), the two namespaces, and the deploy gate:

- a `cs-deploy` user with a locked password;
- `/usr/local/bin/connectsphere-deploy`, which each deploy key may run only for its own environment
  (`command="… staging",restrict` in `~cs-deploy/.ssh/authorized_keys`: no shell, no port forwarding);
- per environment, a `deployer` ServiceAccount (`deploy/oracle/deployer-rbac.yaml`) that may write its
  own namespace's `connectsphere-secrets`, restart its services, read its workloads and its own Argo CD
  Application, and nothing else. The gate uses only that account.

Add `--acme-staging` the first time if you expect to retry a lot: certificates then come from Let's
Encrypt's staging server (browsers will warn, limits are generous). Run again without it to switch.

Check a key from your laptop: `ssh -i connectsphere-staging-deploy cs-deploy@<public IP> status`.

The Applications show an error until the first release creates the `deploy-state` branch. That is expected.

### 5. GitHub environments (Raphael, as the repository owner)

Environments need **admin** on the repository, and Joash has Write. Raphael either creates the two
environments as below, or gives Joash Admin (Settings → Collaborators → Role) so he can.

**Settings → Environments → New environment:**

| | `staging` | `production` |
|---|---|---|
| Deployment branches and tags | Selected branches: `main` | Selected branches: `main` |
| Required reviewers | none | **Joash** (and anyone else who may approve a production release) |
| Wait timer | none | optional |

Then each environment's values. **Variables** are not secret (they end up in the browser or in a
public hostname); **secrets** are. Each environment gets its own, never the team's shared ones.

| Name | Kind | Staging | Production | From |
|---|---|---|---|---|
| `API_HOST` | variable | `api.staging.<ip>.sslip.io` | `api.<ip>.sslip.io` | step 1's IP, dots kept (e.g. `api.staging.203.0.113.7.sslip.io`) |
| `WEB_ORIGIN` | variable | `https://connectsphere-staging-….vercel.app` | `https://connectsphere-….vercel.app` | step 3.3 |
| `SUPABASE_URL` | variable | staging project URL | production project URL | step 2 |
| `SUPABASE_ANON_KEY` | variable | staging anon key | production anon key | step 2 |
| `DEPLOY_SSH_HOST` | variable | the VM's public IP | the same | step 1 |
| `DEPLOY_SSH_KNOWN_HOSTS` | variable | output of `ssh-keyscan -t ed25519 <ip>` | the same | step 4 |
| `DATABASE_URL` | secret | staging transaction pooler URI | production transaction pooler URI | step 2 |
| `MIGRATE_DATABASE_URL` | secret | staging session pooler URI | production session pooler URI | step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | staging service_role key | production service_role key | step 2 |
| `KAFKA_SASL_PASSWORD` | secret | `openssl rand -hex 24` | another `openssl rand -hex 24` | your laptop; letters and digits only |
| `DEPLOY_SSH_KEY` | secret | contents of `connectsphere-staging-deploy` | contents of `connectsphere-production-deploy` | step 4 (the private key files) |
| `VERCEL_TOKEN` | secret | the token | the same token | step 3.5 |
| `VERCEL_ORG_ID` | secret | `orgId` | the same | step 3.2 |
| `VERCEL_PROJECT_ID` | secret | connectsphere-staging's `projectId` | connectsphere's `projectId` | step 3.2 |

The workflow derives the rest and adds the in-cluster addresses, which are the same in both
namespaces: `SUPABASE_JWKS_URL` (from `SUPABASE_URL`), `KAFKA_BROKERS=redpanda:9092`,
`KAFKA_SASL_USERNAME=connectsphere`, `TEMPORAL_ADDRESS=temporal:7233`, `TEMPORAL_NAMESPACE=default`
(`deploy/release/secret-env.mjs`). Its first step lists any value that is missing, by name.

**Kafka's password is fixed when the broker first starts** (Redpanda creates the `connectsphere` user
from it once, on its volume). To change it later, change it in the broker first:
`sudo kubectl -n connectsphere-staging exec redpanda-0 -- rpk security user update connectsphere --new-password <new> --mechanism SCRAM-SHA-256`
(with `-X` TLS and SASL flags as the superuser), then update the secret and release.

If sslip.io's certificates fail with `too many certificates already issued for "sslip.io"` (the
domain is not on the Public Suffix List, so every sslip.io user shares Let's Encrypt's weekly limit),
use DuckDNS instead: sign in at <https://www.duckdns.org>, create `connectsphere-<something>` pointing at
the VM's IP, and set `API_HOST` to `api.staging.connectsphere-<something>.duckdns.org` and
`api.connectsphere-<something>.duckdns.org` (DuckDNS answers for every name under yours, and is on the
Public Suffix List, so its limit is your own).

### 6. The first release

1. Merge a pull request to main (or **Actions → Release → Run workflow** on main).
2. `Build` and `Publish` push five images and sign them. **The first time only**, Raphael opens
   <https://github.com/raphaelkwek?tab=packages>, and for each `connectsphere-*` package:
   **Package settings → Change visibility → Public**. The VM pulls without credentials. Then re-run
   the failed jobs of the run.
3. `Deploy staging` writes the Secret through the gate, commits `environments/staging` to
   `deploy-state` (creating the branch the first time), waits for Argo CD to report Synced and Healthy
   at that commit (the migrate Job runs first, as a PreSync hook, against staging's session pooler),
   then runs the smoke tests: `/healthz` and `/readyz` of each service inside the cluster (database `ok`,
   Kafka `reachable`), Cerbos, the worker, the public API over TLS (routes, nothing else exposed, CORS
   for staging's origin only), then builds and deploys the web app to Vercel and checks it.
4. `Deploy production` waits for the required reviewer. Approve it in the run (**Review deployments**).
   It then does the same with **the same commit and the same digests** under `environments/production`.

### 7. The first Lead in each environment

Once an environment's first release has run its migrations, create its first Event Coordinator Lead
from your laptop. The script never reads `.env` (that points at the shared project), refuses to run
unless both URLs belong to the `--project-ref` you type, and never handles or prints a password:

```bash
SUPABASE_URL=https://<staging ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY='<staging service_role key>' MIGRATE_DATABASE_URL='<staging session pooler URI>' npm run lead:create -- --project-ref <staging ref> --email lead@your-domain   --display-name "Lead One" --redirect-to https://connectsphere-staging-….vercel.app   # the web origin
```

It invites the Lead through Supabase Auth's admin invite (`POST /auth/v1/invite`, what
`auth.admin.inviteUserByEmail` sends) with the service-role key, so Supabase emails the Lead a link.
It then inserts the identity user and gives it the `EVENT_COORDINATOR_LEAD` role (`identity.users`,
`identity.user_roles`, and the `identity.role_policy` row the seeds use). Run it again with the same
email and nothing changes, and no second invite is sent. Repeat with production's values. Supabase's
free plan sends only a few emails an hour, which is plenty for this.

**The Lead sets their own password from the invite.** The email's link opens the web app's
**Set your password** screen (`#/set-password`). The script sets it as the invite's `redirect_to`, so
step 2's Redirect URLs must allow it: `https://connectsphere-staging-….vercel.app/**` does. The screen
does the following:

- reads the short-lived session Supabase puts in the address bar and removes it from the address bar at once;
- asks for the new password twice (at least six characters, Supabase's default minimum);
- sets it with that session (`PUT /auth/v1/user`, the request `supabase.auth.updateUser({ password })` makes);
- sends the Lead to sign in.

If Supabase sends the link back to the site root instead, the app moves it onto the screen. A
password-reset link (Supabase dashboard → Authentication → Users → **Send password recovery**) lands
there too. An expired or used link shows a message asking for a new one. Other users are added through
the app, or the same way with the identity tables.

Without the script: the Lead's own password can also be set by whoever creates them in the Supabase
dashboard (Authentication → **Add user**, auto-confirm). Copy its UID, then run this in the SQL editor:

```sql
insert into identity.role_policy (role, description)
  values ('EVENT_COORDINATOR_LEAD', 'Assigns, reassigns and oversees Event Coordinators') on conflict (role) do nothing;
with u as (insert into identity.users (supabase_user_id, email, is_active, display_name)
           values ('<UID>', '<email>', true, 'Lead One') returning id)
insert into identity.user_roles (user_id, role) select id, 'EVENT_COORDINATOR_LEAD' from u;
```

### 8. Promote, roll back, look inside

- **Promote:** every merge to main builds once and deploys staging. Production gets that release only
  when its reviewer approves the waiting `Deploy production` job. A release that is never approved never
  reaches production; the next merge's run waits behind it.
- **Roll back** (either environment):
  - revert the commit on `deploy-state` that deployed it (`git revert <sha>` on that branch, push).
    Argo CD syncs the previous release within three minutes, or at once with
    `ssh -i <key> cs-deploy@<ip> sync <the new deploy-state commit>`;
  - or **Actions → Release → Run workflow** with `release` set to an earlier commit on main. Its images
    are not rebuilt: the workflow looks them up by tag, checks they were signed by this workflow on main,
    and deploys them to staging and then, after approval, production.
  - Migrations are not rolled back (ADR-0012: expand, migrate, contract), so an older release must still
    work against the newer schema.
- **Look inside:** `ssh -i <key> cs-deploy@<ip> status` or `health`. As admin on the VM:
  `sudo kubectl -n connectsphere-staging get pods`, `sudo kubectl -n connectsphere-staging logs deploy/planning-core`.
  Argo CD's UI is not exposed: `ssh -L 8080:localhost:8080 ubuntu@<ip>`, then on the VM
  `sudo kubectl -n argocd port-forward svc/argocd-server 8080:443`, and open <https://localhost:8080>
  (user `admin`, password from `sudo kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`).
- **Restart the VM:** `sudo reboot`. k3s, the firewall rules and every workload come back on their own;
  both environments are down for the minute or two it takes.

### What CI shows on a pull request, and what it does not

| Shown in CI | Not shown until the accounts exist |
|---|---|
| Every released image builds natively on amd64 and arm64 and starts hardened (Cerbos with the policies loaded) | The push to GHCR, the multi-arch index and the signature (they run on main) |
| The k3s overlays render, pass `kubeconform -strict` with the Traefik and cert-manager schemas, pass the hardening checks, and differ only in namespace, hostnames and Secret names | Argo CD following the `deploy-state` branch on the VM |
| On kind: Traefik, cert-manager, the deploy gate and its RBAC, the deploy state rendered from this commit's overlay on GitHub (by kubectl and by Argo CD's own kustomize), Redpanda with SCRAM over TLS, the Temporal dev server, Cerbos, the migrate Job (twice), every service ready with Kafka reachable, the worker connected, the API through Traefik over TLS with CORS | Let's Encrypt (kind uses a self-signed issuer of the same name), the Oracle firewall, Supabase Auth and its tokens, Vercel |
| The state and env-file scripts, the Lead script's guard, CORS and the SPA's API base URL (unit tests) | The Lead script against a real project |
| actionlint on the release workflows, shellcheck on every script | `bootstrap.sh` on a real VM |

## The Hugging Face path (needs PRO)

> **Blocked on 3 Nov 2026: Hugging Face no longer hosts Docker Spaces for free.** The probe
> (`npm run deploy:space -- --probe`) was refused with HTTP 402: "Static Spaces are free for everyone,
> but hosting Gradio and Docker Spaces on free cpu-basic requires a PRO subscription." This path
> needs a PRO subscription (USD 9 a month, a card), or another host for the same image. The image,
> `start.sh` and the CI job that runs it are host-independent: any host that runs one Docker container
> with one public port can run it. Until a host is chosen, nothing here is deployed.

### Checklist

1. **Supabase, twice.** Create `connectsphere-staging` and `connectsphere-production` (Southeast Asia,
   Singapore). From each project's **Connect** and **Settings → API**, fill
   `C:\Users\Joash Lau\connectsphere-secrets\staging.env` and `production.env`:
   - `DB_PASSWORD`;
   - `DATABASE_URL`, the transaction pooler URI;
   - `MIGRATE_DATABASE_URL`, the session pooler URI;
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

   Paste the URIs exactly as Supabase shows them, with `[YOUR-PASSWORD]` still in them. The script puts
   `DB_PASSWORD` in, URL-encoded.
2. **Hugging Face token.** huggingface.co → Settings → Access Tokens → **New token**, type *Write*. Put
   it in `shared.env` as `HF_TOKEN`.
3. **Vercel token.** vercel.com → Account Settings → Tokens. Put it in `shared.env` as `VERCEL_TOKEN`.
4. `npm run deploy:space -- --env staging`, then check staging.
5. `npm run deploy:space -- --env production`. It refuses unless the staging Space is running and healthy.
6. In each Supabase project, Authentication → URL Configuration: set the **Site URL** to the
   environment's web origin (the script prints it), and add `<web origin>/**` under **Redirect URLs**.
   Then `npm run lead:create` (step 7 below) with `--redirect-to <web origin>`.
7. Add both Space URLs (the script prints them) to `deploy/space/spaces.txt` and commit, so the
   keep-awake job pings them.

The secrets folder is outside the repository and is never committed. Only `deploy-space.mjs` reads it,
and it never prints a value: every line it or a tool prints is masked. A blank key stops it with a
message naming the key.

### What `deploy:space` does

1. Asks Hugging Face who the token belongs to. The Space is `<you>/connectsphere-<env>`, at
   `https://<you>-connectsphere-<env>.hf.space`.
2. Builds the web app with `VITE_API_BASE_URL` set to that Space, and deploys it with the Vercel CLI
   (`vercel@65.10.0`, `--token`) to the Vercel project `connectsphere-staging` or `connectsphere`, which it
   creates if missing. It reads the project's production origin, the `*.vercel.app` alias.
3. Creates the Space if missing (Docker SDK, **public**: the SPA must reach it without a Hugging Face
   token, and every API call still needs a Supabase token). It then sets the Space secrets
   `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY`, and the variable `CORS_ALLOWED_ORIGINS` (the web origin, and nothing else).
4. Pushes the Space repository: `deploy/space/Dockerfile` at its root and the committed source it builds
   (`git archive HEAD`, so only what is committed deploys). Hugging Face builds the image.
5. Waits for the Space to reach RUNNING, then smoke-tests it:
   - `/healthz`;
   - the API routes answer 401 with the error envelope;
   - nothing else is routed;
   - CORS allows the web origin only.

   Then it smoke-tests the web app (the shell, built for the Space).

### Inside the Space

One container, as uid 1000, with one public port (7860). `deploy/space/start.sh`:

- checks the settings;
- makes a TLS certificate and a random Kafka password (both live only as long as the container);
- runs every migration against the **session pooler**;
- then starts these under supervisord:
  - planning-core, its Temporal worker, registration and notification;
  - Redpanda (SASL/SCRAM over TLS, on 127.0.0.1), the Temporal dev server and Cerbos;
  - **Caddy** on 7860, routing `/identity`, `/event`, `/venue` and `/equipment` (planning-core),
    `/notification` and `/registration` under `/api/v1`, with the prefix stripped, as the k3s Ingress does.
    Health, readiness and metrics stay internal; Caddy itself answers a static `/healthz`.

Known limits:

- **The disk is ephemeral.** Redpanda's topics and Temporal's workflows start empty after every restart
  or rebuild: a free Space has no volume to keep Temporal's file on, as the VM does. Supabase holds all
  the data, and the outbox relay republishes anything not yet published. A completion or hold-expiry
  timer lost in a restart is re-created when the worker starts, and the sweeps complete or expire
  anything overdue within five minutes (see [What survives a redeploy](#what-survives-a-redeploy)).
- **Port 6543 may be blocked.** A Space's outbound traffic may not allow Supabase's transaction-pooler
  port. If `start.sh` cannot reach `DATABASE_URL`, the services use the session pooler too, and the log
  says so by name. Port 5432 is reported open for Spaces; if even that is blocked, the Space cannot run
  and the script stops at the smoke test.
- **Sleep.** A free Space sleeps after about 48 hours without traffic. `.github/workflows/keep-awake.yml`
  hits each URL in `deploy/space/spaces.txt` every 6 hours, needing no secret. A sleeping Space wakes
  on the first request, in a minute or two.
- **Rebuild on deploy.** Each `deploy:space` rebuilds the image on Hugging Face (several minutes), and
  setting secrets restarts the Space.

Look inside: the Space's page → **Logs** (container), which shows every process's output. Roll back:
check out an earlier commit and run `deploy:space` again. Production uses exactly the commit you run it
from, so run staging and production from the same commit.

CI (`deploy.yml`, job "Space image") builds the image from the same Space repository the script pushes.
It runs it as a Space runs it, against a throwaway Postgres and never Supabase, with `DATABASE_URL`
pointing at a closed port, and checks:

- the fallback and the migrations;
- every process running;
- each service ready with Kafka reachable;
- the worker connected and re-created the timers, and both sweeps ran;
- with Temporal's state on a named volume, as the VM's gate runs it: the volume is owned by the uid
  that runs Temporal, and a workflow started before the container is replaced still runs after it;
- the routes and CORS through Caddy.

What CI cannot show: Hugging Face's own build, its egress rules, and sleep.
