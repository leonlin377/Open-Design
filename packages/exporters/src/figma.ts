import type {
  ArtifactKind,
  SceneDocument,
  SceneNode
} from "@opendesign/contracts";

/**
 * Figma REST-like import JSON.
 *
 * This is a best-effort mirror of Figma's publicly-documented FILE response
 * shape (https://www.figma.com/developers/api#files). A Figma plugin can
 * walk this JSON and reconstruct a scaffolded document — it is NOT signed,
 * does not hit Figma's private import endpoints, and is not guaranteed to
 * round-trip through Figma's internal parser. The goal is "enough structure
 * that a plugin can rebuild pages, frames, text, fills, and strokes".
 */

export type FigmaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type FigmaPaint = {
  type: "SOLID";
  color: FigmaColor;
  opacity?: number;
  blendMode: "NORMAL";
  visible: boolean;
};

export type FigmaStroke = FigmaPaint;

export type FigmaRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FigmaNodeBase = {
  id: string;
  name: string;
  visible: boolean;
  blendMode: "PASS_THROUGH" | "NORMAL";
};

export type FigmaTextNode = FigmaNodeBase & {
  type: "TEXT";
  characters: string;
  absoluteBoundingBox: FigmaRectangle;
  fills: FigmaPaint[];
  strokes: FigmaStroke[];
  strokeWeight: number;
  style: {
    fontFamily: string;
    fontPostScriptName: string | null;
    fontWeight: number;
    fontSize: number;
    lineHeightPx: number;
    letterSpacing: number;
    textAlignHorizontal: "LEFT" | "CENTER" | "RIGHT";
    textAlignVertical: "TOP" | "CENTER" | "BOTTOM";
  };
};

export type FigmaFrameNode = FigmaNodeBase & {
  type: "FRAME";
  absoluteBoundingBox: FigmaRectangle;
  backgroundColor: FigmaColor;
  fills: FigmaPaint[];
  strokes: FigmaStroke[];
  strokeWeight: number;
  cornerRadius: number;
  clipsContent: boolean;
  layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
  primaryAxisSizingMode: "AUTO" | "FIXED";
  counterAxisSizingMode: "AUTO" | "FIXED";
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  itemSpacing: number;
  children: Array<FigmaFrameNode | FigmaTextNode>;
};

export type FigmaCanvasNode = FigmaNodeBase & {
  type: "CANVAS";
  backgroundColor: FigmaColor;
  children: FigmaFrameNode[];
  prototypeStartNodeID: string | null;
  flowStartingPoints: Array<{ nodeId: string; name: string }>;
};

export type FigmaDocumentNode = {
  id: string;
  name: string;
  type: "DOCUMENT";
  children: FigmaCanvasNode[];
};

export type FigmaImportExport = {
  /** A high-level schema tag so downstream plugins know how to parse. */
  schemaVersion: 1;
  /** Mirrors `GET /v1/files/:key` top-level fields. */
  name: string;
  role: "owner";
  lastModified: string;
  editorType: "figma";
  thumbnailUrl: "";
  version: string;
  document: FigmaDocumentNode;
  /** Components/componentSets/styles are required by Figma's FILE shape. */
  components: Record<string, never>;
  componentSets: Record<string, never>;
  styles: Record<string, never>;
  /** Flat id → node map, mirroring how many Figma plugins consume FILEs. */
  nodeIndex: Record<string, FigmaCanvasNode | FigmaFrameNode | FigmaTextNode>;
};

type FigmaTheme = {
  /** CSS-style color (#rrggbb or #rrggbbaa) — defaults to a warm neutral. */
  surface?: string;
  accent?: string;
  text?: string;
};

export type FigmaImportArtifactSummary = {
  id: string;
  name: string;
  kind: ArtifactKind;
};

const FRAME_SIZE_BY_KIND: Record<ArtifactKind, { width: number; height: number }> = {
  // Figma's community "desktop" frame preset.
  website: { width: 1440, height: 900 },
  // Figma's "iPhone 14 Pro" frame preset — prototype screens.
  prototype: { width: 393, height: 852 },
  // 16:9 slide @ 1920×1080 matches the handoff/HTML exporter aspect ratio.
  slides: { width: 1920, height: 1080 }
};

const DEFAULT_THEME = {
  surface: "#fbf5e8",
  accent: "#0f766e",
  text: "#111827"
} as const;

