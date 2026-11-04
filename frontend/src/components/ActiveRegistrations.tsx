import { useEffect, useState } from "react";
import { ApiError } from "../api/client.js";
import { listEventRegistrations } from "../api/registration.js";

type Count = { status: "loading" } | { status: "known"; registered: number } | { status: "unavailable" };

/**
 * D1 (G2 AC2, S3 AC1) — the number of attendees registered for the event. Planning-core cannot count
 * them (the registration service owns that data), so this asks the registration service. A service
 * that does not know the event holds no registrations for it (0); any other failure is said plainly,
 * never shown as a 0 the coordinator might act on.
 */
export function ActiveRegistrations({ token, eventId }: { token: string; eventId: string }) {
  const [count, setCount] = useState<Count>({ status: "loading" });

  useEffect(() => {
    let current = true;
    setCount({ status: "loading" });
    listEventRegistrations(token, eventId).then(
      (page) => {
        const registered = page?.totals?.registered;
        if (current) setCount(typeof registered === "number" ? { status: "known", registered } : { status: "unavailable" });
      },
      (caught) => {
        if (!current) return;
        setCount(caught instanceof ApiError && caught.status === 404 ? { status: "known", registered: 0 } : { status: "unavailable" });
      }
    );
    return () => {
      current = false;
    };
  }, [token, eventId]);

  if (count.status === "loading") return <p role="status">Registrations: checking…</p>;
  if (count.status === "unavailable") {
    return (
      <p role="status">
        Registrations: couldn't be loaded from the registration service. Check the event's registrations before deciding.
      </p>
    );
  }
  return <p>Registrations: {count.registered}</p>;
}
