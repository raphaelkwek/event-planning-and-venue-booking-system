import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { useSignedIn } from "../auth/SessionContext.js";
import { getVenue, type Venue } from "../api/venues.js";
import {
  listBlocks,
  recordBlock,
  removeBlock,
  reviewBlock,
  REASON_TYPES,
  type Block,
  type BlockInput,
  type Disrupted,
  type ReasonType,
} from "../api/unavailability.js";
import { Refusal } from "../components/Refusal.js";
import { useUserNames } from "../shared/useUserNames.js";
import { formatInstant, UNAVAILABILITY_LABELS } from "../shared/status.js";
import { formatPeriod, fromInputs } from "../shared/singaporeTime.js";

/**
 * I2 — the venue's Venue Staff record a period when it can't be used, even one
 * already booked. "Review" shows each booking, hold and request it would
 * disrupt before anything is recorded; recording flags them Requires
 * Reconfirmation and tells their coordinators. The venue's active blocks are
 * listed, and each can be removed. Times are Singapore time. The server limits
 * all of this to the venue's own Venue Staff.
 */

type Field = "startDate" | "startTime" | "endDate" | "endTime" | "reasonType" | "description";
type Form = Record<Field, string>;
const EMPTY: Form = { startDate: "", startTime: "", endDate: "", endTime: "", reasonType: "", description: "" };

const KIND_LABELS: Record<Disrupted["kind"], [one: string, many: string]> = {
  BOOKING: ["booking", "bookings"],
  HOLD: ["hold", "holds"],
  REQUEST: ["booking request", "booking requests"],
};

/**
 * The block as entered, or the message under each field that is wrong (I2-T2, I2-T3). Leaving both end
 * fields empty records a block with no end, which lasts until Venue Staff remove it (I5).
 */
function check(form: Form): { input: BlockInput } | { errors: Partial<Record<"startsAt" | "endsAt" | "reasonType" | "description", string>> } {
  const errors: Partial<Record<"startsAt" | "endsAt" | "reasonType" | "description", string>> = {};
  const startsAt = form.startDate && form.startTime ? fromInputs(form.startDate, form.startTime) : null;
  const endsAt = form.endDate && form.endTime ? fromInputs(form.endDate, form.endTime) : null;
  if (!startsAt) errors.startsAt = "Enter the start date and time.";
  if (!endsAt && (form.endDate || form.endTime)) {
    errors.endsAt = "Enter both the end date and the end time, or leave both empty for a block with no end.";
  } else if (endsAt && startsAt && Date.parse(endsAt) <= Date.parse(startsAt)) errors.endsAt = "The end must be after the start.";
  if (!form.reasonType) errors.reasonType = "Choose a reason type.";
  if (form.description.trim() === "") errors.description = "Enter a description.";
  if (Object.keys(errors).length > 0) return { errors };
  return { input: { startsAt: startsAt!, endsAt, reasonType: form.reasonType as ReasonType, description: form.description.trim() } };
}

/** "1 booking now requires reconfirmation." or "2 bookings and 1 booking request now require reconfirmation." */
function flaggedSentence(disrupted: readonly Disrupted[]): string {
  if (disrupted.length === 0) return "";
  const counts = (["BOOKING", "HOLD", "REQUEST"] as const)
    .map((kind) => [kind, disrupted.filter((d) => d.kind === kind).length] as const)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${n} ${KIND_LABELS[kind][n === 1 ? 0 : 1]}`);
  const listed = counts.length === 1 ? counts[0] : `${counts.slice(0, -1).join(", ")} and ${counts[counts.length - 1]}`;
  return ` ${listed} now ${disrupted.length === 1 ? "requires" : "require"} reconfirmation.`;
}

function describe(d: Disrupted): string {
  const kind = KIND_LABELS[d.kind][0];
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${d.reference} for ${d.eventReference ?? "an event"}, ${formatPeriod(d.overlapFrom, d.overlapUntil)}`;
}

