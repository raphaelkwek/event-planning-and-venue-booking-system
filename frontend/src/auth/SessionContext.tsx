import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { logIn, logOut, recallSession, rememberSession, type Session } from "../api/session.js";

interface SessionValue {
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => recallSession());

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await logIn(email, password);
    rememberSession(next);
    setSession(next);
  }, []);

  /**
   * A1 — logging out ends the session. The stored session goes first, so that
   * nothing is left to render event data with even if revoking the token at
   * Supabase fails.
   */
  const signOut = useCallback(async () => {
    const token = session?.token;
    rememberSession(null);
    setSession(null);
    if (token) {
      await logOut(token).catch(() => undefined);
    }
  }, [session]);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside a SessionProvider");
  return value;
}

/** The session, for screens that are only reachable when signed in. */
export function useSignedIn(): Session {
  const { session } = useSession();
  if (!session) throw new Error("This screen requires a signed-in user");
  return session;
}
