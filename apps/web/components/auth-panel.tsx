"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  FormField,
  Inline,
  Input,
  Stack,
  Surface,
  Tabs,
  TabsList,
  TabsTrigger,
  Text
} from "@opendesign/ui";
import { useT } from "../lib/i18n";
import { buildApiRequestError } from "../lib/api-errors";

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

export function AuthPanel({ session }: AuthPanelProps) {
  const router = useRouter();
  const t = useT();
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
      throw await buildApiRequestError(response, "Authentication request failed.");
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
          submitError instanceof Error
            ? submitError.message
            : t("auth.error.failed")
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
        setError(
          submitError instanceof Error
            ? submitError.message
            : t("auth.error.signout")
        );
      }
    });
  }

  return (
    <Surface className="auth-panel">
      <Stack gap={4}>
        <Inline justify="space-between" align="center" className="auth-head">
          <Badge tone={session ? "accent" : "outline"}>
            {session ? t("auth.badge.active") : t("auth.badge.signin")}
          </Badge>
          {session ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={pending}>
              {t("auth.signout")}
            </Button>
          ) : null}
        </Inline>

        {session ? (
          <Stack gap={2} className="auth-summary">
            <Text as="strong" variant="title-s">
              {session.user.name || session.user.email || t("auth.user.authenticated")}
            </Text>
            <Text as="span" variant="body-s" tone="muted">
              {session.user.email ?? t("auth.user.scope")}
            </Text>
          </Stack>
        ) : (
          <Stack gap={3}>
            <Tabs
              value={mode}
              onValueChange={(next) => setMode(next as Mode)}
              className="auth-toggle"
            >
              <TabsList>
                <TabsTrigger value="sign-in" disabled={pending}>
                  {t("auth.toggle.signin")}
                </TabsTrigger>
                <TabsTrigger value="sign-up" disabled={pending}>
                  {t("auth.toggle.signup")}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Stack gap={3} className="auth-fields">
              {mode === "sign-up" ? (
                <FormField label={t("auth.field.name")}>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </FormField>
              ) : null}
              <FormField label={t("auth.field.email")}>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FormField>
              <FormField label={t("auth.field.password")}>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>
            </Stack>

            <Button variant="primary" onClick={handleSubmit} disabled={pending}>
              {pending
                ? `${t("auth.submit.working")}…`
                : mode === "sign-up"
                  ? t("auth.submit.signup")
                  : t("auth.submit.signin")}
            </Button>
            <Text as="div" variant="caption" tone="muted" className="footer-note">
              {t("auth.note")}
            </Text>
          </Stack>
        )}

        {error ? (
          <Alert tone="danger" className="auth-error">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </Surface>
  );
}
