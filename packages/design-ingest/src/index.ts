import type { DesignSystemPack } from "@opendesign/contracts";

export type GithubImportSource = {
  type: "github";
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
};

export type LocalDirectoryImportSource = {
  type: "local-directory";
  absolutePath: string;
};

export type SiteCaptureImportSource = {
  type: "site-capture";
  url: string;
};

export type DesignImportSource =
  | GithubImportSource
  | LocalDirectoryImportSource
  | SiteCaptureImportSource;

export type PackProvenance = DesignSystemPack["provenance"][number];

export type ExtractedEvidence = {
  label: string;
  kind: PackProvenance["type"];
  sourceRef: string;
};

export type ExtractedPackResult = {
  source: DesignImportSource;
  pack: DesignSystemPack;
  evidence: ExtractedEvidence[];
  warnings: string[];
};

export type RepositoryTextFile = {
  path: string;
  content: string;
};

export type SiteCaptureStylesheet = {
  sourceRef: string;
  content: string;
};

export type SiteCaptureDomNode = {
  tag: string;
  className?: string | null;
  text?: string | null;
};

export type PackEvidenceSummary = {
  evidenceCount: number;
  provenanceCount: number;
  targetCount: number;
  sourceKinds: ExtractedEvidence["kind"][];
};

export const summarizePackEvidence = (
  result: ExtractedPackResult
): PackEvidenceSummary => {
  const sourceKinds = Array.from(new Set(result.evidence.map((item) => item.kind))).sort();
  const targetCount = result.pack.provenance.reduce(
    (count, provenance) => count + provenance.targets.length,
    0
  );

  return {
    evidenceCount: result.evidence.length,
    provenanceCount: result.pack.provenance.length,
    targetCount,
    sourceKinds
  };
};

function normalizeTokenKey(value: string) {
  return value
    .trim()
    .replace(/^[./]+/, "")
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
}

function buildProvenanceId(prefix: string, path: string, index: number) {
  return `${prefix}_${normalizeTokenKey(path) || "item"}_${index + 1}`;
}

function isColorValue(value: string) {
  return /^(#|rgb|hsl|oklch|oklab|color\()/.test(value.trim());
}

function isTypographyPath(path: string) {
  return /(font|typography|type|size|weight|line|leading|tracking|letter)/i.test(path);
}

function isColorPath(path: string) {
  return /(color|brand|accent|primary|secondary|surface|background|fg|bg|border)/i.test(
    path
  );
}

function collectJsonLeaves(
  value: unknown,
  path: string[] = []
): Array<{ path: string; value: string }> {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return [
      {
        path: path.join("."),
        value: String(value)
      }
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectJsonLeaves(item, [...path, String(index)]));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      collectJsonLeaves(item, [...path, key])
    );
  }

  return [];
}

function extractCssVariables(content: string) {
  const matches = [...content.matchAll(/--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g)];

  return matches.map((match) => ({
    key: match[1] ?? "",
    value: (match[2] ?? "").trim()
  }));
}

function extractCssDeclarations(content: string, property: string) {
  const expression = new RegExp(`${property}\\s*:\\s*([^;]+);`, "gi");
  const matches = [...content.matchAll(expression)];

  return matches.map((match) => ({
    key: property,
    value: (match[1] ?? "").trim()
  }));
}

function extractComponentsFromPath(path: string) {
  const normalizedPath = path.toLowerCase();

  if (
    !/(^|\/)(components?|ui|blocks?)\//.test(normalizedPath) &&
    !/(button|card|input|form|dialog|modal|nav|hero|pricing|footer|header)/.test(
      normalizedPath
    )
  ) {
    return [];
  }

  const segments = path.split("/");
  const filename = segments.at(-1) ?? path;
  const baseName = filename.replace(/\.[^.]+$/, "");
  const label = baseName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return [
    {
      id: `component_${normalizeTokenKey(baseName) || "item"}`,
      name: label,
      category: segments.length > 1 ? segments.at(-2) ?? "component" : "component",
      signature: path
    }
  ];
}

