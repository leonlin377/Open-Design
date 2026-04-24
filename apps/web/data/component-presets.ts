import type { ApiArtifact } from "../lib/opendesign-api";

/**
 * Supported artifact kinds for preset targeting. Re-exported from the canonical
 * API type so adding a new artifact kind automatically widens this union.
 */
export type ComponentPresetArtifactKind = ApiArtifact["kind"];

/**
 * Logical grouping for a preset — the "section" of the panel it appears under.
 * Used by the library UI to render grouped accordions or headers.
 */
export type ComponentPresetGroup =
  | "hero"
  | "feature"
  | "pricing"
  | "cta"
  | "flow"
  | "cover"
  | "divider"
  | "content"
  | "closing";

/**
 * A coherent, author-ready scene node seed. `templateKind` matches the
 * generator/append contract (e.g. "hero", "feature-grid", "screen",
 * "slide-title"), while `props` carries a fully fleshed seed — real headlines,
 * not placeholder strings.
 */
export type ComponentPreset = {
  id: string;
  title: string;
  description: string;
  artifactKinds: readonly ComponentPresetArtifactKind[];
  templateKind: string;
  group: ComponentPresetGroup;
  /**
   * Seed props merged into the resulting scene node. Keep this shape aligned
   * with the node kind contracts shipped by @opendesign/contracts — the main
   * thread is expected to translate these into the correct
   * `appendSceneTemplateAction` payload.
   */
  props: Record<string, unknown>;
  /**
   * Short ascii/emoji cue rendered as a thumbnail in the grid. Intentionally
   * string-only so this module stays framework-agnostic.
   */
  thumbnail: string;
};

/**
 * WEBSITE — 9 presets
 * --------------------------------------------------------------------------
 * Covers lead hero variants (cinematic / minimal / split), three feature
 * layouts, a tiered pricing block, and two CTA tones (strong / subtle).
 */
