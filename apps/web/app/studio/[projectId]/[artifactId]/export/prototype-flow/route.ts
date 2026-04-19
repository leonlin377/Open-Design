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
    `${getBrowserApiOrigin()}/api/projects/${projectId}/artifacts/${artifactId}/exports/prototype-flow`,
    {
      headers: {
        cookie: request.headers.get("cookie") ?? ""
      },
      cache: "no-store"
    }
  );

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json; charset=utf-8",
      "content-disposition":
        response.headers.get("content-disposition") ??
        'attachment; filename="prototype-flow.json"'
    }
  });
}
