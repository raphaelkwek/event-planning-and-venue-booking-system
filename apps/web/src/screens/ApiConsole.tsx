import { useState } from "react";
import Button from "@atlaskit/button/new";
import Textfield from "@atlaskit/textfield";
import TextArea from "@atlaskit/textarea";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import { rawRequest, type RawResponse } from "../api/client.js";

/**
 * A2 and A3 cannot be demonstrated by clicking around: A2 requires that the
 * refusal applies to a direct API call and not only to a hidden menu item, and
 * A3 requires that an out-of-scope request returns no event data at all rather
 * than an empty list. This fires requests directly, with the signed-in user's
 * own token.
 */
const PRESETS = [
  {
    label: "Approve without being a coordinator",
    method: "POST",
    path: "/event/api/v1/events/PASTE-EVENT-ID/approve",
    body: "",
    withoutToken: false,
    note: "Sign in as the organiser. The server refuses with ROLE_NOT_AUTHORISED even though the button was never shown.",
  },
  {
    label: "Read another organiser's event",
    method: "GET",
    path: "/event/api/v1/events/PASTE-EVENT-ID",
    body: "",
    withoutToken: false,
    note: "Sign in as an organiser who does not own it. Expect 404 with no event data — not an empty 200.",
  },
  {
    label: "Request without signing in",
    method: "GET",
    path: "/event/api/v1/events/queue",
    body: "",
    withoutToken: true,
    note: "Sent with no token. Expect 401 and no event, venue, equipment or registration data.",
  },
  {
    label: "My access scope",
    method: "GET",
    path: "/identity/api/v1/access-scope/events",
    body: "",
    withoutToken: false,
    note: "The rule Identity hands the Event Service for the signed-in role.",
  },
  {
    label: "Who am I",
    method: "GET",
    path: "/identity/api/v1/users/me",
    body: "",
    withoutToken: false,
    note: "The caller's internal user id and role.",
  },
];

export function ApiConsole() {
  const session = useSignedIn();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/event/api/v1/events");
  const [body, setBody] = useState("");
  const [withoutToken, setWithoutToken] = useState(false);
  const [result, setResult] = useState<RawResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      let parsedBody: unknown;
      if (body.trim().length > 0) {
        parsedBody = JSON.parse(body);
      }
      setResult(
        await rawRequest(path, {
          method,
          token: withoutToken ? null : session.token,
          body: parsedBody,
        })
      );
    } catch (error) {
      setResult({
        status: 0,
        body: { error: (error as Error).message },
        correlationId: null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h2>Direct API console</h2>
      <p style={{ color: "#626F86", marginTop: 0 }}>
        Signed in as <strong>{session.email}</strong> ({session.role}). Requests carry this user's
        real token unless you say otherwise.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            onClick={() => {
              setMethod(preset.method);
              setPath(preset.path);
              setBody(preset.body);
              setWithoutToken(preset.withoutToken);
              setNote(preset.note);
              setResult(null);
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {note && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="information">
            <p style={{ margin: 0 }}>{note}</p>
          </SectionMessage>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ width: 110 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Method</label>
          <Textfield value={method} onChange={(e) => setMethod((e.target as HTMLInputElement).value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Path</label>
          <Textfield value={path} onChange={(e) => setPath((e.target as HTMLInputElement).value)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Body (JSON, optional)</label>
        <TextArea
          value={body}
          minimumRows={3}
          onChange={(e) => setBody((e.target as HTMLTextAreaElement).value)}
        />
      </div>

      <label style={{ display: "block", margin: "12px 0" }}>
        <input
          type="checkbox"
          checked={withoutToken}
          onChange={(e) => setWithoutToken(e.target.checked)}
        />{" "}
        Send without a token
      </label>

      <Button appearance="primary" onClick={send} isDisabled={busy}>
        {busy ? "Sending…" : "Send"}
      </Button>

      {result && (
        <div style={{ marginTop: 24 }}>
          <h3>
            {result.status}{" "}
            <span style={{ fontSize: 12, fontWeight: 400, color: "#626F86" }}>
              {result.correlationId ? `correlation ${result.correlationId}` : ""}
            </span>
          </h3>
          <pre
            style={{
              background: "#F7F8F9",
              border: "1px solid #DFE1E6",
              borderRadius: 4,
              padding: 12,
              overflowX: "auto",
              fontSize: 12,
            }}
          >
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
