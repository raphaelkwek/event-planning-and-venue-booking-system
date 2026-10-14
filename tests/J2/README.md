# J2 — Search venues by name or location

Eight cases, written from the story on 10 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| A partial, case-insensitive match on venue name or building returns every matching active venue | J2-T1, J2-T2, J2-T3, J2-T7 |
| The text search can be combined with J1's filters, and the result satisfies both | J2-T4 |
| Each result row shows venue name, building, maximum capacity and key facilities | J2-T5 |
| An empty search term with no filters returns all active venues rather than an error | J2-T6, J2-T7 |

J2-T8 checks that a search matching nothing gives an empty list and a message, not an error (J1's
rule, which a text search shares).

J2 shares J1's screen, API route and fixture. Run **FX-SEARCH** from `tests/J1/README.md` before
each case; its five FX venues are the ones the expected results name. The standard venue
(`Lee Kong Chian Auditorium`) is not used.