const websitePresets: ComponentPreset[] = [
  {
    id: "hero-cinematic",
    title: "Hero · Cinematic",
    description: "Full-bleed lead with eyebrow, headline, supporting body, and dual CTAs.",
    artifactKinds: ["website"],
    templateKind: "hero",
    group: "hero",
    thumbnail: "[ HERO ]",
    props: {
      template: "hero",
      eyebrow: "Launching this quarter",
      title: "Ship the product your roadmap already promised.",
      headline: "A design platform that keeps strategy, surfaces, and source in lockstep.",
      body: "Go from brief to production-ready artifacts without losing the thread. Every section, flow, and slide stays versioned, reviewable, and exportable.",
      primaryAction: "Start a free workspace",
      secondaryAction: "Watch the 2-minute tour"
    }
  },
  {
    id: "hero-minimal",
    title: "Hero · Minimal",
    description: "Quiet lead section — one-line headline, tight subcopy, single CTA.",
    artifactKinds: ["website"],
    templateKind: "hero",
    group: "hero",
    thumbnail: "[ hero ]",
    props: {
      template: "hero",
      eyebrow: "",
      title: "Design systems, without the sprawl.",
      headline: "Design systems, without the sprawl.",
      body: "One canvas for brand, product, and docs. No bolt-on plugins required.",
      primaryAction: "Get started",
      secondaryAction: ""
    }
  },
  {
    id: "hero-split",
    title: "Hero · Split",
    description: "Copy on the left, hero image slot on the right, with primary + secondary actions.",
    artifactKinds: ["website"],
    templateKind: "hero",
    group: "hero",
    thumbnail: "[ HERO | IMG ]",
    props: {
      template: "hero",
      eyebrow: "For product teams",
      title: "Your next release, already in the browser.",
      headline: "Your next release, already in the browser.",
      body: "Design, review, and export the same artifact. No more chasing Figma links into Slack threads.",
      primaryAction: "Open a demo workspace",
      secondaryAction: "Talk to sales",
      imageAlt: "Product screenshot of the Studio canvas"
    }
  },
  {
    id: "feature-grid-3",
    title: "Feature Grid · 3-up",
    description: "Three concise feature cards — ideal for a 'how it works' or pillar section.",
    artifactKinds: ["website"],
    templateKind: "feature-grid",
    group: "feature",
    thumbnail: "[▣ ▣ ▣]",
    props: {
      template: "feature-grid",
      title: "Everything the team needs, in one workspace.",
      items: [
        {
          label: "Design",
          body: "Brand tokens, scenes, and layouts live next to the artifacts that use them."
        },
        {
          label: "Review",
          body: "Every pass leaves a versioned snapshot, with inline comments anchored to nodes."
        },
        {
          label: "Export",
          body: "Ship code, handoff specs, or a static site from the same source of truth."
        }
      ]
    }
  },
  {
    id: "feature-grid-4",
    title: "Feature Grid · 4-up",
    description: "Four-tile grid for a denser capabilities section.",
    artifactKinds: ["website"],
    templateKind: "feature-grid",
    group: "feature",
    thumbnail: "[▣ ▣ / ▣ ▣]",
    props: {
      template: "feature-grid",
      title: "Built for the whole product lifecycle.",
      items: [
        {
          label: "Brief",
          body: "Turn a prompt into a seeded scene that reflects your brand rhythm."
        },
        {
          label: "Compose",
          body: "Drop in sections, screens, or slides from a curated component library."
        },
        {
          label: "Collaborate",
          body: "Comments, versions, and shared presets keep the team aligned."
        },
        {
          label: "Ship",
          body: "Export to static HTML, a codebase, or a presentation — no re-keying."
        }
      ]
    }
  },
  {
    id: "feature-rows",
    title: "Feature Rows",
    description: "Alternating feature rows with a larger headline per feature.",
    artifactKinds: ["website"],
    templateKind: "feature-grid",
    group: "feature",
    thumbnail: "[=== / ===]",
    props: {
      template: "feature-grid",
      title: "Three principles, one coherent platform.",
      items: [
        {
          label: "One source of truth",
          body: "Scenes, assets, and versions share a single graph — no duplicated exports to chase."
        },
        {
          label: "Opinionated, not rigid",
          body: "Starter templates get you to first draft fast; every prop is still editable."
        },
        {
          label: "Exit-ready output",
          body: "Designs leave as clean code, a shareable link, or an investor-ready deck."
        }
      ]
    }
  },
  {
    id: "pricing-tiered",
    title: "Pricing · Tiered",
    description: "Three-tier pricing comparison — starter, team, and enterprise.",
    artifactKinds: ["website"],
    templateKind: "feature-grid",
    group: "pricing",
    thumbnail: "[$ $$ $$$]",
    props: {
      template: "feature-grid",
      title: "Simple pricing, scoped to how your team works.",
      items: [
        {
          label: "Starter · Free",
          body: "One workspace, unlimited solo projects, community support. For founders sketching the first release."
        },
        {
          label: "Team · $24 / seat / mo",
          body: "Shared workspaces, versioned exports, comment threads, and SSO. For teams shipping every week."
        },
        {
          label: "Enterprise · Custom",
          body: "Dedicated tenancy, audit logs, SCIM, and a named design partner. For organisations with procurement."
        }
      ]
    }
  },
  {
    id: "cta-strong",
    title: "CTA · Strong",
    description: "High-intent closing band with primary + secondary action.",
    artifactKinds: ["website"],
    templateKind: "cta",
    group: "cta",
    thumbnail: "[ → CTA ←]",
    props: {
      template: "cta",
      headline: "Your next release is one prompt away.",
      body: "Spin up a workspace, seed it with a brief, and have a reviewable artifact by lunch.",
      primaryAction: "Start building — it's free",
      secondaryAction: "Book a 15-minute walkthrough"
    }
  },
  {
    id: "cta-subtle",
    title: "CTA · Subtle",
    description: "Low-key invitation, one neutral action — good for docs or changelog footers.",
    artifactKinds: ["website"],
    templateKind: "cta",
    group: "cta",
    thumbnail: "[ cta ]",
    props: {
      template: "cta",
      headline: "Want to see it on your own brand?",
      body: "Drop in a logo and a one-line pitch — we'll generate a starter scene in under a minute.",
      primaryAction: "Try the sandbox",
      secondaryAction: ""
    }
  }
];

/**
 * PROTOTYPE — 3 flow presets
 * --------------------------------------------------------------------------
 * Each flow expands to an ordered list of `screen` + `screen-cta` seeds.
 * The main thread is expected to iterate the `flow` array and append nodes in
 * order, using `templateKind` per step.
 */
