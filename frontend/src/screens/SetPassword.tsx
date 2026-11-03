import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { MIN_PASSWORD_LENGTH, SET_PASSWORD_PATH, parseAuthLink, passwordProblem, setPassword } from "../api/password.js";
import { Refusal } from "../components/Refusal.js";

/**
 * ADR-0016: where an invite or password-reset link from Supabase Auth lands. It reads the link's
 * session from the address bar, takes it out of the address bar at once (so it is not left in
 * history or a screenshot), sets the password the user chooses, and sends them to sign in.
 */
export function SetPassword() {
  const navigate = useNavigate();
  const [link] = useState(() => parseAuthLink(window.location.hash));
  const [password, setPasswordValue] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (link) window.history.replaceState(null, "", `#${SET_PASSWORD_PATH}`);
  }, [link]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (link?.kind !== "session") return;
    setError(null);
    const found = passwordProblem(password, confirmation);
    setProblem(found);
    if (found) return;
    setBusy(true);
    try {
      await setPassword(link.accessToken, password);
      navigate("/", { replace: true, state: { notice: "Your password is set. Sign in with your email and the new password." } });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 4 }}>Set your password</h1>

      {link?.kind === "session" ? (
        <>
          <p style={{ marginTop: 0, color: "#626F86" }}>
            Choose the password you will sign in to ConnectSphere with. It needs at least {MIN_PASSWORD_LENGTH} characters.
          </p>
          <form onSubmit={onSubmit} noValidate>
            <label htmlFor="new-password">New password</label>
            <Textfield
              id="new-password"
              name="new-password"
              type="password"
              value={password}
              onChange={(e) => setPasswordValue((e.target as HTMLInputElement).value)}
              autoComplete="new-password"
            />

            <div style={{ height: 12 }} />

            <label htmlFor="confirm-password">Confirm the new password</label>
            <Textfield
              id="confirm-password"
              name="confirm-password"
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation((e.target as HTMLInputElement).value)}
              autoComplete="new-password"
            />

            <div style={{ height: 16 }} />
            <Button type="submit" appearance="primary" isDisabled={busy}>
              {busy ? "Setting password…" : "Set password"}
            </Button>
          </form>

          {problem ? (
            <div style={{ marginTop: 16 }}>
              <SectionMessage appearance="warning">
                <p style={{ margin: 0 }}>{problem}</p>
              </SectionMessage>
            </div>
          ) : null}
          <div style={{ marginTop: 16 }}>
            <Refusal error={error} />
          </div>
        </>
      ) : (
        <div style={{ marginTop: 16 }}>
          <SectionMessage appearance="warning" title="This page needs the link from your email">
            <p style={{ marginTop: 0 }}>
              {link?.kind === "error"
                ? `The link did not work: ${link.message}. Ask for a new invite or password reset.`
                : "Open the link in your invite or password-reset email again. If it has expired, ask for a new one."}
            </p>
            <Button appearance="subtle" onClick={() => navigate("/", { replace: true })}>
              Go to sign in
            </Button>
          </SectionMessage>
        </div>
      )}
    </div>
  );
}
