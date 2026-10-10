# G1 — Update non-significant event information

Twelve cases, written from the story on 11 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| The owning organiser and the assigned coordinator can edit purpose, description, accessibility notes and contact details while the event is Approved, Planning or Confirmed | G1-T1, G1-T2, G1-T3, G1-T4 |
| The significant fields are not editable on this screen; attempting to edit them directs the user to the change-request process and stores no value | G1-T5, G1-T6 |
| Each saved edit records the editing user, the timestamp, and the before and after value of each changed field | G1-T7, G1-T12 |
| An edit by a user who is neither the owner nor the assigned coordinator is refused, storing no value and no history | G1-T8, G1-T9 |
| If the save fails, no field is changed and no history entry is written | G1-T10, G1-T11 |

**Safety Review is editable too, for the time being** (decided 11 Oct 2026). CR-06 added it
between Planning and Confirmed after G1 was written, so the criteria above don't name it.

## Terms

- **Significant fields** are the event's date, start and end time, expected attendance, venue
  requirements and equipment requirements. Changing one affects arrangements already made, so it
  goes through a change request (S1, S2), not this screen. The list is kept once, in
  `backend/packages/contracts`.
- **Accessibility notes** are what the request form calls "Accessibility needs".
- **Contact details** are new with G1: free text, such as a name, email and phone number. The
  request form (B1) doesn't ask for them, so they start empty.
- **The assigned coordinator** is the one the request's "Assigned coordinator" field names. E1
  assigns `coordinator@connectsphere.test` and `coordinator2@connectsphere.test` in turn, so cases
  refer to "the assigned coordinator" and "the other seeded coordinator" rather than by name.

## Two people editing at once

Each edit carries the version of the event the editor loaded (`If-Match`, ADR-0015). If someone
else saved in between, the save is refused with `412` and nothing is stored, rather than one
person's edit silently replacing the other's (G1-T11).

## Reading the history

The app doesn't show field-change history yet, so G1-T4 and G1-T6 to G1-T12 read it in the SQL
editor:

~~~sql
select field_name, previous_value, new_value, actor_user_id, actor_role, triggering_action, occurred_at
from event.event_history
where event_id = '<id>' and entry_type = 'FIELD_CHANGE'
order by occurred_at, field_name;
~~~
