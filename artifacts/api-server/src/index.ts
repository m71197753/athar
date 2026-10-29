import app from "./app";
import { logger } from "./lib/logger";
import { seedConfiguredAdmins } from "./lib/platform-access";
import { startRoadmapReminderDelivery } from "./lib/roadmap-push";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Idempotent role-data seeding uses this environment's own Clerk identities.
// Schema changes are handled by Publish, never by application startup.
try {
  const result = await seedConfiguredAdmins();
  logger.info(result, "Configured administrator grants checked");
} catch (error) {
  logger.warn({ error: error instanceof Error ? error.message : "Seed failed" }, "Administrator bootstrap pending");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startRoadmapReminderDelivery();
});
