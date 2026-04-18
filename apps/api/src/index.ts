import { buildApp } from "./app";

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

const app = await buildApp({ logger: true });

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
