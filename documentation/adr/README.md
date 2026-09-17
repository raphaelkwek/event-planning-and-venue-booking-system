# Architecture Decision Records

An ADR captures a significant architecture decision, the context that forced it, and what we
accepted in exchange — so that in Week 13 (or in any retro) we can answer "why did we do it this
way" with the reasoning we actually had at the time, not a reconstruction.

**When to write one:** any decision that would be expensive to reverse, that an instructor is
likely to question, or that a teammate would otherwise have to reverse-engineer from the code.
Not every choice needs one — `documentation/planning/plan.md` and `documentation/planning/implementation.md` remain the
day-to-day reference; an ADR is for the small number of decisions worth defending on their own.

**Template:**

```markdown
# ADR-000N: <title, phrased as the decision taken>

**Status:** Proposed | Accepted | Superseded by ADR-000M
**Date:** YYYY-MM-DD

## Context
What forced a decision here — the constraint, the requirement, the problem. No solution yet.

## Decision
What we chose, stated plainly.

## Alternatives considered
Each one, with why it lost.

## Consequences
What we get, what it costs us, and what a reviewer should watch for. Be honest about the
weak points — an ADR that only defends the choice isn't useful in a Q&A.
```

**Numbering:** sequential, never reused, even if an ADR is later superseded — supersede it in
place (update its Status) rather than deleting it.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-microservices-schema-per-service-cp-consistency.md) | Microservices with schema-per-service boundaries, CP over AP | Accepted |
| [0002](0002-orchestrated-saga-for-cross-service-cancellation.md) | Orchestrated saga with compensation for F4 cancellation | Accepted |
