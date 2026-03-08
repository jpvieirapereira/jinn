import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const JIMMY_HOME = path.join(os.homedir(), ".jimmy");
export const CONFIG_PATH = path.join(JIMMY_HOME, "config.yaml");
export const SESSIONS_DB = path.join(JIMMY_HOME, "sessions", "registry.db");
export const CRON_JOBS = path.join(JIMMY_HOME, "cron", "jobs.json");
export const CRON_RUNS = path.join(JIMMY_HOME, "cron", "runs");
export const ORG_DIR = path.join(JIMMY_HOME, "org");
export const SKILLS_DIR = path.join(JIMMY_HOME, "skills");
export const DOCS_DIR = path.join(JIMMY_HOME, "docs");
export const LOGS_DIR = path.join(JIMMY_HOME, "logs");
export const TMP_DIR = path.join(JIMMY_HOME, "tmp");
export const PID_FILE = path.join(JIMMY_HOME, "gateway.pid");
export const CLAUDE_SKILLS_DIR = path.join(JIMMY_HOME, ".claude", "skills");
export const AGENTS_SKILLS_DIR = path.join(JIMMY_HOME, ".agents", "skills");
export const TEMPLATE_DIR = path.join(__dirname, "..", "..", "..", "template");
