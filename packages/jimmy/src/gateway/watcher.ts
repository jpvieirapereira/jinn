import fs from "node:fs";
import path from "node:path";
import { watch, type FSWatcher } from "chokidar";
import { CONFIG_PATH, CRON_JOBS, ORG_DIR, SKILLS_DIR, CLAUDE_SKILLS_DIR, AGENTS_SKILLS_DIR } from "../shared/paths.js";
import { logger } from "../shared/logger.js";

export interface WatcherCallbacks {
  onConfigReload: () => void;
  onCronReload: () => void;
  onOrgChange: () => void;
}

let watchers: FSWatcher[] = [];

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

/**
 * Sync symlinks in .claude/skills/ and .agents/skills/ to match skills/.
 * Each skill directory gets a relative symlink: ../../skills/<name>
 */
export function syncSkillSymlinks(): void {
  const targetDirs = [CLAUDE_SKILLS_DIR, AGENTS_SKILLS_DIR];

  // Get current skill directories
  let skillNames: string[] = [];
  if (fs.existsSync(SKILLS_DIR)) {
    skillNames = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  }

  for (const targetDir of targetDirs) {
    fs.mkdirSync(targetDir, { recursive: true });

    // Remove stale symlinks
    const existing = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of existing) {
      if (!skillNames.includes(entry.name)) {
        const linkPath = path.join(targetDir, entry.name);
        try {
          fs.unlinkSync(linkPath);
          logger.debug(`Removed stale skill symlink: ${linkPath}`);
        } catch {
          // ignore
        }
      }
    }

    // Create missing symlinks
    for (const name of skillNames) {
      const linkPath = path.join(targetDir, name);
      const relTarget = path.join("..", "..", "skills", name);
      if (!fs.existsSync(linkPath)) {
        try {
          fs.symlinkSync(relTarget, linkPath);
          logger.debug(`Created skill symlink: ${linkPath} -> ${relTarget}`);
        } catch {
          // ignore — may fail on some platforms
        }
      }
    }
  }
}

export function startWatchers(callbacks: WatcherCallbacks): void {
  const DEBOUNCE_MS = 500;

  const configWatcher = watch(CONFIG_PATH, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  });
  configWatcher.on(
    "change",
    debounce(() => {
      logger.info("config.yaml changed, reloading...");
      callbacks.onConfigReload();
    }, DEBOUNCE_MS),
  );

  const cronWatcher = watch(CRON_JOBS, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  });
  cronWatcher.on(
    "change",
    debounce(() => {
      logger.info("cron/jobs.json changed, reloading...");
      callbacks.onCronReload();
    }, DEBOUNCE_MS),
  );

  const orgWatcher = watch(ORG_DIR, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  });
  orgWatcher.on(
    "all",
    debounce(() => {
      logger.info("org/ directory changed, reloading...");
      callbacks.onOrgChange();
    }, DEBOUNCE_MS),
  );

  // Watch skills/ directory for added/removed skill folders → sync symlinks
  const skillsWatcher = watch(SKILLS_DIR, {
    ignoreInitial: true,
    depth: 0,
  });
  skillsWatcher.on(
    "all",
    debounce(() => {
      logger.info("skills/ directory changed, syncing symlinks...");
      syncSkillSymlinks();
    }, DEBOUNCE_MS),
  );

  watchers = [configWatcher, cronWatcher, orgWatcher, skillsWatcher];
  logger.info("File watchers started");
}

export async function stopWatchers(): Promise<void> {
  await Promise.all(watchers.map((w) => w.close()));
  watchers = [];
  logger.info("File watchers stopped");
}
