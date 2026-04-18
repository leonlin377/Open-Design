import { createAppPersistence } from "../persistence";

const persistence = await createAppPersistence();

try {
  if (persistence.mode !== "postgres") {
    throw new Error("DATABASE_URL must be set to run API migrations.");
  }

  console.log("Postgres persistence is ready.");
} finally {
  await persistence.close();
}