export const extractDesignSystemPackFromRepositoryFiles = (input: {
  source: GithubImportSource | LocalDirectoryImportSource;
  files: RepositoryTextFile[];
}): ExtractedPackResult => {
  const colors: Record<string, string> = {};
  const typography: Record<string, string> = {};
  const components = new Map<string, DesignSystemPack["components"][number]>();
  const provenance: DesignSystemPack["provenance"] = [];
  const evidence: ExtractedEvidence[] = [];
  const warnings: string[] = [];

  const packName =
    input.source.type === "github"
      ? `${input.source.owner}/${input.source.repo}`
      : input.source.absolutePath.split(/[\\/]/).filter(Boolean).at(-1) ||
        input.source.absolutePath;

  for (const file of input.files) {
    const filePath = file.path;
    const extension = filePath.split(".").at(-1)?.toLowerCase() ?? "";

    evidence.push({
      label: filePath,
      kind: "repository-file",
      sourceRef: filePath
    });

    for (const component of extractComponentsFromPath(filePath)) {
      components.set(component.id, component);
      provenance.push({
        id: buildProvenanceId("component", filePath, provenance.length),
        type: "repository-file",
        sourceRef: filePath,
        targets: [`components.${component.id}`]
      });
    }

    if (extension === "css" || extension === "scss") {
      const variables = extractCssVariables(file.content);

      for (const variable of variables) {
        const tokenKey = normalizeTokenKey(variable.key);
        if (!tokenKey) {
          continue;
        }

        if (isColorValue(variable.value) || isColorPath(variable.key)) {
          colors[tokenKey] = variable.value;
          provenance.push({
            id: buildProvenanceId("token", `${filePath}.${tokenKey}`, provenance.length),
            type: "token",
            sourceRef: filePath,
            targets: [`tokens.colors.${tokenKey}`]
          });
          continue;
        }

        if (isTypographyPath(variable.key)) {
          typography[tokenKey] = variable.value;
          provenance.push({
            id: buildProvenanceId("token", `${filePath}.${tokenKey}`, provenance.length),
            type: "token",
            sourceRef: filePath,
            targets: [`tokens.typography.${tokenKey}`]
          });
        }
      }
    }

    if (extension === "json") {
      try {
        const parsed = JSON.parse(file.content) as unknown;
        const leaves = collectJsonLeaves(parsed);

        for (const leaf of leaves) {
          const tokenKey = normalizeTokenKey(leaf.path);
          if (!tokenKey) {
            continue;
          }

          if (isColorValue(leaf.value) || isColorPath(leaf.path)) {
            colors[tokenKey] = leaf.value;
            provenance.push({
              id: buildProvenanceId("token", `${filePath}.${tokenKey}`, provenance.length),
              type: "token",
              sourceRef: filePath,
              targets: [`tokens.colors.${tokenKey}`]
            });
            continue;
          }

          if (isTypographyPath(leaf.path)) {
            typography[tokenKey] = leaf.value;
            provenance.push({
              id: buildProvenanceId("token", `${filePath}.${tokenKey}`, provenance.length),
              type: "token",
              sourceRef: filePath,
              targets: [`tokens.typography.${tokenKey}`]
            });
          }
        }
      } catch {
        warnings.push(`Skipped invalid JSON file during import: ${filePath}`);
      }
    }
  }

  const motifs: DesignSystemPack["motifs"] = [];

  if (Object.keys(colors).length > 0) {
    motifs.push({
      id: "motif_color_system",
      label: "Color System",
      description: "Repository evidence includes reusable color tokens."
    });
  }

  if (Object.keys(typography).length > 0) {
    motifs.push({
      id: "motif_type_scale",
      label: "Type Scale",
      description: "Repository evidence includes typography or type scale tokens."
    });
  }

  if (components.size > 0) {
    motifs.push({
      id: "motif_component_library",
      label: "Component Library",
      description: "Repository evidence includes reusable UI component entry points."
    });
  }

  if (
    Object.keys(colors).length === 0 &&
    Object.keys(typography).length === 0 &&
    components.size === 0
  ) {
    warnings.push(
      "No obvious tokens or component entry points were extracted from the selected repository files."
    );
  }

  return {
    source: input.source,
    pack: {
      id: crypto.randomUUID(),
      name: packName,
      source: input.source.type,
      tokens: {
        colors,
        typography
      },
      components: [...components.values()],
      motifs,
      provenance
    },
    evidence,
    warnings
  };
};

