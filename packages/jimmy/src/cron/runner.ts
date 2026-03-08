import type { CronJob, Engine, JimmyConfig, Connector } from "../shared/types.js";
import { buildContext } from "../sessions/context.js";
import { JIMMY_HOME } from "../shared/paths.js";
import { logger } from "../shared/logger.js";
import { appendRunLog } from "./jobs.js";
import { scanOrg, findEmployee } from "../gateway/org.js";

export async function runCronJob(
  job: CronJob,
  engines: Map<string, Engine>,
  config: JimmyConfig,
  connectors: Map<string, Connector>,
): Promise<void> {
  const startTime = Date.now();
  logger.info(`Cron job "${job.name}" (${job.id}) starting`);

  // 1. Determine engine + model
  const engineName = job.engine || config.engines.default;
  const engine = engines.get(engineName);
  if (!engine) {
    logger.error(`Engine "${engineName}" not found for cron job "${job.name}"`);
    return;
  }
  const model =
    job.model || config.engines[engineName as "claude" | "codex"]?.model;

  // 2. Build context (with employee, config, and connectors)
  let employee;
  if (job.employee) {
    const orgRegistry = scanOrg();
    employee = findEmployee(job.employee, orgRegistry);
  }

  const ctx = buildContext({
    source: "cron",
    channel: job.id,
    user: "system",
    employee,
    config,
    connectors: Array.from(connectors.keys()),
  });

  // 3. Run engine (fresh session, no resume)
  try {
    const result = await engine.run({
      prompt: job.prompt,
      systemPrompt: ctx,
      cwd: JIMMY_HOME,
      model,
    });

    const durationMs = Date.now() - startTime;

    // 4. If delivery configured, send result to connector
    if (job.delivery && result.result) {
      const connector = connectors.get(job.delivery.connector);
      if (connector) {
        await connector.sendMessage(
          { channel: job.delivery.channel },
          result.result,
        );
      } else {
        logger.warn(
          `Delivery connector "${job.delivery.connector}" not found`,
        );
      }
    }

    // 5. Log run
    appendRunLog(job.id, {
      timestamp: new Date().toISOString(),
      status: result.error ? "error" : "success",
      durationMs,
      error: result.error || null,
      resultPreview: result.result?.slice(0, 200) || null,
    });

    logger.info(`Cron job "${job.name}" completed in ${durationMs}ms`);
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    appendRunLog(job.id, {
      timestamp: new Date().toISOString(),
      status: "error",
      durationMs,
      error: err.message,
      resultPreview: null,
    });
    logger.error(`Cron job "${job.name}" failed: ${err.message}`);
  }
}