export function VenueUnavailability() {
  const session = useSignedIn();
  const { id } = useParams<{ id: string }>();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [reviewing, setReviewing] = useState<{ input: BlockInput; disrupted: Disrupted[] } | null>(null);
  const [removing, setRemoving] = useState<Block | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = useUserNames(session.token, blocks?.map((b) => b.createdBy) ?? []);

  const load = useCallback(async () => {
    try {
      setBlocks((await listBlocks(session.token, id!)).items);
    } catch (caught) {
      setLoadError(caught);
    }
  }, [session.token, id]);

  useEffect(() => {
    getVenue(session.token, id!).then(setVenue).catch(setLoadError);
    void load();
  }, [session.token, id, load]);

  const set = (field: Field) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function review() {
    const checked = check(form);
    if ("errors" in checked) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setActionError(null);
    setBusy(true);
    try {
      const { items } = await reviewBlock(session.token, id!, checked.input.startsAt, checked.input.endsAt);
      setReviewing({ input: checked.input, disrupted: items });
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRecord() {
    if (!reviewing) return;
    setBusy(true);
    setActionError(null);
    try {
      const { disrupted } = await recordBlock(session.token, id!, reviewing.input);
      setNotice(`Unavailability recorded.${flaggedSentence(disrupted)}`);
      setReviewing(null);
      setForm(EMPTY);
      await load();
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    setActionError(null);
    try {
      await removeBlock(session.token, id!, removing.id);
      setNotice("Unavailability removed.");
      setRemoving(null);
      await load();
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <Refusal error={loadError} />;
  if (!blocks) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ marginBottom: 4 }}>Unavailability</h2>
      <p style={{ marginTop: 0, color: "#626F86" }}>
        {venue?.name ?? ""} · Periods when the venue can't be used, even if booked. Times are Singapore time.
      </p>

      {notice && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="success">
            <p style={{ margin: 0 }}>{notice}</p>
          </SectionMessage>
        </div>
      )}
      {!reviewing && !removing && actionError ? (
        <div style={{ marginBottom: 16 }}>
          <Refusal error={actionError} />
        </div>
      ) : null}

      <section aria-label="Record unavailability" style={{ border: "1px solid #DFE1E6", borderRadius: 4, padding: 16, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Record unavailability</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Labelled id="block-start-date" label="Start date" error={errors.startsAt}>
            <input id="block-start-date" type="date" value={form.startDate} onChange={(e) => set("startDate")(e.currentTarget.value)} style={input} />
          </Labelled>
          <Labelled id="block-start-time" label="Start time">
            <input id="block-start-time" type="time" value={form.startTime} onChange={(e) => set("startTime")(e.currentTarget.value)} style={input} />
          </Labelled>
          <Labelled id="block-end-date" label="End date" error={errors.endsAt}>
            <input id="block-end-date" type="date" value={form.endDate} onChange={(e) => set("endDate")(e.currentTarget.value)} style={input} />
          </Labelled>
          <Labelled id="block-end-time" label="End time">
            <input id="block-end-time" type="time" value={form.endTime} onChange={(e) => set("endTime")(e.currentTarget.value)} style={input} />
          </Labelled>
          <p style={{ flexBasis: "100%", margin: "-8px 0 0", fontSize: 12, color: "#626F86" }}>
            Leave both end fields empty for a block with no end: it lasts until you remove it.
          </p>
          <Labelled id="block-reason" label="Reason type" error={errors.reasonType}>
            <select id="block-reason" value={form.reasonType} onChange={(e) => set("reasonType")(e.currentTarget.value)} style={input}>
              <option value="">Choose…</option>
              {REASON_TYPES.map((type) => (
                <option key={type} value={type}>
                  {UNAVAILABILITY_LABELS[type]}
                </option>
              ))}
            </select>
          </Labelled>
        </div>
        <Labelled id="block-description" label="Description" error={errors.description}>
          <textarea
            id="block-description"
            rows={2}
            value={form.description}
            onChange={(e) => set("description")(e.currentTarget.value)}
            style={{ ...input, width: "100%", boxSizing: "border-box" }}
          />
        </Labelled>
        <div style={{ marginTop: 12 }}>
          <Button appearance="primary" isDisabled={busy} onClick={() => void review()}>
            Review
          </Button>
        </div>
      </section>

      <h3>Recorded</h3>
      {blocks.length === 0 ? (
        <p>No unavailability is recorded for this venue.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Period", "Reason", "Description", "Recorded", ""].map((heading, i) => (
                <th key={i} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id} aria-label={`${formatPeriod(b.startsAt, b.endsAt)} ${UNAVAILABILITY_LABELS[b.reasonType]} ${b.description}`}>
                <td style={cell}>{formatPeriod(b.startsAt, b.endsAt)}</td>
                <td style={cell}>{UNAVAILABILITY_LABELS[b.reasonType]}</td>
                <td style={cell}>{b.description}</td>
                <td style={cell}>
                  {nameOf(b.createdBy) ?? b.createdBy}
                  <div style={{ fontSize: 12, color: "#626F86" }}>{formatInstant(b.createdAt)}</div>
                </td>
                <td style={cell}>
                  <Button
                    appearance="subtle"
                    onClick={() => {
                      setActionError(null);
                      setRemoving(b);
                    }}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ModalTransition>
        {reviewing && (
          <Modal onClose={() => setReviewing(null)}>
            <ModalHeader>
              <ModalTitle>Record this unavailability?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                {venue?.name}: {formatPeriod(reviewing.input.startsAt, reviewing.input.endsAt)},{" "}
                {UNAVAILABILITY_LABELS[reviewing.input.reasonType]}: {reviewing.input.description}
              </p>
              {reviewing.disrupted.length === 0 ? (
                <p>Nothing is booked, held or requested in this period.</p>
              ) : (
                <>
                  <p>
                    It will disrupt these. Each stays booked but will require reconfirmation, and its coordinator will be told
                    that alternative arrangements are required.
                  </p>
                  <ul aria-label="Disrupted">
                    {reviewing.disrupted.map((d) => (
                      <li key={`${d.kind}-${d.reference}`}>{describe(d)}</li>
                    ))}
                  </ul>
                </>
              )}
              <Refusal error={actionError} />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setReviewing(null)}>
                Cancel
              </Button>
              <Button appearance="primary" isDisabled={busy} onClick={() => void confirmRecord()}>
                Record unavailability
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {removing && (
          <Modal onClose={() => setRemoving(null)}>
            <ModalHeader>
              <ModalTitle>Remove this unavailability?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                {formatPeriod(removing.startsAt, removing.endsAt)}, {UNAVAILABILITY_LABELS[removing.reasonType]}: {removing.description}.
                The period becomes available again, and anything it alone disrupted no longer requires reconfirmation. Coordinators
                will be told. The record is kept.
              </p>
              <Refusal error={actionError} />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button appearance="warning" isDisabled={busy} onClick={() => void confirmRemove()}>
                Remove unavailability
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
}

function Labelled(props: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label htmlFor={props.id} style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {props.label}
      </label>
      {props.children}
      {props.error && <div style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>{props.error}</div>}
    </div>
  );
}

const cell = { textAlign: "left" as const, padding: "6px 12px 6px 0", borderBottom: "1px solid #DFE1E6", verticalAlign: "top" as const };
const input = { padding: "6px 8px", border: "1px solid #8590A2", borderRadius: 3, font: "inherit" };
