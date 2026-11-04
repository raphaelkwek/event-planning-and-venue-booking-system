# DEPLOY-T18 — deploy:space reads the secrets files, puts the password into the URIs, and never prints a value

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T18 |
| Test Scenario | deploy:space reads the secrets files, puts the password into the URIs, and never prints a value |
| Pre-conditions | 1. The unit tests run (`npm run test:scripts`), with a fake secrets folder in a temp directory. |
| Test Steps | 1. Parse files with comments, CRLF, quotes and `=` in a value.<br>2. Leave keys blank.<br>3. Load an environment whose URIs contain `[YOUR-PASSWORD]` and a password with `@`, `/`, `:` and `#`.<br>4. Mask a line holding a token, the password and their encoded forms.<br>5. Work out each environment's Space and write the Space repository. |
| Test Data | A fake secrets folder; made-up values built at run time. |
| Expected Result | Step 1 reads every value; step 2 is refused naming every blank key and no value; step 3 puts the password in URL-encoded and gives the Space exactly its five values; step 4 leaves no secret in the line; step 5 gives each environment its own public `*.hf.space` host, and the Space repository holds the Dockerfile at its root, LF line endings and only the files it builds from. |
| Acceptance criterion | Deploying from the laptop reads the secrets folder outside the repository, never commits or prints a value, and fails naming any blank key. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With a fake secrets folder in a temp directory and values built at run time: comments, CRLF line ends, a quoted value and `=` inside a value were all read, and a line that is not a pair was refused. Blank keys were refused naming every blank key (`staging.env has no value for B, C, D`, `shared.env has no value for VERCEL_TOKEN`) and no value. A password holding `@`, `/`, `:` and `#` replaced `[YOUR-PASSWORD]` URL-encoded, and the Space got exactly DATABASE_URL (port 6543), MIGRATE_DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. A line holding the token, the password, the URL-encoded password and the base64 token was masked four times with no secret left. Each environment got its own `*.hf.space` host; the written Space repository held the Dockerfile at its root, start.sh with LF line ends, the files it builds from, and not the web app's sources. |
| Status | Pass |
| Remarks | Automated (script test, node:test) · Commit: 5bfb25e · Evidence: `deploy/space/deploy-space.test.mjs` › DEPLOY-T18 the secrets files are read with comments, CRLF, quotes and = in values; `deploy/space/deploy-space.test.mjs` › DEPLOY-T18 a blank key is refused, naming every blank key and no value; `deploy/space/deploy-space.test.mjs` › DEPLOY-T18 the database password replaces [YOUR-PASSWORD] URL-encoded, and the Space gets the five values; `deploy/space/deploy-space.test.mjs` › DEPLOY-T18 every secret, and its URL-encoded and base64 forms, is masked in output; `deploy/space/deploy-space.test.mjs` › DEPLOY-T18 each environment has its own public Space host, and the Space repository builds the Dockerfile, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
