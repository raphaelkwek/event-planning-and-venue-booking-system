# ConnectSphere: code repository and instructor access

**Git repository:** https://github.com/joass1/event-planning-and-venue-booking-system

The repository holds the whole software release: `frontend/`, `backend/`, `tests/`,
`documentation/`, and the CI pipeline in `.github/workflows/` (`ci.yml`, `codeql.yml`,
`deploy.yml`, `mutation.yml`, and others). `README.md` at its root says how to run the system.

## Instructor access

Both instructors must be able to open the repository. Granting it is a GitHub settings action
(repository, Settings, Collaborators) that only the owner can do, so it is recorded here once
done. The builder reports this part as `placeholder` until no `TODO` is left below.

| Instructor | GitHub username | Access granted on |
|---|---|---|
| Instructor 1 | TODO | TODO |
| Instructor 2 | TODO | TODO |

## Rebuilding the submission zip

```bash
npm ci
npm run backlog:export -- <raw Jira search results>   # only to refresh the backlog snapshot
npm run submission:build -- --deliverables "<folder with sprint docs, scripts, slides>" --zip-dir "<output folder>"
```
