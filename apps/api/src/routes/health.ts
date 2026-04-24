import { ArtifactKindSchema } from "@opendesign/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { AssetStorage } from "../asset-storage";

type PersistenceProbe = {
  ping(): Promise<void>;
};

type HealthRouteOptions = {
  diagnostics: {
    persistenceMode: "memory" | "postgres";
    assetStorageProvider: "memory" | "s3";
  };
  authBaseURL: string;
  authTrustedOrigins: string[];
  persistence: PersistenceProbe;
  assetStorage: Pick<AssetStorage, "provider" | "ping">;
  readinessProbeTimeoutMs?: number;
};

type ProbeStatus =
  | { status: "ok" }
  | { status: "error"; message: string };

function normalizeProbeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "unknown error";
  }
}

async function runProbeWithTimeout(
  probe: () => Promise<void>,
  timeoutMs: number
): Promise<ProbeStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`probe timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    await Promise.race([probe(), timeoutPromise]);
    return { status: "ok" };
  } catch (error) {
    return { status: "error", message: normalizeProbeError(error) };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export const registerHealthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  app,
  options
) => {
  const probeTimeoutMs = options.readinessProbeTimeoutMs ?? 2500;

  app.get("/health", async () => ({
    service: "opendesign-api",
    artifactKinds: ArtifactKindSchema.options
  }));

  app.get("/ready", async (_request, reply) => {
    const [persistenceStatus, assetStorageStatus] = await Promise.all([
      runProbeWithTimeout(() => options.persistence.ping(), probeTimeoutMs),
      runProbeWithTimeout(
        () =>
          options.assetStorage.ping
            ? options.assetStorage.ping({ timeoutMs: probeTimeoutMs })
            : Promise.resolve(),
        probeTimeoutMs
      )
    ]);

    const ready =
      persistenceStatus.status === "ok" && assetStorageStatus.status === "ok";

    const body = {
      service: "opendesign-api",
      ready,
      persistence: {
        mode: options.diagnostics.persistenceMode,
        status: persistenceStatus.status,
        ...(persistenceStatus.status === "error"
          ? { message: persistenceStatus.message }
          : {})
      },
      assetStorage: {
        provider: options.diagnostics.assetStorageProvider,
        status: assetStorageStatus.status,
        ...(assetStorageStatus.status === "error"
          ? { message: assetStorageStatus.message }
          : {})
      }
    };

    reply.status(ready ? 200 : 503);
    return body;
  });

  app.get("/diagnostics", async (request) => ({
    service: "opendesign-api",
    requestId: request.requestId,
    persistence: {
      mode: options.diagnostics.persistenceMode
    },
    assetStorage: {
      provider: options.diagnostics.assetStorageProvider
    },
    auth: {
      baseURL: options.authBaseURL,
      trustedOrigins: options.authTrustedOrigins
    }
  }));
};