export const extractDesignSystemPackFromSiteCapture = (input: {
  source: SiteCaptureImportSource;
  html: string;
  stylesheets: SiteCaptureStylesheet[];
  domNodes: SiteCaptureDomNode[];
}): ExtractedPackResult => {
  const colors: Record<string, string> = {};
  const typography: Record<string, string> = {};
  const components = new Map<string, DesignSystemPack["components"][number]>();
  const provenance: DesignSystemPack["provenance"] = [];
  const evidence: ExtractedEvidence[] = [
    {
      label: input.source.url,
      kind: "dom",
      sourceRef: input.source.url
    }
  ];
  const warnings: string[] = [];
  const baseUrl = new URL(input.source.url);

  const styleSources: SiteCaptureStylesheet[] = [
    ...input.stylesheets,
    {
      sourceRef: input.source.url,
      content: [...input.html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
        .map((match) => match[1] ?? "")
        .join("\n")
    }
  ];

  for (const stylesheet of styleSources) {
    if (stylesheet.content.trim().length === 0) {
      continue;
    }

    evidence.push({
      label: stylesheet.sourceRef,
      kind: "dom",
      sourceRef: stylesheet.sourceRef
    });

    const cssVariables = extractCssVariables(stylesheet.content);
    const fontFamilies = extractCssDeclarations(stylesheet.content, "font-family");
    const fontSizes = extractCssDeclarations(stylesheet.content, "font-size");

    for (const variable of cssVariables) {
      const tokenKey = normalizeTokenKey(variable.key);
      if (!tokenKey) {
        continue;
      }

      if (isColorValue(variable.value) || isColorPath(variable.key)) {
        colors[tokenKey] = variable.value;
        provenance.push({
          id: buildProvenanceId("token", `${stylesheet.sourceRef}.${tokenKey}`, provenance.length),
          type: "token",
          sourceRef: stylesheet.sourceRef,
          targets: [`tokens.colors.${tokenKey}`]
        });
        continue;
      }

      if (isTypographyPath(variable.key)) {
        typography[tokenKey] = variable.value;
        provenance.push({
          id: buildProvenanceId("token", `${stylesheet.sourceRef}.${tokenKey}`, provenance.length),
          type: "token",
          sourceRef: stylesheet.sourceRef,
          targets: [`tokens.typography.${tokenKey}`]
        });
      }
    }

    for (const declaration of [...fontFamilies, ...fontSizes]) {
      const tokenKey = normalizeTokenKey(`${declaration.key}.${declaration.value}`);
      if (!tokenKey) {
        continue;
      }

      typography[tokenKey] = declaration.value;
      provenance.push({
        id: buildProvenanceId("token", `${stylesheet.sourceRef}.${tokenKey}`, provenance.length),
        type: "token",
        sourceRef: stylesheet.sourceRef,
        targets: [`tokens.typography.${tokenKey}`]
      });
    }
  }

  for (const node of input.domNodes) {
    const tag = node.tag.toLowerCase();
    const classLabel = node.className?.trim();
    const signature = classLabel ? `${tag}.${classLabel}` : tag;

    if (!["button", "input", "nav", "header", "footer", "section", "a"].includes(tag)) {
      continue;
    }

    const componentId = `component_${normalizeTokenKey(signature) || tag}`;

    if (!components.has(componentId)) {
      components.set(componentId, {
        id: componentId,
        name: classLabel ? `${tag} ${classLabel}` : tag,
        category: tag,
        signature
      });
      provenance.push({
        id: buildProvenanceId("component", signature, provenance.length),
        type: "dom",
        sourceRef: input.source.url,
        targets: [`components.${componentId}`]
      });
    }
  }

  const motifs: DesignSystemPack["motifs"] = [];

  if (Object.keys(colors).length > 0) {
    motifs.push({
      id: "motif_site_color_system",
      label: "Captured Color System",
      description: "Site capture extracted reusable color tokens from page styles."
    });
  }

  if (Object.keys(typography).length > 0) {
    motifs.push({
      id: "motif_site_typography",
      label: "Captured Typography",
      description: "Site capture extracted type styles and font evidence from page styles."
    });
  }

  if (components.size > 0) {
    motifs.push({
      id: "motif_site_components",
      label: "Captured Components",
      description: "Site capture identified reusable component signatures from the DOM."
    });
  }

  if (
    Object.keys(colors).length === 0 &&
    Object.keys(typography).length === 0 &&
    components.size === 0
  ) {
    warnings.push(
      "Site capture did not find obvious reusable tokens or component signatures in the provided page."
    );
  }

  return {
    source: input.source,
    pack: {
      id: crypto.randomUUID(),
      name: baseUrl.hostname,
      source: "site-capture",
      tokens: {
        colors,
        typography
      },
      components: [...components.values()],
      motifs,
      provenance
    },
    evidence,
    warnings
  };
};
