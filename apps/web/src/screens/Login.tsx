import { useState, type FormEvent } from "react";
import Button from "@atlaskit/button/new";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { useSession } from "../auth/SessionContext.js";
import { Refusal } from "../components/Refusal.js";

/** The seeded accounts, so roles can be switched quickly while testing. */
const SEEDED = [
  { email: "organiser@connectsphere.test", role: "Event Organiser" },
  { email: "coordinator@connectsphere.test", role: "Event Coordinator" },
  { email: "venuestaff@connectsphere.test", role: "Venue Staff" },
  { email: "techsupport@connectsphere.test", role: "Technical Support" },
  { email: "attendee@connectsphere.test", role: "Attendee" },
  { email: "deactivated@connectsphere.test", role: "Deactivated (A1)" },
];

const SEED_PASSWORD = "ConnectSphere-Test-1234!";

export function Login() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("organiser@connectsphere.test");
  const [password, setPassword] = useState(SEED_PASSWORD);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 4 }}>ConnectSphere</h1>
      <p style={{ marginTop: 0, color: "#626F86" }}>Sign in to continue (A1).</p>

      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <Textfield
          id="email"
          name="email"
          value={email}
          onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
          autoComplete="username"
        />

        <div style={{ height: 12 }} />

        <label htmlFor="password">Password</label>
        <Textfield
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
          autoComplete="current-password"
        />

        <div style={{ height: 16 }} />
        <Button type="submit" appearance="primary" isDisabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div style={{ marginTop: 16 }}>
        <Refusal error={error} />
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionMessage title="Seeded accounts" appearance="information">
          <p style={{ marginTop: 0 }}>
            All use the password <code>{SEED_PASSWORD}</code>.
          </p>
          <ul>
            {SEEDED.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(SEED_PASSWORD);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#0C66E4",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {account.email}
                </button>{" "}
                — {account.role}
              </li>
            ))}
          </ul>
          <p style={{ marginBottom: 0 }}>
            Try a wrong password, and then the deactivated account: A1 requires the first to be
            indistinguishable between a wrong email and a wrong password, and the second to be
            distinguishable from both.
          </p>
        </SectionMessage>
      </div>
    </div>
  );
}
