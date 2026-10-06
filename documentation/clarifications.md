# Customer clarification log

**Owner:** the Product Owner (PX-07, SPM-148) · **Started by:** Joash, 7 Oct 2026

Every question we put to the customer, and every answer, goes here. A story's acceptance criteria change **only after** the answer is recorded here. Then the story is revised, with a ⚠ note citing the entry (`final user stories.md`).

Other documents already point here:
- `implementation.md` §4.6 (P1 and CQ-02);
- `change-requests.md` (CQ-04 to CQ-10);
- the Jira comments on PX-07 and PX-14.

## How to record an answer

1. Fill in the question's row below: the date asked, where it was asked (the section's clarification board, or a consultation), the date answered, and the answer **in the customer's words**, or a link to them.
2. Add the stories it changes, and revise those stories in `final user stories.md` with a ⚠ note citing this entry.
3. Close the question's Jira item, and add a CHANGELOG entry.

## Open questions

None of these has a recorded answer yet. The first three have been open since 1 Oct, and P1 (Sprint 2) is blocked on CQ-02.

| Id | Jira | Question | Affects | Asked | Answered | Answer |
|---|---|---|---|---|---|---|
| CQ-01 | SPM-156 | R7 lets a VIP be added "even when no registration places remain", but R2 defines places as capacity minus VIP additions, so that clause can never apply. Should VIPs come from a pool the organiser reserves? | R2, R7 | | | |
| CQ-02 | SPM-157 | P1: is available equipment the total minus the **peak** use at any moment in the period, or minus **every** overlapping reservation added up (which counts back-to-back bookings as simultaneous)? | P1, Q1 | | | |
| CQ-03 | SPM-158 | T2: must a notification be visible within about 10 seconds of the event that causes it? | T2 | | | |
| CQ-04 | SPM-184 | When an event uses several venues, which capacity limits registrations: a designated main venue, the total of all its venues, or another rule? | R2, R7 | | | |
| CQ-05 | SPM-185 | Must *every* active venue booking be confirmed before an event can be confirmed, or is one enough? | F5 | | | |
| CQ-06 | SPM-186 | Who places a tentative hold, Venue Staff or the assigned coordinator? Who sets the expiry, is there a default or maximum, and how long before expiry should the reminder go out? | L3, L6 | | | |
| CQ-07 | SPM-187 | Does coordinator-to-coordinator reassignment (E2) remain alongside the Lead's? May a coordinator still *view* events that aren't assigned to them? | E2, E4, A4 | | | |
| CQ-08 | SPM-188 | What does "reject the safety arrangement" lead to: is the event rejected, or sent back like "request changes"? Which stage does "request changes" return to, and do the venue and equipment bookings stay in place meanwhile? | U1, F1 | | | |
| CQ-09 | SPM-189 | Do setup and turnaround times also apply to tentative holds and unavailability blocks, and must the buffered period fit inside the venue's operating hours? | H3, I2, L3 | | | |
| CQ-10 | SPM-190 | Are emergency access and known venue restrictions new details on the venue record, maintained by Venue Staff? | H1, H3, U1 | | | |

## Earlier clarifications cited in the stories

The stories cite these answers from the customer clarification sessions. They are recorded in the stories' ⚠ notes, but the original questions and answers were never copied into the repo. **PO: please add each one's date and the customer's wording below,** so every ⚠ note traces to a source.

| Id | Cited by | What the story says it decided |
|---|---|---|
| C-04 | D5 | A rejected event can't be edited or resubmitted; its fields become read-only. |
| C-10 | R2 | *Superseded:* the registration window is now at the organiser's discretion. |
| C-11 | R4 | *Superseded:* withdrawal terms are now at the organiser's discretion. |
| C-12 | I2 | Venue Staff can block periods that are already booked. The booking is flagged, not cancelled. |
| C-13 | S3 | An approved significant change flags existing arrangements for the coordinator to decide on, rather than the system re-arranging them. |
