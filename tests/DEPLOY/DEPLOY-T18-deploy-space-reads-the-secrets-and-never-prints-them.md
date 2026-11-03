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
| Actual Result | — |
| Status | Not Executed |
| Remarks | — |
| Executed By | — |
| Date of Execution | — |