type PrototypeFlowStep = {
  templateKind: "screen" | "screen-cta";
  props: Record<string, unknown>;
};

const prototypePresets: (ComponentPreset & { flow: readonly PrototypeFlowStep[] })[] = [
  {
    id: "onboarding-flow",
    title: "Onboarding · 3-step",
    description: "Welcome → choose role → first-task nudge. Classic first-run flow.",
    artifactKinds: ["prototype"],
    templateKind: "screen",
    group: "flow",
    thumbnail: "[ ▢ → ▢ → ▢ ]",
    props: {
      title: "Onboarding flow",
      body: "Three-step welcome, role selection, and a gentle first-task nudge."
    },
    flow: [
      {
        templateKind: "screen",
        props: {
          title: "Welcome aboard",
          body: "Let's get your first workspace ready. It takes about 90 seconds.",
          orientation: "Step 1 of 3 · Introduction"
        }
      },
      {
        templateKind: "screen",
        props: {
          title: "What brings you here?",
          body: "Pick the role that fits best — we'll tune the starter workspace around it.",
          orientation: "Step 2 of 3 · Personalisation"
        }
      },
      {
        templateKind: "screen-cta",
        props: {
          title: "Start with a template",
          body: "Most teams start with a launch site. You can always add more artifacts later.",
          primaryAction: "Create my workspace",
          secondaryAction: "Skip for now"
        }
      }
    ]
  },
  {
    id: "upsell-flow",
    title: "Upsell · 2-step",
    description: "Value reminder followed by a decisive plan-comparison CTA.",
    artifactKinds: ["prototype"],
    templateKind: "screen",
    group: "flow",
    thumbnail: "[ ▢ → $ ]",
    props: {
      title: "Upsell flow",
      body: "Two-screen upgrade nudge tied to a usage milestone."
    },
    flow: [
      {
        templateKind: "screen",
        props: {
          title: "You're shipping more than most",
          body: "Your workspace crossed 10 published artifacts this month — let's make sure you have room to grow.",
          orientation: "Upgrade nudge · context"
        }
      },
      {
        templateKind: "screen-cta",
        props: {
          title: "Upgrade to Team",
          body: "Unlock shared workspaces, SSO, and versioned exports. Keep everything you've already built.",
          primaryAction: "Upgrade to Team",
          secondaryAction: "Compare plans"
        }
      }
    ]
  },
  {
    id: "checkout-flow",
    title: "Checkout · 3-step",
    description: "Cart review → payment details → confirmation screen.",
    artifactKinds: ["prototype"],
    templateKind: "screen",
    group: "flow",
    thumbnail: "[ 🛒 → 💳 → ✓ ]",
    props: {
      title: "Checkout flow",
      body: "Cart summary, payment capture, and a confirmation screen with next steps."
    },
    flow: [
      {
        templateKind: "screen",
        props: {
          title: "Review your order",
          body: "One annual Team seat, billed today. You can add seats any time without re-entering card details.",
          orientation: "Step 1 of 3 · Cart"
        }
      },
      {
        templateKind: "screen",
        props: {
          title: "Payment details",
          body: "We use Stripe to store cards. You'll get a VAT-ready receipt emailed within a minute.",
          orientation: "Step 2 of 3 · Payment"
        }
      },
      {
        templateKind: "screen-cta",
        props: {
          title: "You're all set",
          body: "Your Team plan is active. Invite teammates now or jump straight back into the workspace.",
          primaryAction: "Invite teammates",
          secondaryAction: "Back to workspace"
        }
      }
    ]
  }
];

/**
 * SLIDES — 7 presets (cover, divider, 3 content variants, 2 closings)
 * --------------------------------------------------------------------------
 */
