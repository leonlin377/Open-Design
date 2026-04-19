import type { NextRequest } from "next/server";
import { buildArtifactHandoffArchive } from "@opendesign/exporters";
import { getInternalApiOrigin } from "../../../../../../lib/opendesign-api";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      projectId: string;
      artifactId: string;
    }>;
  }
) {
  const { projectId, artifactId } = await context.params;
  const response = await fetch(
    `${getInternalApiOrigin()}/api/projects/${projectId}/artifacts/${artifactId}/exports/handoff-bundle`,
    {
      headers: {
        cookie: request.headers.get("cookie") ?? ""
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json; charset=utf-8"
      }
    });
  }

  const payload = (await response.json()) as {
    filenameBase?: string;
    files?: Record<string, string>;
  };
  const archive = buildArtifactHandoffArchive({
    filenameBase: payload.filenameBase ?? "artifact",
    files: payload.files ?? {}
  });

  return new Response(Buffer.from(archive.bytes), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${archive.filename}"`
    }
  });
}
