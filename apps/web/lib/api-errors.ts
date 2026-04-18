import type { ApiError } from "@opendesign/contracts";

export class ApiRequestError extends Error {
  status: number;
  payload: ApiError | null;

  constructor(input: { message: string; status: number; payload: ApiError | null }) {
    super(input.message);
    this.name = "ApiRequestError";
    this.status = input.status;
    this.payload = input.payload;
  }
}

export function parseApiErrorPayload(payload: unknown): ApiError | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<ApiError>;

  if (typeof candidate.error !== "string" || typeof candidate.code !== "string") {
    return null;
  }

  return {
    error: candidate.error,
    code: candidate.code as ApiError["code"],
    recoverable: typeof candidate.recoverable === "boolean" ? candidate.recoverable : false,
    ...(candidate.details && typeof candidate.details === "object"
      ? {
          details: candidate.details as Record<string, unknown>
        }
      : {})
  };
}

function readValidationIssueSummary(payload: ApiError | null) {
  const issues = payload?.details?.issues;

  if (!Array.isArray(issues) || issues.length === 0) {
    return null;
  }

  const firstIssue = issues[0] as { message?: unknown; path?: unknown };

  if (typeof firstIssue?.message !== "string" || firstIssue.message.trim().length === 0) {
    return null;
  }

  const path =
    typeof firstIssue.path === "string" && firstIssue.path.trim().length > 0
      ? `${firstIssue.path}: `
      : "";

  return `${path}${firstIssue.message}`;
}

export function readApiErrorMessage(payload: unknown, fallback: string) {
  const apiError = parseApiErrorPayload(payload);

  if (apiError) {
    if (apiError.code === "WORKSPACE_UPDATE_FAILED") {
      return `${apiError.error}. Reload the Studio and retry.`;
    }

    if (apiError.code === "PROJECT_NOT_FOUND" || apiError.code === "ARTIFACT_NOT_FOUND") {
      return `${apiError.error}. Reopen the resource and retry.`;
    }

    if (apiError.code === "VERSION_NOT_FOUND") {
      return `${apiError.error}. Reload version history and retry.`;
    }

    if (apiError.code === "INVALID_CODE_WORKSPACE") {
      return `${apiError.error}. Restore the required scaffold files before saving again.`;
    }

    if (apiError.code === "CODE_WORKSPACE_CONFLICT") {
      return `${apiError.error}.`;
    }

    if (apiError.code === "VALIDATION_ERROR") {
      const issueSummary = readValidationIssueSummary(apiError);
      return issueSummary
        ? `${apiError.error}: ${issueSummary}`
        : `${apiError.error}. Check the submitted fields and retry.`;
    }

    if (apiError.code === "AUTH_HANDLER_FAILURE") {
      return `${apiError.error}. Retry in a moment.`;
    }

    if (apiError.code === "GENERATION_TIMEOUT") {
      return `${apiError.error}. Retry the generation pass or increase the generation timeout.`;
    }

    if (apiError.code === "GENERATION_PROVIDER_FAILURE") {
      return `${apiError.error}. Check the LiteLLM gateway and provider credentials, then retry.`;
    }

    if (apiError.code === "INVALID_GENERATION_PLAN") {
      return `${apiError.error}. Retry with a different prompt or model configuration.`;
    }

    if (apiError.code === "INVALID_SCENE_PATCH") {
      return `${apiError.error}. Retry the pass or adjust the model configuration before generating again.`;
    }

    return apiError.error;
  }

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

export async function buildApiRequestError(response: Response, fallback: string) {
  let parsed: unknown = null;

  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  return new ApiRequestError({
    message: readApiErrorMessage(parsed, fallback),
    status: response.status,
    payload: parseApiErrorPayload(parsed)
  });
}