function parseCssColor(value: string | undefined, fallback: string): FigmaColor {
  const raw = typeof value === "string" && value.length > 0 ? value : fallback;
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => `${ch}${ch}`)
          .join("")
      : hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const a =
    normalized.length >= 8 ? Number.parseInt(normalized.slice(6, 8), 16) : 255;

  if (
    !Number.isFinite(r) ||
    !Number.isFinite(g) ||
    !Number.isFinite(b) ||
    !Number.isFinite(a)
  ) {
    return { r: 1, g: 1, b: 1, a: 1 };
  }

  return {
    r: r / 255,
    g: g / 255,
    b: b / 255,
    a: a / 255
  };
}

function solidPaint(color: FigmaColor): FigmaPaint {
  return {
    type: "SOLID",
    color,
    blendMode: "NORMAL",
    visible: true,
    opacity: color.a
  };
}

function readString(props: Record<string, unknown>, key: string): string | undefined {
  const value = props[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(
  props: Record<string, unknown>,
  key: string
): string[] | undefined {
  const value = props[key];
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((entry): entry is string => typeof entry === "string");
  return items.length > 0 ? items : undefined;
}

function readItems(
  props: Record<string, unknown>
): Array<{ label: string; body: string }> | undefined {
  const value = props.items;
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(
    (item): item is { label: string; body: string } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { body?: unknown }).body === "string"
  );
  return items.length > 0 ? items : undefined;
}

function buildTextNode(input: {
  id: string;
  name: string;
  characters: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  lineHeightPx: number;
  textColor: FigmaColor;
  fontFamily?: string;
}): FigmaTextNode {
  return {
    id: input.id,
    name: input.name,
    type: "TEXT",
    visible: true,
    blendMode: "PASS_THROUGH",
    characters: input.characters,
    absoluteBoundingBox: {
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height
    },
    fills: [solidPaint(input.textColor)],
    strokes: [],
    strokeWeight: 0,
    style: {
      fontFamily: input.fontFamily ?? "Inter",
      fontPostScriptName: null,
      fontWeight: input.fontWeight,
      fontSize: input.fontSize,
      lineHeightPx: input.lineHeightPx,
      letterSpacing: 0,
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP"
    }
  };
}

function buildSectionFrame(input: {
  id: string;
  name: string;
  node: SceneNode;
  kind: ArtifactKind;
  frameIndex: number;
  theme: FigmaColor;
  accent: FigmaColor;
  text: FigmaColor;
  prompt: string;
  artifactName: string;
}): FigmaFrameNode {
  const size = FRAME_SIZE_BY_KIND[input.kind];
  const props = input.node.props as Record<string, unknown>;
  const eyebrow = readString(props, "eyebrow");
  const headline =
    readString(props, "headline") ??
    readString(props, "title") ??
    input.node.name;
  const body = readString(props, "body") ?? input.prompt;
  const bullets = readStringArray(props, "bullets");
  const items = readItems(props);
  const primaryAction = readString(props, "primaryAction");
  const secondaryAction = readString(props, "secondaryAction");

  const children: Array<FigmaFrameNode | FigmaTextNode> = [];
  const padding = input.kind === "prototype" ? 24 : 64;
  let cursorY = padding;

  if (eyebrow) {
    const node = buildTextNode({
      id: `${input.id}:eyebrow`,
      name: "Eyebrow",
      characters: eyebrow,
      x: padding,
      y: cursorY,
      width: size.width - padding * 2,
      height: 24,
      fontSize: 14,
      fontWeight: 600,
      lineHeightPx: 20,
      textColor: input.accent
    });
    children.push(node);
    cursorY += 36;
  }

  const headlineSize = input.kind === "prototype" ? 28 : 56;
  const headlineHeight = input.kind === "prototype" ? 80 : 120;
  children.push(
    buildTextNode({
      id: `${input.id}:headline`,
      name: "Headline",
      characters: headline,
      x: padding,
      y: cursorY,
      width: size.width - padding * 2,
      height: headlineHeight,
      fontSize: headlineSize,
      fontWeight: 700,
      lineHeightPx: headlineSize * 1.1,
      textColor: input.text
    })
  );
  cursorY += headlineHeight + 16;

  children.push(
    buildTextNode({
      id: `${input.id}:body`,
      name: "Body",
      characters: body,
      x: padding,
      y: cursorY,
      width: size.width - padding * 2,
      height: 96,
      fontSize: 18,
      fontWeight: 400,
      lineHeightPx: 28,
      textColor: input.text
    })
  );
  cursorY += 120;

  if (bullets && bullets.length > 0) {
    bullets.forEach((bullet, index) => {
      children.push(
        buildTextNode({
          id: `${input.id}:bullet:${index}`,
          name: `Bullet ${index + 1}`,
          characters: `• ${bullet}`,
          x: padding,
          y: cursorY,
          width: size.width - padding * 2,
          height: 32,
          fontSize: 18,
          fontWeight: 400,
          lineHeightPx: 28,
          textColor: input.text
        })
      );
      cursorY += 40;
    });
  }

  if (items && items.length > 0) {
    const cols = Math.min(items.length, 3);
    const gap = 16;
    const columnWidth = (size.width - padding * 2 - gap * (cols - 1)) / cols;
    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = padding + col * (columnWidth + gap);
      const y = cursorY + row * 180;

      children.push({
        id: `${input.id}:panel:${index}`,
        name: item.label,
        type: "FRAME",
        visible: true,
        blendMode: "PASS_THROUGH",
        absoluteBoundingBox: {
          x,
          y,
          width: columnWidth,
          height: 160
        },
        backgroundColor: input.theme,
        fills: [solidPaint(input.theme)],
        strokes: [solidPaint({ ...input.text, a: 0.1 })],
        strokeWeight: 1,
        cornerRadius: 20,
        clipsContent: true,
        layoutMode: "VERTICAL",
        primaryAxisSizingMode: "FIXED",
        counterAxisSizingMode: "FIXED",
        paddingLeft: 18,
        paddingRight: 18,
        paddingTop: 18,
        paddingBottom: 18,
        itemSpacing: 8,
        children: [
          buildTextNode({
            id: `${input.id}:panel:${index}:label`,
            name: "Panel Label",
            characters: item.label,
            x: x + 18,
            y: y + 18,
            width: columnWidth - 36,
            height: 20,
            fontSize: 14,
            fontWeight: 600,
            lineHeightPx: 20,
            textColor: input.accent
          }),
          buildTextNode({
            id: `${input.id}:panel:${index}:body`,
            name: "Panel Body",
            characters: item.body,
            x: x + 18,
            y: y + 46,
            width: columnWidth - 36,
            height: 80,
            fontSize: 16,
            fontWeight: 400,
            lineHeightPx: 24,
            textColor: input.text
          })
        ]
      });
    });
    cursorY += Math.ceil(items.length / cols) * 180;
  }

  if (primaryAction || secondaryAction) {
    const actions = [primaryAction, secondaryAction].filter(
      (value): value is string => typeof value === "string"
    );
    actions.forEach((action, index) => {
      children.push({
        id: `${input.id}:action:${index}`,
        name: index === 0 ? "Primary Action" : "Secondary Action",
        type: "FRAME",
        visible: true,
        blendMode: "PASS_THROUGH",
        absoluteBoundingBox: {
          x: padding + index * 180,
          y: cursorY,
          width: 160,
          height: 48
        },
        backgroundColor: index === 0 ? input.text : input.theme,
        fills: [solidPaint(index === 0 ? input.text : input.theme)],
        strokes: [solidPaint({ ...input.text, a: 0.1 })],
        strokeWeight: 1,
        cornerRadius: 999,
        clipsContent: true,
        layoutMode: "HORIZONTAL",
        primaryAxisSizingMode: "FIXED",
        counterAxisSizingMode: "FIXED",
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 12,
        paddingBottom: 12,
        itemSpacing: 0,
        children: [
          buildTextNode({
            id: `${input.id}:action:${index}:label`,
            name: "Action Label",
            characters: action,
            x: padding + index * 180 + 24,
            y: cursorY + 12,
            width: 112,
            height: 24,
            fontSize: 16,
            fontWeight: 600,
            lineHeightPx: 24,
            textColor:
              index === 0
                ? { r: 1, g: 1, b: 1, a: 1 }
                : input.text
          })
        ]
      });
    });
  }

  return {
    id: input.id,
    name: input.name,
    type: "FRAME",
    visible: true,
    blendMode: "PASS_THROUGH",
    absoluteBoundingBox: {
      x: input.frameIndex * (size.width + 80),
      y: 0,
      width: size.width,
      height: size.height
    },
    backgroundColor: input.theme,
    fills: [solidPaint(input.theme)],
    strokes: [solidPaint({ ...input.text, a: 0.08 })],
    strokeWeight: 1,
    cornerRadius: input.kind === "prototype" ? 32 : 0,
    clipsContent: true,
    layoutMode: "VERTICAL",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    paddingLeft: padding,
    paddingRight: padding,
    paddingTop: padding,
    paddingBottom: padding,
    itemSpacing: 16,
    children
  };
}

