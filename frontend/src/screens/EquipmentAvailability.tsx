import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "@atlaskit/button/new";
import Textfield from "@atlaskit/textfield";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError, type ApiErrorField } from "../api/client.js";
import { getEquipmentAvailability, listEquipmentTypes, type EquipmentAvailability as Availability, type EquipmentType } from "../api/equipmentAvailability.js";
import { Refusal } from "../components/Refusal.js";

/** P1 is a read-only check: the server owns the availability calculation. */
export function EquipmentAvailability() {
  const session = useSignedIn();
  const [items, setItems] = useState<EquipmentType[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState({ equipmentTypeId: "", requestedQuantity: "0", startsAt: "", endsAt: "" });
  const [result, setResult] = useState<Availability | null>(null);
  const [error, setError] = useState<unknown>(null);
  // Changing the form invalidates every in-flight answer, including refusals.
  const version = useRef(0);

  useEffect(() => {
    let current = true;
    listEquipmentTypes(session.token)
      .then((page) => { if (current) setItems(page.items); })
      .catch((cause: unknown) => { if (current) setError(cause); })
      .finally(() => { if (current) setCatalogueLoading(false); });
    return () => { current = false; version.current += 1; };
  }, [session.token]);

  function edit(field: keyof typeof form, value: string) {
    version.current += 1;
    setForm((previous) => ({ ...previous, [field]: value }));
    setResult(null);
    setError(null);
    setChecking(false);
  }

  async function check(event: FormEvent) {
    event.preventDefault();
    const requestVersion = ++version.current;
    setResult(null);
    setError(null);
    const fields: ApiErrorField[] = [];
    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    const requestedQuantity = Number(form.requestedQuantity);
    if (!form.equipmentTypeId) fields.push({ field: "equipmentTypeId", message: "Select an equipment type." });
    if (!form.requestedQuantity.trim() || !Number.isSafeInteger(requestedQuantity) || requestedQuantity < 0) fields.push({ field: "requestedQuantity", message: "Requested quantity must be a whole number of zero or more." });
    if (!Number.isFinite(startsAt.getTime())) fields.push({ field: "startsAt", message: "Enter a start date and time." });
    if (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) fields.push({ field: "endsAt", message: "End must be after start." });
    if (fields.length) {
      setError(new ApiError(400, { code: "VALIDATION_FAILED", message: "Check the highlighted fields.", fields, correlationId: null }));
      return;
    }
    setChecking(true);
    try {
      const answer = await getEquipmentAvailability(session.token, form.equipmentTypeId, {
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), requestedQuantity,
      });
      if (version.current === requestVersion) setResult(answer);
    } catch (cause) {
      if (version.current === requestVersion) setError(cause);
    } finally {
      if (version.current === requestVersion) setChecking(false);
    }
  }

  const fieldError = (field: string) => error instanceof ApiError ? error.fieldMessage(field) : undefined;
  return (
    <div style={{ maxWidth: 720 }}>
      <h2>Equipment availability</h2>
      <p>Check equipment for a time window. Checking availability creates no reservation.</p>
      <Refusal error={error} />
      {catalogueLoading ? <p>Loading equipment types…</p> : !items.length && !error ? <p>No equipment types are recorded yet.</p> : null}
      <form onSubmit={(event) => void check(event)} noValidate>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="equipmentTypeId">Equipment type</label>
          <select id="equipmentTypeId" value={form.equipmentTypeId} onChange={(event) => edit("equipmentTypeId", event.target.value)} disabled={catalogueLoading || !items.length} aria-invalid={Boolean(fieldError("equipmentTypeId"))} aria-describedby={fieldError("equipmentTypeId") ? "equipmentTypeId-error" : undefined} style={{ display: "block", width: "100%", padding: 8 }}>
            <option value="">Select an equipment type</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {fieldError("equipmentTypeId") && <p id="equipmentTypeId-error">{fieldError("equipmentTypeId")}</p>}
        </div>
        {([
          ["requestedQuantity", "Requested quantity", "number"],
          ["startsAt", "Starts at (local time)", "datetime-local"],
          ["endsAt", "Ends at (local time)", "datetime-local"],
        ] as const).map(([field, label, type]) => (
          <div key={field} style={{ marginBottom: 16 }}>
            <label htmlFor={field}>{label}</label>
            <Textfield id={field} type={type} value={form[field]} onChange={(event) => edit(field, event.currentTarget.value)} min={type === "number" ? 0 : undefined} step={type === "number" ? 1 : undefined} isInvalid={Boolean(fieldError(field))} aria-invalid={Boolean(fieldError(field))} aria-describedby={fieldError(field) ? `${field}-error` : undefined} />
            {fieldError(field) && <p id={`${field}-error`}>{fieldError(field)}</p>}
          </div>
        ))}
        <Button appearance="primary" type="submit" isDisabled={checking || catalogueLoading || !items.length}>{checking ? "Checking…" : "Check availability"}</Button>
      </form>
      {result && <section aria-label="Availability result" aria-live="polite" style={{ marginTop: 24 }}>
        <h3>Availability result</h3>
        <p>Available quantity: {result.availableQuantity}</p>
        <p>Shortfall quantity: {result.shortfallQuantity}</p>
      </section>}
    </div>
  );
}
