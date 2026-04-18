import type { NextRequest } from "next/server";
import { getBrowserApiOrigin } from "../../../../../../lib/opendesign-api";

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
    `${getBrowserApiOrigin()}/api/projects/${projectId}/artifacts/${artifactId}/exports/source-bundle`,
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

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${payload.filenameBase ?? "artifact"}-bundle.json"`
    }
  });
}