function framesFromNodes(input: {
  nodes: SceneNode[];
  kind: ArtifactKind;
  artifactName: string;
  prompt: string;
  theme: FigmaColor;
  accent: FigmaColor;
  text: FigmaColor;
}): FigmaFrameNode[] {
  // screen-link nodes are transitions, not frames.
  const frameBearingNodes = input.nodes.filter((node) => node.type !== "screen-link");

  if (frameBearingNodes.length === 0) {
    return [
      buildSectionFrame({
        id: "frame:seed",
        name: `${input.artifactName} · Seed`,
        node: {
          id: "seed",
          type: "section",
          name: "Seed",
          props: {
            headline: input.artifactName,
            body: input.prompt
          },
          children: []
        },
        kind: input.kind,
        frameIndex: 0,
        theme: input.theme,
        accent: input.accent,
        text: input.text,
        prompt: input.prompt,
        artifactName: input.artifactName
      })
    ];
  }

  return frameBearingNodes.map((node, index) =>
    buildSectionFrame({
      id: `frame:${node.id}`,
      name: node.name,
      node,
      kind: input.kind,
      frameIndex: index,
      theme: input.theme,
      accent: input.accent,
      text: input.text,
      prompt: input.prompt,
      artifactName: input.artifactName
    })
  );
}

