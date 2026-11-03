# EN-22 — Traceability and DORA dashboard

This page links the two views EN-22 produces. Both are generated, not typed.

| View | Snapshot (committed) | Live, on every run | Generator |
|---|---|---|---|
| Traceability matrix: story, acceptance criterion, test, last result | [traceability-matrix-2026-11-03.md](traceability-matrix-2026-11-03.md) | The `traceability` job of [CI](../../../.github/workflows/ci.yml): job summary, and the `traceability-matrix` artifact (Markdown, HTML, JSON) | `documentation/scripts/traceability-matrix.ts` |
| DORA metrics: deployment frequency, lead time, change failure rate, time to restore | [dora-2026-11-02.md](dora-2026-11-02.md) | The [DORA metrics workflow](../../../.github/workflows/dora.yml): weekly (Monday 00:30 SGT) and on demand; job summary and the `dora-metrics` artifact | `documentation/scripts/dora.ts` |

CI can't push to `main` (branch protection), so the live views are job summaries and artifacts.
A snapshot worth keeping is generated and committed by hand, as these two were.

## Run them yourself

```bash
# The matrix, from the JSON reports CI uploads (download test-results-* and extract them under results/):
npx tsx documentation/scripts/traceability-matrix.ts --results results --out matrix-out --summary

# DORA, with the GitHub CLI logged in (gh auth login):
npx tsx documentation/scripts/dora.ts --days 30 --out dora.md
```

## What the matrix reports

Per acceptance criterion row of `documentation/traceability/sprint-*.csv`: the test's last result
(pass, fail, skipped, or **not found** when the name in the CSV is in no report), and the
functional cards whose tag (`S2-T1`) appears in the test's name. It ends with a summary per story:
criteria covered, with a failing test, with no test, with tests but no pass, and test names that
don't exist. Mismatches are warnings, not failures, in CI; each names its sprint file and row.
Cards whose Status is not exactly Pass, Fail, Not Executed or Blocked (implementation.md section
8.4) are counted as a warning; any Status starting "Pass" is treated as Pass.

The inputs are vitest's JSON reports (every vitest config writes one when `CI` is set), node:test
JUnit files for `documentation/scripts/*.test.ts`, and, when a job uploads one named
`playwright-report*`, Playwright's JSON report (EN-14's `e2e` job).

## The DORA definitions

They are printed at the top of every report. In short: deployment frequency is successful `main`
CI runs (there is no production deployment yet, EN-10 builds it); lead time is first commit to
merge; change failure rate is merges whose `main` run failed or that a revert or hotfix pull request
followed within 24 hours; time to restore is the first failing `main` run to the next green one.
