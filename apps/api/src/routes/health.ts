import { ArtifactKindSchema } from "@opendesign/contracts";
import type { FastifyPluginAsync } from "fastify";

export const registerHealthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    service: "opendesign-api",
    artifactKinds: ArtifactKindSchema.options
  }));
};
