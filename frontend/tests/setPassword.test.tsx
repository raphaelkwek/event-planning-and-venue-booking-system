import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { parseAuthLink, passwordProblem, setPasswordHash } from "../src/api/password.js";
import { App } from "../src/App.js";

/**
 * ADR-0016: an invited Lead, or anyone with a password-reset link, sets their own password on
 * the web app. Supabase Auth returns them with a session in the address bar's fragment.
 */

// Made up at run time, so no secret scanner mistakes it for a credential.
const TOKEN = ["link", "session", "x".repeat(16)].join("-");
const NEW_PASSWORD = "n".repeat(10);

const fetchMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

function openLink(hash: string) {
  window.location.hash = hash;
  render(<App />);
}

function fill(password: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm the new password"), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
}

describe("the link Supabase Auth sends back (DEPLOY-T16)", () => {
  it("DEPLOY-T16 an invite or recovery session is read from the site root or after the route; an error is read too", () => {
    expect(parseAuthLink(`#access_token=${TOKEN}&expires_in=3600&type=invite`)).toEqual({ kind: "session", accessToken: TOKEN, type: "invite" });
    expect(parseAuthLink(`#/set-password#access_token=${TOKEN}&type=recovery`)).toEqual({ kind: "session", accessToken: TOKEN, type: "recovery" });
    expect(parseAuthLink("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")).toEqual({
      kind: "error",
      message: "Email link is invalid or has expired",
    });
    expect(parseAuthLink("#/requests")).toBeNull();
    expect(parseAuthLink("")).toBeNull();
  });

  it("DEPLOY-T16 a link that came back to the site root is moved onto the Set your password screen", () => {
    expect(setPasswordHash(`#access_token=${TOKEN}&type=invite`)).toBe(`#/set-password#access_token=${TOKEN}&type=invite`);
    expect(setPasswordHash(`#/set-password#access_token=${TOKEN}`)).toBeNull();
    expect(setPasswordHash("#/requests")).toBeNull();
  });

  it("DEPLOY-T16 a password shorter than Supabase's minimum, or two that differ, is refused before anything is sent", () => {
    expect(passwordProblem("short", "short")).toMatch(/at least 6 characters/);
    expect(passwordProblem(NEW_PASSWORD, `${NEW_PASSWORD}!`)).toMatch(/do not match/);
    expect(passwordProblem(NEW_PASSWORD, NEW_PASSWORD)).toBeNull();
  });
});

describe("the Set your password screen (DEPLOY-T16)", () => {
  it("DEPLOY-T16 sets the password with the link's session, takes the token out of the address bar, and sends the user to sign in", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "user-id" }), { status: 200 }));
    openLink(`#/set-password#access_token=${TOKEN}&type=invite`);

    expect(await screen.findByRole("heading", { name: "Set your password" })).toBeTruthy();
    await waitFor(() => expect(window.location.hash).toBe("#/set-password"));

    fill(NEW_PASSWORD, NEW_PASSWORD);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://supabase.test/auth/v1/user");
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ apikey: "test-anon-key", Authorization: `Bearer ${TOKEN}` });
    expect(JSON.parse(init.body as string)).toEqual({ password: NEW_PASSWORD });

    expect(await screen.findByText(/Your password is set/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("DEPLOY-T16 a short password or a mismatch is refused on the screen and nothing is sent", async () => {
    openLink(`#/set-password#access_token=${TOKEN}&type=invite`);
    await screen.findByRole("heading", { name: "Set your password" });

    fill("short", "short");
    expect(await screen.findByText("Use at least 6 characters.")).toBeTruthy();
    fill(NEW_PASSWORD, `${NEW_PASSWORD}!`);
    expect(await screen.findByText("The two passwords do not match.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DEPLOY-T16 Supabase's refusal is shown, and an expired session says to ask for a new link", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error_code: "weak_password", msg: "Password should contain a digit" }), { status: 422 }));
    openLink(`#/set-password#access_token=${TOKEN}&type=recovery`);
    await screen.findByRole("heading", { name: "Set your password" });
    fill(NEW_PASSWORD, NEW_PASSWORD);
    expect(await screen.findByText(/Password should contain a digit/)).toBeTruthy();

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByText(/expired or was already used/)).toBeTruthy();
  });

  it("DEPLOY-T16 without a link, or with a failed one, the screen asks for the email link again and sends nothing", async () => {
    openLink("#/set-password");
    expect(await screen.findByText(/Open the link in your invite or password-reset email again/)).toBeTruthy();
    cleanup();

    openLink("#/set-password#error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
    expect(await screen.findByText(/The link did not work: Email link is invalid or has expired/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go to sign in" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