const slidesPresets: ComponentPreset[] = [
  {
    id: "cover-bold",
    title: "Cover · Bold",
    description: "Opening slide with a confident thesis and a framing subtitle.",
    artifactKinds: ["slides"],
    templateKind: "slide-title",
    group: "cover",
    thumbnail: "[ 1 · COVER ]",
    props: {
      title: "From prompt to production.",
      body: "How we rebuilt the design-to-ship loop around one artifact.",
      thesis: "Design platforms should compose, not convert."
    }
  },
  {
    id: "section-divider",
    title: "Section Divider",
    description: "Interstitial slide that signals a new chapter in the deck.",
    artifactKinds: ["slides"],
    templateKind: "slide-title",
    group: "divider",
    thumbnail: "[ §§§ ]",
    props: {
      title: "Part II — The workspace",
      body: "Why one artifact beats five tools.",
      thesis: "Section break"
    }
  },
  {
    id: "content-bullets",
    title: "Content · Bullets",
    description: "Supporting slide with a headline and 3-4 tight bullet points.",
    artifactKinds: ["slides"],
    templateKind: "slide-content",
    group: "content",
    thumbnail: "[ • • • ]",
    props: {
      title: "What a workspace holds",
      body: "One graph, three surfaces, zero export drift.",
      bullets: [
        "Scenes — every section, screen, or slide lives as a versioned node.",
        "Assets — uploaded images, tokens, and brand rhythm travel with the workspace.",
        "Reviews — comments and snapshots anchor to the exact node they critique.",
        "Exports — a single artifact emits HTML, a codebase, or a deck on demand."
      ]
    }
  },
  {
    id: "content-metrics",
    title: "Content · Metrics",
    description: "Three-up metrics slide for proof points or traction numbers.",
    artifactKinds: ["slides"],
    templateKind: "slide-content",
    group: "content",
    thumbnail: "[ 99 · 12 · 3x ]",
    props: {
      title: "Six months after launch",
      body: "Measured across 240 design teams on the Team plan.",
      bullets: [
        "4.1× faster from brief to first reviewable artifact.",
        "62% fewer handoff tickets filed against design.",
        "93% of exports shipped without a follow-up fix."
      ]
    }
  },
  {
    id: "content-quote",
    title: "Content · Quote",
    description: "Pull-quote slide for a customer testimonial or analyst line.",
    artifactKinds: ["slides"],
    templateKind: "slide-content",
    group: "content",
    thumbnail: "[ \" ... \" ]",
    props: {
      title: "What design leads told us",
      body: "“We stopped maintaining a Figma library and a component codebase separately — they're the same artifact now.”",
      bullets: [
        "— Priya Natarajan, Head of Design, Northwind",
        "Shared on the record during the Q2 customer council."
      ]
    }
  },
  {
    id: "closing-ask",
    title: "Closing · Ask",
    description: "Final slide with a clear ask and a fallback action.",
    artifactKinds: ["slides"],
    templateKind: "slide-closing",
    group: "closing",
    thumbnail: "[ → ASK ]",
    props: {
      title: "The ask",
      body: "We're raising $6M to extend the platform into code and docs. We'd like you to lead.",
      primaryAction: "Schedule a follow-up",
      secondaryAction: "Request the data room"
    }
  },
  {
    id: "closing-signoff",
    title: "Closing · Sign-off",
    description: "Quiet closing slide — thanks, contact line, and a handle.",
    artifactKinds: ["slides"],
    templateKind: "slide-closing",
    group: "closing",
    thumbnail: "[  ·  ]",
    props: {
      title: "Thank you.",
      body: "Questions welcome any time — we read every reply personally.",
      primaryAction: "hello@opendesign.studio",
      secondaryAction: "@opendesign on most platforms"
    }
  }
];

/**
 * Full preset catalogue (24 entries total: 9 + 3 + 7 + … wait, 9 + 3 + 7 = 19).
 *
 * NOTE ON COUNT: the brief enumerates 9 website + 3 prototype + 7 slides = 19
 * uniquely-named seeds. The "24 total" phrase in the brief is reached once the
 * three prototype flows are unrolled into their constituent screen seeds
 * (3 + 2 + 3 = 8 screens), i.e. 9 + 8 + 7 = 24 concrete scene nodes appended
 * when each preset is consumed. The panel still renders 19 clickable cards.
 */
export const componentPresets: readonly ComponentPreset[] = [
  ...websitePresets,
  ...prototypePresets,
  ...slidesPresets
];

/**
 * Prototype flow definitions, exposed so the main thread can expand a
 * clicked flow preset into its ordered screen seeds.
 */
export const prototypeFlowSteps: Readonly<
  Record<string, readonly PrototypeFlowStep[]>
> = Object.fromEntries(
  prototypePresets.map((preset) => [preset.id, preset.flow])
);

export type { PrototypeFlowStep };
