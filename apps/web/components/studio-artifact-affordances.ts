import type { SceneTemplateKind } from "@opendesign/contracts";
import type { ApiArtifact } from "../lib/opendesign-api";

type ArtifactEditorAffordance = {
  canvasTitle: string;
  canvasDescription: string;
  canvasEyebrow: string;
  canvasFrameTone: string;
  canvasMetricLabels: [string, string, string];
  panelTitle: string;
  panelDescription: string;
  unitLabel: string;
  emptyStateLabel: string;
  updateButtonLabel: string;
  templateButtonLabels: Record<SceneTemplateKind, string>;
  templateDescriptions: Record<SceneTemplateKind, string>;
  fieldLabels: {
    name: string;
    eyebrow: string;
    title: string;
    headline: string;
    body: string;
    primaryAction: string;
    secondaryAction: string;
    itemLabel: string;
    itemBody: string;
  };
};

const artifactEditorAffordances: Record<ApiArtifact["kind"], ArtifactEditorAffordance> = {
  website: {
    canvasTitle: "Website Canvas",
    canvasDescription: "Shape landing-page hierarchy, section pacing, and CTA sequencing.",
    canvasEyebrow: "Live artifact surface",
    canvasFrameTone: "Launch-ready website rhythm",
    canvasMetricLabels: ["Sections", "Preview basis", "Primary lane"],
    panelTitle: "Scene Sections",
    panelDescription:
      "Append a root section template to the website scene, then refine copy and CTA labels.",
    unitLabel: "section",
    emptyStateLabel: "No scene sections yet.",
    updateButtonLabel: "Update Section",
    templateButtonLabels: {
      hero: "Add Hero",
      "feature-grid": "Add Feature Grid",
      cta: "Add CTA"
    },
    templateDescriptions: {
      hero: "Entry surface for the core pitch, brand signal, and first CTA.",
      "feature-grid": "Mid-page proof block for capabilities, comparisons, or product lanes.",
      cta: "Closing conversion block for the strongest next step."
    },
    fieldLabels: {
      name: "Section Name",
      eyebrow: "Eyebrow",
      title: "Title",
      headline: "Headline",
      body: "Body",
      primaryAction: "Primary Action",
      secondaryAction: "Secondary Action",
      itemLabel: "Label",
      itemBody: "Body"
    }
  },
  prototype: {
    canvasTitle: "Prototype Flow",
    canvasDescription: "Shape state-to-state flow, screen hierarchy, and interaction prompts.",
    canvasEyebrow: "Interactive flow surface",
    canvasFrameTone: "Stateful screen-to-screen motion",
    canvasMetricLabels: ["Screens", "Start state", "Transition lane"],
    panelTitle: "Prototype Screens",
    panelDescription:
      "Append a root screen template to the flow, then refine screen copy and action labels.",
    unitLabel: "screen",
    emptyStateLabel: "No prototype screens yet.",
    updateButtonLabel: "Update Screen",
    templateButtonLabels: {
      hero: "Add Hero Screen",
      "feature-grid": "Add Feature Screen",
      cta: "Add Action Screen"
    },
    templateDescriptions: {
      hero: "Entry state for the flow with orientation copy and the first decision prompt.",
      "feature-grid": "System or comparison state for showing options, lanes, or detail clusters.",
      cta: "Next-step state for approval, confirmation, or handoff cues."
    },
    fieldLabels: {
      name: "Screen Name",
      eyebrow: "Flow Label",
      title: "Screen Title",
      headline: "Screen Headline",
      body: "Screen Body",
      primaryAction: "Primary Action Label",
      secondaryAction: "Secondary Action Label",
      itemLabel: "Card Label",
      itemBody: "Card Copy"
    }
  },
  slides: {
    canvasTitle: "Slides Deck",
    canvasDescription: "Shape deck pacing, slide framing, and closing narrative beats.",
    canvasEyebrow: "Narrative deck surface",
    canvasFrameTone: "Presentation pacing and sequencing",
    canvasMetricLabels: ["Slides", "Current beat", "Deck mode"],
    panelTitle: "Slides Deck",
    panelDescription:
      "Append a root slide template to the deck, then refine framing copy and CTA messaging.",
    unitLabel: "slide",
    emptyStateLabel: "No slides yet.",
    updateButtonLabel: "Update Slide",
    templateButtonLabels: {
      hero: "Add Title Slide",
      "feature-grid": "Add System Slide",
      cta: "Add Closing Slide"
    },
    templateDescriptions: {
      hero: "Opening slide for the narrative frame, thesis, and audience orientation.",
      "feature-grid": "Middle slide for systems, evidence, or structured supporting points.",
      cta: "Closing slide for the takeaway, ask, or final call to action."
    },
    fieldLabels: {
      name: "Slide Name",
      eyebrow: "Kicker",
      title: "Slide Title",
      headline: "Slide Headline",
      body: "Slide Body",
      primaryAction: "Primary CTA Label",
      secondaryAction: "Secondary CTA Label",
      itemLabel: "Point Label",
      itemBody: "Point Copy"
    }
  }
};

export function getArtifactEditorAffordance(kind: ApiArtifact["kind"]) {
  return artifactEditorAffordances[kind];
}
