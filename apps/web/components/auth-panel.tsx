"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Surface } from "@opendesign/ui";

type AuthPanelProps = {
  session: {
    session: {
      id: string;
    };
    user: {
      id: string;
      email?: string;
      name?: string | null;
    };
  } | null;
};

type Mode = "sign-in" | "sign-up";

function readErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const value = payload.message;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  if (payload && typeof payload === "object" && "error" in payload) {
    const value = payload.error;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
}

export function AuthPanel({ session }: AuthPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const apiOrigin = useMemo(
    () => process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000",
    []
  );

  async function runAuth(path: string, payload?: Record<string, string>) {
    const response = await fetch(`${apiOrigin}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: payload ? JSON.stringify(payload) : undefined
    });

    if (!response.ok) {
      let parsed: unknown = null;

      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }

      throw new Error(readErrorMessage(parsed, "Authentication request failed."));
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        setError(null);
        await runAuth(
          mode === "sign-up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email",
          mode === "sign-up" ? { email, password, name } : { email, password }
        );
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Authentication failed."
        );
      }
    });
  }

  function handleSignOut() {
    startTransition(async () => {
      try {
        setError(null);
        await runAuth("/api/auth/sign-out");
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Sign out failed.");
      }
    });
  }

  return (
    <Surface className="auth-panel">
      <div className="auth-head">
        <Badge tone={session ? "accent" : "outline"}>
          {session ? "Session Active" : "Sign In"}
        </Badge>
        {session ? (
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={pending}>
            Sign Out
          </Button>
        ) : null}
      </div>

      {session ? (
        <div className="auth-summary">
          <strong>{session.user.name || session.user.email || "Authenticated user"}</strong>
          <span>{session.user.email ?? "Ready to scope projects to your account."}</span>
        </div>
      ) : (
        <>
          <div className="auth-toggle">
            <Button
              variant={mode === "sign-in" ? "primary" : "outline"}
              size="sm"
              onClick={() => setMode("sign-in")}
              disabled={pending}
            >
              Sign In
            </Button>
            <Button
              variant={mode === "sign-up" ? "primary" : "outline"}
              size="sm"
              onClick={() => setMode("sign-up")}
              disabled={pending}
            >
              Create Account
            </Button>
          </div>

          <div className="auth-fields">
            {mode === "sign-up" ? (
              <label className="field">
                <span>Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>

          <Button variant="primary" onClick={handleSubmit} disabled={pending}>
            {pending ? "Working..." : mode === "sign-up" ? "Create Account" : "Sign In"}
          </Button>
          <div className="footer-note">
            Use the same browser host for web and API, for example `127.0.0.1` on both
            ports.
          </div>
        </>
      )}

      {error ? <div className="auth-error">{error}</div> : null}
    </Surface>
  );
}
