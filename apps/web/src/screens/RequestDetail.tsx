import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import TextArea from "@atlaskit/textarea";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import { listClarifications, openEvent, respondToClarification } from "../api/events.js";
import type { Clarification, EventRecord } from "../api/types.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";

/**
 * The organiser's view of one request: its current status (F2), the
 * clarification thread, the decision outcome (D4/D5), and the reply form that
 * D3 needs.
 */
export function RequestDetail() {
  const session = useSignedIn();
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [reply, setReply] = useState("");
  const [amendedAttendance, setAmendedAttendance] = useState("");
  const [replyError, setReplyError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setEvent(await openEvent(session.token, id));
      setClarifications((await listClarifications(session.token, id)).items);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [id, session.token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRespond() {
    if (!id) return;
    setReplyError(null);
    setBusy(true);
    try {
      const amendments =
        amendedAttendance.trim().length > 0
          ? { expectedAttendance: Number(amendedAttendance) }
          : undefined;
      await respondToClarification(session.token, id, {
        message: reply.trim().length > 0 ? reply : undefined,
        amendments,
      });
      setReply("");
      setAmendedAttendance("");
      await load();
    } catch (caught) {
      setReplyError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <Refusal error={error} />;
  if (!event) return null;

  const openClarification = clarifications.find((entry) => entry.status === "OPEN");

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 2 }}>
        <h2 style={{ marginBottom: 4 }}>{event.name}</h2>
        <p style={{ marginTop: 0, color: "#626F86" }}>{event.reference ?? "No reference yet"}</p>

        {event.status === "REJECTED" && event.rejectionReason && (
          <div style={{ marginBottom: 16 }}>
            <SectionMessage appearance="error" title="This request was rejected">
              <p style={{ margin: 0 }}>{event.rejectionReason}</p>
              <p style={{ marginBottom: 0, fontSize: 12 }}>
                Decided {formatInstant(event.decidedAt)}. A rejected request cannot be edited or
                resubmitted (D5).
              </p>
            </SectionMessage>
          </div>
        )}

        {event.status === "APPROVED" && (
          <div style={{ marginBottom: 16 }}>
            <SectionMessage appearance="success" title="This request was approved">
              <p style={{ margin: 0 }}>Approved {formatInstant(event.decidedAt)} (D4).</p>
            </SectionMessage>
          </div>
        )}

        <Detail label="Purpose" value={event.purpose} />
        <Detail label="Description" value={event.description} />
        <Detail label="Proposed start" value={formatInstant(event.proposedStartAt)} />
        <Detail label="Proposed end" value={formatInstant(event.proposedEndAt)} />
        <Detail
          label="Expected attendance"
          value={event.expectedAttendance === null ? null : String(event.expectedAttendance)}
        />
        <Detail label="Accessibility needs" value={event.accessibilityNeeds} />
        <Detail label="Equipment required" value={event.equipmentRequired ? "Yes" : "No"} />
        <Detail
          label="Registration required"
          value={event.registrationRequired ? "Yes" : "No"}
        />

        <h3 style={{ marginTop: 32 }}>Clarifications</h3>
        {clarifications.length === 0 && <p>None requested.</p>}
        {clarifications.map((entry) => (
          <div
            key={entry.id}
            style={{
              border: "1px solid #DFE1E6",
              borderRadius: 4,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Coordinator asked</strong>
              <span style={{ fontSize: 12, color: "#626F86" }}>
                {formatInstant(entry.requestedAt)}
              </span>
            </div>
            <p style={{ marginTop: 4 }}>{entry.message}</p>

            {entry.status === "RESPONDED" ? (
              <div style={{ borderLeft: "3px solid #DFE1E6", paddingLeft: 12, marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>Organiser replied</strong>
                  <span style={{ fontSize: 12, color: "#626F86" }}>
                    {formatInstant(entry.respondedAt)}
                  </span>
                </div>
                <p style={{ marginTop: 4, marginBottom: 0 }}>
                  {entry.responseMessage ?? <em>Amended the request without a message.</em>}
                </p>
              </div>
            ) : (
              <Lozenge appearance="moved">Awaiting your response</Lozenge>
            )}
          </div>
        ))}

        {openClarification && (
          <div style={{ marginTop: 16 }}>
            <h4>Respond (D3)</h4>
            <p style={{ fontSize: 12, color: "#626F86", marginTop: 0 }}>
              Reply with a message, amend the request, or both. Neither is refused.
            </p>
            <TextArea
              value={reply}
              minimumRows={3}
              placeholder="Your reply"
              onChange={(e) => setReply((e.target as HTMLTextAreaElement).value)}
            />
            <div style={{ marginTop: 8, maxWidth: 240 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Amend expected attendance (optional)
              </label>
              <Textfield
                type="number"
                value={amendedAttendance}
                onChange={(e) => setAmendedAttendance((e.target as HTMLInputElement).value)}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Button appearance="primary" onClick={onRespond} isDisabled={busy}>
                Send response
              </Button>
            </div>
            <div style={{ marginTop: 12 }}>
              <Refusal error={replyError} />
            </div>
          </div>
        )}
      </div>

      <aside style={{ flex: 1, borderLeft: "1px solid #DFE1E6", paddingLeft: 24 }}>
        <h3 style={{ marginTop: 0 }}>Status</h3>
        <Lozenge appearance={STATUS_APPEARANCE[event.status]}>{STATUS_LABELS[event.status]}</Lozenge>

        <dl style={{ fontSize: 13 }}>
          <Meta label="Submitted" value={formatInstant(event.submittedAt)} />
          <Meta label="Last saved" value={formatInstant(event.lastSavedAt)} />
          <Meta label="Assigned coordinator" value={event.assignedCoordinatorId ?? "Awaiting assignment"} />
          <Meta label="Reviewing coordinator" value={event.reviewingCoordinatorId ?? "—"} />
          <Meta label="Decision" value={event.decidedAt ? formatInstant(event.decidedAt) : "None yet"} />
        </dl>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#626F86" }}>{label}</div>
      <div>{value && value.length > 0 ? value : "—"}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ fontWeight: 600, color: "#626F86", marginTop: 12 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </>
  );
}
