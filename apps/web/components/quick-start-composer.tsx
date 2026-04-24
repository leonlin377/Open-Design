"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Chip, Inline, Stack, Text } from "@opendesign/ui";
import Link from "next/link";
import { useT, type Dictionary } from "../lib/i18n";
import { quickStartAction } from "../app/projects/actions";

type ArtifactKind = "website" | "prototype" | "slides";

const KIND_KEYWORDS: Record<ArtifactKind, RegExp> = {
  slides: /slide|deck|presentation|pitch|幻灯片|演示|汇报/i,
  prototype: /flow|prototype|screen|app|onboard|原型|流程|界面/i,
  website: /website|landing|page|marketing|hero|网站|落地页|主页/i,
};

function detectKind(prompt: string): ArtifactKind | null {
  for (const [kind, pattern] of Object.entries(KIND_KEYWORDS)) {
    if (pattern.test(prompt)) {
      return kind as ArtifactKind;
    }
  }
  return null;
}

const SUGGESTED_PROMPT_KEYS: Record<ArtifactKind, [string, string]> = {
  website: ["quickstart.prompt.website.1", "quickstart.prompt.website.2"] as const,
  prototype: ["quickstart.prompt.prototype.1", "quickstart.prompt.prototype.2"] as const,
  slides: ["quickstart.prompt.slides.1", "quickstart.prompt.slides.2"] as const,
};

export function QuickStartComposer() {
  const t = useT();
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<ArtifactKind>("website");
  const [pending, startTransition] = useTransition();
  const manualOverrideRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (manualOverrideRef.current || !prompt) return;
    const detected = detectKind(prompt);
    if (detected) setKind(detected);
  }, [prompt]);

  function handleKindClick(selected: ArtifactKind) {
    manualOverrideRef.current = true;
    setKind(selected);
  }

  function handleSuggestClick(text: string) {
    setPrompt(text);
    manualOverrideRef.current = false;
    const detected = detectKind(text);
    if (detected) setKind(detected);
    textareaRef.current?.focus();
  }

  function handleSubmit() {
    if (!prompt.trim() || pending) return;
    const formData = new FormData();
    formData.set("prompt", prompt.trim());
    formData.set("kind", kind);
    startTransition(() => quickStartAction(formData));
  }

  const kindOptions: ArtifactKind[] = ["website", "prototype", "slides"];
  const kindKeys: Record<ArtifactKind, string> = {
    website: "quickstart.type.website",
    prototype: "quickstart.type.prototype",
    slides: "quickstart.type.slides",
  };

  const suggestedKeys = SUGGESTED_PROMPT_KEYS[kind];

  return (
    <div className="quick-start-composer">
      <Stack gap={4}>
        <textarea
          ref={textareaRef}
          className="quick-start-textarea"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("quickstart.placeholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={pending}
        />

        <Inline gap={2} wrap align="center">
          {kindOptions.map((k) => (
            <Chip
              key={k}
              tone={kind === k ? "accent" : "outline"}
              onClick={() => handleKindClick(k)}
              className="quick-start-kind-chip"
              role="radio"
              aria-checked={kind === k}
            >
              {t(kindKeys[k] as keyof Dictionary)}
            </Chip>
          ))}
        </Inline>

        <div className="quick-start-suggested">
          <Text variant="body-s" tone="muted" className="quick-start-suggested-label">
            {t("quickstart.suggested.title")}
          </Text>
          <Inline gap={2} wrap>
            {suggestedKeys.map((key) => {
              const text = t(key as keyof Dictionary);
              return (
                <button
                  key={key}
                  type="button"
                  className="quick-start-suggestion"
                  onClick={() => handleSuggestClick(text)}
                  disabled={pending}
                >
                  {text}
                </button>
              );
            })}
          </Inline>
        </div>

        <Inline gap={3} align="center" wrap>
          <Button
            variant="primary"
            size="lg"
            type="button"
            onClick={handleSubmit}
            disabled={pending || !prompt.trim()}
          >
            {pending
              ? t("quickstart.button.generating")
              : t("quickstart.button.generate")}
          </Button>
          <Link href="/projects" className="button-link ghost">
            {t("quickstart.button.browse")}
          </Link>
        </Inline>
      </Stack>
    </div>
  );
}