function indexFrame(
  frame: FigmaFrameNode | FigmaTextNode,
  target: Record<string, FigmaCanvasNode | FigmaFrameNode | FigmaTextNode>
) {
  target[frame.id] = frame;
  if (frame.type === "FRAME") {
    frame.children.forEach((child) => indexFrame(child, target));
  }
}

export const buildFigmaImportExport = (input: {
  artifact: FigmaImportArtifactSummary;
  sceneDocument: SceneDocument;
  prompt?: string;
  theme?: FigmaTheme;
}): FigmaImportExport => {
  const kind = input.artifact.kind;
  const theme = parseCssColor(input.theme?.surface, DEFAULT_THEME.surface);
  const accent = parseCssColor(input.theme?.accent, DEFAULT_THEME.accent);
  const text = parseCssColor(input.theme?.text, DEFAULT_THEME.text);

  const frames = framesFromNodes({
    nodes: input.sceneDocument.nodes,
    kind,
    artifactName: input.artifact.name,
    prompt: input.prompt ?? "OpenDesign artifact workspace",
    theme,
    accent,
    text
  });

  // Prototype flow hints — Figma uses prototypeStartNodeID plus flow points.
  const startFrameId = kind === "prototype" ? (frames[0]?.id ?? null) : null;
  const flowStartingPoints =
    kind === "prototype" && frames[0]
      ? [{ nodeId: frames[0].id, name: `${input.artifact.name} flow` }]
      : [];

  const canvas: FigmaCanvasNode = {
    id: `canvas:${input.artifact.id}`,
    name: `${input.artifact.name} · ${kind}`,
    type: "CANVAS",
    visible: true,
    blendMode: "PASS_THROUGH",
    backgroundColor: theme,
    children: frames,
    prototypeStartNodeID: startFrameId,
    flowStartingPoints
  };

  const document: FigmaDocumentNode = {
    id: `document:${input.artifact.id}`,
    name: input.artifact.name,
    type: "DOCUMENT",
    children: [canvas]
  };

  const nodeIndex: Record<string, FigmaCanvasNode | FigmaFrameNode | FigmaTextNode> = {
    [canvas.id]: canvas
  };
  frames.forEach((frame) => indexFrame(frame, nodeIndex));

  return {
    schemaVersion: 1,
    name: input.artifact.name,
    role: "owner",
    lastModified: new Date().toISOString(),
    editorType: "figma",
    thumbnailUrl: "",
    version: String(input.sceneDocument.version),
    document,
    components: {},
    componentSets: {},
    styles: {},
    nodeIndex
  };
};
