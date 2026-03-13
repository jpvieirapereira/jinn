import { logger } from "./logger.js";
import type { Employee, Session } from "./types.js";

const VALID_EFFORTS = new Set(["low", "medium", "high"]);

/**
 * Resolve the effort level for a session.
 *
 * For child sessions (has parentSessionId), resolution chain:
 *   1. config.engines.<engine>.childEffortOverride — global cost-control knob
 *   2. session.effortLevel — COO's per-task judgment (from API body)
 *   3. employee.effortLevel — employee YAML default
 *   4. config.engines.<engine>.effortLevel — engine fallback
 *
 * For non-child sessions (COO's own), use engine effortLevel directly.
 */
export function resolveEffort(
  engineConfig: { effortLevel?: string; childEffortOverride?: string },
  session: Pick<Session, "parentSessionId" | "effortLevel">,
  employee?: Pick<Employee, "effortLevel"> | null,
): string {
  if (session.parentSessionId) {
    const override = engineConfig.childEffortOverride;
    if (override) {
      if (VALID_EFFORTS.has(override)) return override;
      logger.warn(`Invalid childEffortOverride "${override}" in engine config, skipping`);
    }

    const requested = session.effortLevel;
    if (requested) {
      if (VALID_EFFORTS.has(requested)) return requested;
      logger.warn(`Invalid effortLevel "${requested}" on session, skipping`);
    }

    const empDefault = employee?.effortLevel;
    if (empDefault) {
      if (VALID_EFFORTS.has(empDefault)) return empDefault;
      logger.warn(`Invalid effortLevel "${empDefault}" on employee, skipping`);
    }
  }

  // Non-child sessions (COO) or fallback
  const engineDefault = engineConfig.effortLevel;
  if (engineDefault && VALID_EFFORTS.has(engineDefault)) return engineDefault;
  if (engineDefault) {
    logger.warn(`Invalid effortLevel "${engineDefault}" in engine config, defaulting to "medium"`);
  }
  return "medium";
}
