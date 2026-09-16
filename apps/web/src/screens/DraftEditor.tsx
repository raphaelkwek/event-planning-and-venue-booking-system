import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Textfield from "@atlaskit/textfield";
import TextArea from "@atlaskit/textarea";
import { Checkbox } from "@atlaskit/checkbox";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import { getDraft, saveDraft, submitDirect, submitDraft, toFormFields, updateDraft } from "../api/events.js";
import { ApiError } from "../api/client.js";
import type { RequestFields } from "../api/types.js";
import { Refusal } from "../components/Refusal.js";

const EMPTY: RequestFields = {
  name: "",
  purpose: "",
  description: "",
  proposedStartAt: "",
  proposedEndAt: "",
  expectedAttendance: "",
  accessibilityNeeds: "",
  equipmentRequired: false,
  registrationRequired: false,
  registrationOpensAt: "",
  registrationClosesAt: "",
};

/**
 * C1, C2, B1, B2.
 *
 * Save keeps the request a draft and applies none of B2's rules beyond dates
 * having to be dates. Submit applies all of them, and a refusal binds each
 * message to the field that caused it rather than showing only the first.
 */
export function DraftEditor() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";

  const [fields, setFields] = useState<RequestFields>(EMPTY);
  const [draftId, setDraftId] = useState<string | null>(isNew ? null : (id ?? null));
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew || !id) return;
    setLoading(true);
    getDraft(session.token, id)
      .then((draft) => setFields(toFormFields(draft)))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id, isNew, session.token]);

  const fieldError = (name: keyof RequestFields) =>
    error instanceof ApiError ? error.fieldMessage(name) : undefined;

  function set<K extends keyof RequestFields>(key: K, value: RequestFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function onSave() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const saved = draftId
        ? await updateDraft(session.token, draftId, fields)
        : await saveDraft(session.token, fields);
      setDraftId(saved.id);
      setNotice(`Saved as a draft at ${new Date(saved.lastSavedAt).toLocaleTimeString()}.`);
      if (!draftId) navigate(`/drafts/${saved.id}`, { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      // A draft is submitted in place; a request never saved is submitted directly (B1).
      const submitted = draftId
        ? await (async () => {
            await updateDraft(session.token, draftId, fields);
            return submitDraft(session.token, draftId);
          })()
        : await submitDirect(session.token, fields);
      navigate(`/requests/${submitted.id}`);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2>{draftId ? "Edit draft" : "New event request"}</h2>

      {notice && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="success">
            <p style={{ margin: 0 }}>{notice}</p>
          </SectionMessage>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Refusal error={error} />
      </div>

      <Field label="Event name" error={fieldError("name")} required>
        <Textfield value={fields.name} onChange={(e) => set("name", (e.target as HTMLInputElement).value)} />
      </Field>

      <Field label="Purpose" error={fieldError("purpose")}>
        <TextArea
          value={fields.purpose}
          minimumRows={2}
          onChange={(e) => set("purpose", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>

      <Field label="Description" error={fieldError("description")}>
        <TextArea
          value={fields.description}
          minimumRows={3}
          onChange={(e) => set("description", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Field label="Proposed start" error={fieldError("proposedStartAt")}>
            <Textfield
              type="datetime-local"
              value={fields.proposedStartAt}
              onChange={(e) => set("proposedStartAt", (e.target as HTMLInputElement).value)}
            />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Proposed end" error={fieldError("proposedEndAt")}>
            <Textfield
              type="datetime-local"
              value={fields.proposedEndAt}
              onChange={(e) => set("proposedEndAt", (e.target as HTMLInputElement).value)}
            />
          </Field>
        </div>
      </div>

      <Field label="Expected attendance" error={fieldError("expectedAttendance")}>
        <Textfield
          type="number"
          value={fields.expectedAttendance}
          onChange={(e) => set("expectedAttendance", (e.target as HTMLInputElement).value)}
        />
      </Field>

      <Field label="Accessibility needs" error={fieldError("accessibilityNeeds")}>
        <TextArea
          value={fields.accessibilityNeeds}
          minimumRows={2}
          onChange={(e) => set("accessibilityNeeds", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>

      <div style={{ margin: "12px 0" }}>
        <Checkbox
          isChecked={fields.equipmentRequired}
          onChange={(e) => set("equipmentRequired", e.target.checked)}
          label="Equipment is required"
        />
        {fieldError("equipmentRequired") && <FieldError message={fieldError("equipmentRequired")!} />}

        <Checkbox
          isChecked={fields.registrationRequired}
          onChange={(e) => set("registrationRequired", e.target.checked)}
          label="Attendee registration is required"
        />
        {fieldError("registrationRequired") && (
          <FieldError message={fieldError("registrationRequired")!} />
        )}
      </div>

      {fields.registrationRequired && (
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <Field label="Registration opens" error={fieldError("registrationOpensAt")}>
              <Textfield
                type="datetime-local"
                value={fields.registrationOpensAt}
                onChange={(e) => set("registrationOpensAt", (e.target as HTMLInputElement).value)}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Registration closes" error={fieldError("registrationClosesAt")}>
              <Textfield
                type="datetime-local"
                value={fields.registrationClosesAt}
                onChange={(e) => set("registrationClosesAt", (e.target as HTMLInputElement).value)}
              />
            </Field>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <Button onClick={onSave} isDisabled={busy}>
          Save draft (C1)
        </Button>
        <Button appearance="primary" onClick={onSubmit} isDisabled={busy}>
          Submit request (B1, B2)
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
        {label}
        {required && <span style={{ color: "#AE2E24" }}> *</span>}
      </label>
      {children}
      {error && <FieldError message={error} />}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <div style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>{message}</div>;
}
