import { pool } from "@workspace/db";
import { deliverRoadmapReminders } from "./lib/roadmap-push";
import { logger } from "./lib/logger";

// One bounded pass for a scheduler; no HTTP server or student visit needed.
try {
  await deliverRoadmapReminders();
} catch {
  logger.error("Scheduled roadmap reminder delivery failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
