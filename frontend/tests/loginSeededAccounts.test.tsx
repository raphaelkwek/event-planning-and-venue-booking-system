import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Login } from "../src/screens/Login.js";

vi.mock("../src/auth/SessionContext.js", () => ({ useSession: () => ({ signIn: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("the seeded-accounts panel", () => {
  it("LOGIN-T1 in development it lists the accounts, lead and safety included, and prefills the fields", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SHOW_SEEDED_ACCOUNTS", "");
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByText("Seeded accounts")).toBeTruthy();
    expect(screen.getByText("lead@connectsphere.test")).toBeTruthy();
    expect(screen.getByText("safety@connectsphere.test")).toBeTruthy();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("organiser@connectsphere.test");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("ConnectSphere-Test-1234!");
  });

  it("LOGIN-T2 a build with VITE_SHOW_SEEDED_ACCOUNTS=true shows the panel", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_SHOW_SEEDED_ACCOUNTS", "true");
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByText("Seeded accounts")).toBeTruthy();
  });

  it("LOGIN-T3 a production build shows no panel and empty fields", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_SHOW_SEEDED_ACCOUNTS", "false");
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Seeded accounts")).toBeNull();
    expect(screen.queryByText("lead@connectsphere.test")).toBeNull();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });
});
