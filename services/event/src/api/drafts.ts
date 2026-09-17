import { Router } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { findDraftForOwner, findOwnedRequest, insertDraft, updateDraft } from "../repo/drafts.js";
import { validateSubmission } from "../domain/validation.js";
import { submitEvent } from "./submitEvent.js";
import { draftBodySchema, submissionBodySchema, toDraftFields } from "./schemas.js";
import { fieldsFromZod, refuse } from "./errors.js";
import type { EventFields } from "../repo/events.js";

/**
 * C1, C2 — drafts. A draft is an event at status Draft, and these routes are
 * the only way to edit one; once submitted it is no longer reachable here
 * (C2), because the queries are scoped to the Draft status.
 */
export function draftsRouter(sql: Sql) {
  const router = Router();

  router.post(
    "/api/v1/event-drafts",
    ...authenticate,
    requireRole("EVENT_ORGANISER"),
    async (req: ActorRequest, res) => {
      const parsed = draftBodySchema.safeParse(req.body);
      if (!parsed.success) {
        refuse(res, 400, "VALIDATION_FAILED", "This draft could not be saved.", {
          fields: fieldsFromZod(parsed.error),
        });
        return;
      }

      const draft = await insertDraft(sql, req.actor!.userId, toDraftFields(parsed.data));
      res.status(201).json(draft);
    }
  );

  router.get(
    "/api/v1/event-drafts/:id",
    ...authenticate,
    requireRole("EVENT_ORGANISER"),
    async (req: ActorRequest, res) => {
      const draft = await findDraftForOwner(sql, req.params.id, req.actor!.userId);
      if (!draft) {
        refuse(res, 404, "DRAFT_NOT_FOUND", "No draft with that reference is available to you.");
        return;
      }
      res.status(200).json(draft);
    }
  );

  router.put(
    "/api/v1/event-drafts/:id",
    ...authenticate,
    requireRole("EVENT_ORGANISER"),
    async (req: ActorRequest, res) => {
      const parsed = draftBodySchema.safeParse(req.body);
      if (!parsed.success) {
        refuse(res, 400, "VALIDATION_FAILED", "This draft could not be saved.", {
          fields: fieldsFromZod(parsed.error),
        });
        return;
      }

      const draft = await updateDraft(sql, req.params.id, req.actor!.userId, toDraftFields(parsed.data));
      if (!draft) {
        refuse(res, 404, "DRAFT_NOT_FOUND", "No draft with that reference is available to you.");
        return;
      }
      res.status(200).json(draft);
    }
  );

  /** C2 — submitting from a draft applies the full B2 validation. */
  router.post(
    "/api/v1/event-drafts/:id/submit",
    ...authenticate,
    requireRole("EVENT_ORGANISER"),
    async (req: ActorRequest, res) => {
      const draft = await findDraftForOwner(sql, req.params.id, req.actor!.userId);
      if (!draft) {
        // C2 — a request that is no longer a draft has already been submitted,
        // which is worth saying plainly rather than reporting it as missing.
        const existing = await findOwnedRequest(sql, req.params.id, req.actor!.userId);
        if (existing) {
          refuse(
            res,
            409,
            "DRAFT_ALREADY_SUBMITTED",
            "This request has already been submitted and can no longer be edited here."
          );
          return;
        }
        refuse(res, 404, "DRAFT_NOT_FOUND", "No draft with that reference is available to you.");
        return;
      }

      // C2/B2 — the organiser may submit the values currently on screen. They
      // are validated as sent, and stored only if the submission succeeds, so a
      // blocked submission changes no stored value. With no body, the draft is
      // submitted as it was last saved.
      let sentFields: EventFields | undefined;
      if (req.body && Object.keys(req.body).length > 0) {
        const parsed = submissionBodySchema.safeParse(req.body);
        if (!parsed.success) {
          refuse(res, 400, "VALIDATION_FAILED", "This request could not be submitted.", {
            fields: fieldsFromZod(parsed.error),
          });
          return;
        }
        sentFields = toDraftFields(parsed.data) as EventFields;
      }

      const errors = validateSubmission(sentFields ?? draft);
      if (errors.length > 0) {
        refuse(res, 400, "VALIDATION_FAILED", "This request is not ready to be submitted.", {
          fields: errors,
        });
        return;
      }

      const event = await submitEvent(sql, {
        ownerId: req.actor!.userId,
        actorRole: req.actor!.role,
        draftId: draft.id,
        fields: sentFields,
        correlationId: req.header("x-correlation-id") ?? null,
      });

      if (!event) {
        refuse(
          res,
          409,
          "DRAFT_ALREADY_SUBMITTED",
          "This request has already been submitted and can no longer be edited here."
        );
        return;
      }

      res.status(201).json(event);
    }
  );

  return router;
}
