import { ApiErrorSchema } from "@opendesign/contracts";
import type { FastifyReply } from "fastify";
import type { z } from "zod";

export type ApiErrorInput = z.input<typeof ApiErrorSchema>;

export function buildApiError(input: ApiErrorInput) {
  return ApiErrorSchema.parse(input);
}

export function sendApiError(
  reply: Pick<FastifyReply, "code" | "send">,
  statusCode: number,
  input: ApiErrorInput
) {
  return reply.code(statusCode).send(buildApiError(input));
}

export function appendRequestIdToApiError(
  input: ApiErrorInput,
  requestId: string | null | undefined
): ApiErrorInput {
  if (!requestId) {
    return input;
  }

  return {
    ...input,
    details: {
      ...(input.details ?? {}),
      requestId
    }
  };
}
