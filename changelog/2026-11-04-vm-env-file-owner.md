# The Release deploy runs to the end: the env file is replaced, and the web smoke test reads the whole bundle

**Timestamp:** 2026-11-04T09:45+08:00 (SGT)
**Author:** Joash
**Reason:** The first Release run (41749647103) built, signed and published every image, then the
staging deploy stopped at `chmod: changing permissions of '/etc/connectsphere/staging.env':
Operation not permitted`. The file had been written by the manual fallback (`npm run deploy:vm`, as
the admin user), and only a file's owner may change its mode, so the gate (user `cs-deploy`) could
overwrite it but not `chmod` it. The same would happen the other way round.
**Scope:** `deploy/azure/connectsphere-vm-deploy`, `deploy/azure/deploy-vm.mjs`, `deploy/release/smoke-web.sh`. No service code, no
migration, no change to what the env file holds.

## Fixed

- **The deploy gate** writes the new settings to a temporary file beside the old one
  (`mktemp /etc/connectsphere/<env>.env.XXXXXX`), sets mode 660 on it, and renames it over
  `<env>.env`. The directory is `root:connectsphere` with mode 2770, so the gate and the admin user
  can each replace a file the other wrote, and the new file keeps the `connectsphere` group. The
  temporary file is removed however the gate exits.
- **`npm run deploy:vm`** does the same (`<env>.env.new`, then `mv -f`), so a manual deploy after
  a Release no longer fails the same way.
- **The web smoke test** (`deploy/release/smoke-web.sh`) reads the whole bundle before searching
  it. Piped into `grep -q`, curl failed with `(23) Failure writing output` as soon as grep found
  the API host and stopped reading, and `pipefail` reported "the bundle does not call" a host it
  did call (Release attempt 3, after the VM deploy and API smoke test had passed).
- The fixed gate was installed on `connectsphere-vm` by hand (`sudo install -m 0755`, the same file
  with LF endings) so the Release run could be re-run before this merges; `setup-deploy-user.sh`
  installs this version from now on.
