/**
 * B2 — validation applied at submission, whether the request is submitted
 * directly (B1) or from a draft (C2).
 *
 * Every failing field is reported, never just the first: B2's second
 * acceptance criterion makes returning one field a failed test.
 */

export interface SubmissionCandidate {
  name?: string | null;
  purpose?: string | null;
  description?: string | null;
  proposedStartAt?: string | null;
  proposedEndAt?: string | null;
  expectedAttendance?: number | null;
  registrationRequired?: boolean | null;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  equipmentRequired?: boolean | null;
}

export interface FieldError {
  field: string;
  message: string;
}

const REQUIRED_TEXT_FIELDS = [
  { field: "name", label: "Event name" },
  { field: "purpose", label: "Purpose" },
  { field: "description", label: "Description" },
] as const;

function hasContent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateSubmission(
  candidate: SubmissionCandidate,
  now: Date = new Date()
): FieldError[] {
  const errors: FieldError[] = [];

  for (const { field, label } of REQUIRED_TEXT_FIELDS) {
    if (!hasContent(candidate[field])) {
      errors.push({ field, message: `${label} is required.` });
    }
  }

  const start = parseInstant(candidate.proposedStartAt);
  const end = parseInstant(candidate.proposedEndAt);

  if (!candidate.proposedStartAt) {
    errors.push({ field: "proposedStartAt", message: "Proposed start date and time is required." });
  } else if (!start) {
    errors.push({
      field: "proposedStartAt",
      message: "Proposed start date and time is not a valid date.",
    });
  } else if (start.getTime() < now.getTime()) {
    errors.push({
      field: "proposedStartAt",
      message: "The proposed start date and time must not be in the past.",
    });
  }

  if (!candidate.proposedEndAt) {
    errors.push({ field: "proposedEndAt", message: "Proposed end date and time is required." });
  } else if (!end) {
    errors.push({
      field: "proposedEndAt",
      message: "Proposed end date and time is not a valid date.",
    });
  } else if (start && end.getTime() <= start.getTime()) {
    errors.push({
      field: "proposedEndAt",
      message: "The end date and time must be later than the start date and time.",
    });
  }

  const attendance = candidate.expectedAttendance;
  if (attendance === null || attendance === undefined) {
    errors.push({ field: "expectedAttendance", message: "Expected attendance is required." });
  } else if (!Number.isInteger(attendance) || attendance <= 0) {
    errors.push({
      field: "expectedAttendance",
      message: "Expected attendance must be a whole number greater than zero.",
    });
  }

  if (candidate.registrationRequired === null || candidate.registrationRequired === undefined) {
    errors.push({
      field: "registrationRequired",
      message: "Whether attendee registration is required must be stated.",
    });
  }

  if (candidate.equipmentRequired === null || candidate.equipmentRequired === undefined) {
    errors.push({
      field: "equipmentRequired",
      message: "Whether equipment is required must be stated.",
    });
  }

  if (candidate.registrationRequired === true) {
    const opens = parseInstant(candidate.registrationOpensAt);
    const closes = parseInstant(candidate.registrationClosesAt);

    if (!candidate.registrationOpensAt) {
      errors.push({
        field: "registrationOpensAt",
        message: "Registration opening date and time is required when registration is required.",
      });
    } else if (!opens) {
      errors.push({
        field: "registrationOpensAt",
        message: "Registration opening date and time is not a valid date.",
      });
    }

    if (!candidate.registrationClosesAt) {
      errors.push({
        field: "registrationClosesAt",
        message: "Registration closing date and time is required when registration is required.",
      });
    } else if (!closes) {
      errors.push({
        field: "registrationClosesAt",
        message: "Registration closing date and time is not a valid date.",
      });
    } else {
      if (opens && closes.getTime() <= opens.getTime()) {
        errors.push({
          field: "registrationClosesAt",
          message: "Registration closing must be later than registration opening.",
        });
      }
      if (start && closes.getTime() > start.getTime()) {
        errors.push({
          field: "registrationClosesAt",
          message: "Registration closing must be no later than the event start.",
        });
      }
    }
  }

  return errors;
}
