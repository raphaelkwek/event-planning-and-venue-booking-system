import { useState } from "react";
import Button from "@atlaskit/button/new";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import SectionMessage from "@atlaskit/section-message";
import TextArea from "@atlaskit/textarea";
import { ApiError } from "../api/client.js";
import { decideChangeRequest, type ChangeRequest } from "../api/changeRequests.js";
import { formatChangeValue, SIGNIFICANT_FIELD_LABELS } from "../shared/changeRequests.js";
import { Refusal } from "./Refusal.js";

const EMPTY_REASON = "Give a reason for rejecting the change.";

/** The server's NO_LONGER_VALID names each failing field under `details.fields`. */
function detailFields(error: unknown): { field: string; message: string }[] {
  if (!(error instanceof ApiError)) return [];
  const fields = error.envelope.details?.fields;
  return Array.isArray(fields) ? (fields as { field: string; message: string }[]) : [];
}

/** S2 — Approve and Reject for the assigned coordinator while a change request is pending. */
export function ChangeDecisionActions({ request, token, onDecided }: { request: ChangeRequest; token: string; onDecided: () => void }) {
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setMode(null);
    setError(null);
    setReasonError(null);
  }

  async function send(body: Parameters<typeof decideChangeRequest>[2]) {
    setError(null);
    setBusy(true);
    try {
      await decideChangeRequest(token, request.id, body);
      close();
      setReason("");
      onDecided();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  function reject() {
    if (reason.trim().length === 0) return setReasonError(EMPTY_REASON);
    setReasonError(null);
    void send({ decision: "REJECT", reason });
  }

  const serverReason = error instanceof ApiError ? error.fieldMessage("reason") : undefined;
  const invalid = detailFields(error);

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button appearance="primary" onClick={() => setMode("approve")}>Approve change</Button>
        <Button appearance="warning" onClick={() => setMode("reject")}>Reject change</Button>
      </div>
      <ModalTransition>
        {mode === "approve" && (
          <Modal onClose={close}>
            <ModalHeader><ModalTitle>Approve this change?</ModalTitle></ModalHeader>
            <ModalBody>
              <p>Approving applies these changes to the event now.</p>
              <ul>
                {request.fields.map((field) => (
                  <li key={field.fieldName}>
                    {SIGNIFICANT_FIELD_LABELS[field.fieldName]}: {formatChangeValue(field.fieldName, field.currentValue)} →{" "}
                    {formatChangeValue(field.fieldName, field.proposedValue)}
                  </li>
                ))}
              </ul>
              <Refusal error={error} />
              {invalid.length > 0 && (
                <ul>
                  {invalid.map((entry) => (
                    <li key={entry.field}>{entry.message}</li>
                  ))}
                </ul>
              )}
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={close}>Cancel</Button>
              <Button appearance="primary" isDisabled={busy} onClick={() => void send({ decision: "APPROVE" })}>
                Confirm approval
              </Button>
            </ModalFooter>
          </Modal>
        )}
        {mode === "reject" && (
          <Modal onClose={close}>
            <ModalHeader><ModalTitle appearance="warning">Reject this change?</ModalTitle></ModalHeader>
            <ModalBody>
              <p>The organiser will see this reason. A reason is required.</p>
              <Refusal error={serverReason ? null : error} />
              <label htmlFor="change-reject-reason" style={{ fontSize: 12, fontWeight: 600 }}>Reason</label>
              <TextArea
                id="change-reject-reason"
                value={reason}
                minimumRows={3}
                onChange={(e) => setReason((e.target as HTMLTextAreaElement).value)}
              />
              {(reasonError ?? serverReason) && (
                <div style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>{reasonError ?? serverReason}</div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={close}>Cancel</Button>
              <Button appearance="warning" isDisabled={busy} onClick={reject}>Confirm rejection</Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </>
  );
}

/** S2 — the outcome of the latest decided request, on both pages. */
export function DecidedChangeNotice({ request }: { request: ChangeRequest }) {
  const when = request.decidedAt ? new Date(request.decidedAt).toLocaleDateString() : "";
  const fields = request.fields.map((field) => SIGNIFICANT_FIELD_LABELS[field.fieldName]).join(", ");
  const approved = request.status === "APPROVED";
  if (request.status === "CLOSED") {
    return (
      <div style={{ marginBottom: 16 }}>
        <SectionMessage appearance="information" title="Change request closed">
          <p style={{ margin: 0 }}>Closed on {when}, without a decision: {request.closedReason ?? ""}</p>
          <p style={{ marginBottom: 0, fontSize: 12 }}>Requested: {fields}</p>
        </SectionMessage>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionMessage appearance={approved ? "success" : "error"} title={approved ? "Change approved" : "Change rejected"}>
        <p style={{ margin: 0 }}>
          {approved ? `Change approved on ${when}` : `Change rejected on ${when}: ${request.rejectionReason ?? ""}`}
        </p>
        <p style={{ marginBottom: 0, fontSize: 12 }}>{approved ? "Changed" : "Requested"}: {fields}</p>
      </SectionMessage>
    </div>
  );
}
