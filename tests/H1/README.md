# H1 — Maintain venue records

Fourteen cases, written from the story on 4 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| The record holds name, building, capacity, layouts with capacities, facilities, accessibility features, hours per day | H1-T1, H1-T2 |
| CR-01: it also holds setup and turnaround time, maintained as in H3 | H3's cases (H3 owns the two fields) |
| Capacities are whole numbers above zero, and at least one layout is recorded | H1-T3 to H1-T7 |
| Only Venue Staff create or update; other internal roles read only, and their update changes nothing | H1-T8 to H1-T10 |
| Each create or update records who, when, and the previous values of changed fields | H1-T11 |
| Marking a venue inactive keeps its bookings, history and calendar visibility, and drops it from search | H1-T13 (the flag and what is kept); J1, J2 and I1's cases (search and calendar) |
| A rejected update leaves every stored field unchanged | H1-T12 |

H1-T14 (closing before opening) checks that operating hours make sense, which the record needs
to be usable. It is the one rule here not spelled out in the criteria.
