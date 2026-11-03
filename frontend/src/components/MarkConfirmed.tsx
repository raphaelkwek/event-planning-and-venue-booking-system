import { useState } from "react";
import Button from "@atlaskit/button/new";
import { markConfirmed } from "../api/safetyReviews.js";
import { Refusal } from "./Refusal.js";

/**
 * U1 — "Mark Confirmed" for the event's assigned coordinator while it is in Safety Review. The
 * server allows it only once the Safety Officer has approved the review; until then it refuses, and
 * the refusal stays beside the button with the server's own message (§7.1).
 */
export function MarkConfirmedAction({ eventId, token, onConfirmed }: { eventId: string; token: string; onConfirmed: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      await markConfirmed(token, eventId);
      onConfirmed();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 13 }}>
        The Safety Officer must approve the safety arrangements before you can mark this event Confirmed.
      </p>
      <Button appearance="primary" isDisabled={busy} onClick={() => void confirm()}>
        Mark Confirmed
      </Button>
      <Refusal error={error} />
    </div>
  );
}
