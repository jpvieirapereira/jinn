import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { STT_MODELS_DIR, TMP_DIR } from "../shared/paths.js";
import { logger } from "../shared/logger.js";

const require = createRequire(import.meta.url);

// Resolve nodejs-whisper's internal models path via require.resolve
const whisperPkgDir = path.dirname(
  require.resolve("nodejs-whisper/package.json"),
);
const WHISPER_INTERNAL_MODELS = path.join(
  whisperPkgDir,
  "cpp",
  "whisper.cpp",
  "models",
);

const MODEL_FILES: Record<string, string> = {
  tiny: "ggml-tiny.bin",
  "tiny.en": "ggml-tiny.en.bin",
  base: "ggml-base.bin",
  "base.en": "ggml-base.en.bin",
  small: "ggml-small.bin",
  "small.en": "ggml-small.en.bin",
  medium: "ggml-medium.bin",
  "medium.en": "ggml-medium.en.bin",
  "large-v3-turbo": "ggml-large-v3-turbo.bin",
};

const EXPECTED_SIZES: Record<string, number> = {
  tiny: 75_000_000,
  "tiny.en": 75_000_000,
  base: 142_000_000,
  "base.en": 142_000_000,
  small: 466_000_000,
  "small.en": 466_000_000,
  medium: 1_500_000_000,
  "medium.en": 1_500_000_000,
  "large-v3-turbo": 1_500_000_000,
};

let downloading = false;
let downloadProgress = 0;

/**
 * Ensure ~/.jinn/models/whisper/ exists and is symlinked into nodejs-whisper's
 * internal models directory so the package can find downloaded models.
 */
export function initStt(): void {
  fs.mkdirSync(STT_MODELS_DIR, { recursive: true });

  const parentDir = path.dirname(WHISPER_INTERNAL_MODELS);
  if (!fs.existsSync(parentDir)) {
    logger.debug(
      `STT: whisper.cpp not found at ${parentDir}, skipping symlink`,
    );
    return;
  }

  const stat = fs.lstatSync(WHISPER_INTERNAL_MODELS, {
    throwIfNoEntry: false,
  });

  if (stat?.isSymbolicLink()) {
    const target = fs.readlinkSync(WHISPER_INTERNAL_MODELS);
    if (target === STT_MODELS_DIR) return; // already correct
    fs.unlinkSync(WHISPER_INTERNAL_MODELS);
  } else if (stat?.isDirectory()) {
    // Move any existing models to our persistent dir before replacing
    for (const file of fs.readdirSync(WHISPER_INTERNAL_MODELS)) {
      const src = path.join(WHISPER_INTERNAL_MODELS, file);
      const dest = path.join(STT_MODELS_DIR, file);
      if (!fs.existsSync(dest)) {
        fs.renameSync(src, dest);
      }
    }
    fs.rmSync(WHISPER_INTERNAL_MODELS, { recursive: true });
  }

  fs.symlinkSync(STT_MODELS_DIR, WHISPER_INTERNAL_MODELS, "dir");
  logger.info(
    `STT models symlinked: ${WHISPER_INTERNAL_MODELS} → ${STT_MODELS_DIR}`,
  );
}

export function getModelPath(model: string): string | null {
  const filename = MODEL_FILES[model];
  if (!filename) return null;
  const filePath = path.join(STT_MODELS_DIR, filename);
  return fs.existsSync(filePath) ? filePath : null;
}

export interface SttStatus {
  available: boolean;
  model: string | null;
  downloading: boolean;
  progress: number;
}

export function getSttStatus(configModel?: string): SttStatus {
  const model = configModel || "small";
  const modelPath = getModelPath(model);
  return {
    available: modelPath !== null,
    model: modelPath ? model : null,
    downloading,
    progress: downloadProgress,
  };
}

export async function downloadModel(
  model: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  if (downloading) throw new Error("Download already in progress");

  const filename = MODEL_FILES[model];
  if (!filename) throw new Error(`Unknown model: ${model}`);

  if (getModelPath(model)) {
    onProgress(100);
    return;
  }

  downloading = true;
  downloadProgress = 0;

  try {
    // nodejs-whisper is CJS — use dynamic import
    const mod = await import("nodejs-whisper");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodewhisper = mod.nodewhisper as any;

    // Create a minimal silent WAV to trigger download + build
    const silentWav = path.join(TMP_DIR, "stt-download-trigger.wav");
    fs.mkdirSync(TMP_DIR, { recursive: true });
    createSilentWav(silentWav);

    // Poll file size for progress reporting
    const modelFilePath = path.join(STT_MODELS_DIR, filename);
    const expectedSize = EXPECTED_SIZES[model] || 466_000_000;

    const progressInterval = setInterval(() => {
      try {
        const stat = fs.statSync(modelFilePath, {
          throwIfNoEntry: false,
        } as fs.StatSyncOptions & { throwIfNoEntry: false });
        if (stat && stat.size > 0) {
          downloadProgress = Math.min(
            95,
            Math.round(((stat.size as number) / expectedSize) * 100),
          );
          onProgress(downloadProgress);
        }
      } catch {
        // File doesn't exist yet
      }
    }, 500);

    try {
      await nodewhisper(silentWav, {
        modelName: model,
        autoDownloadModelName: model,
        whisperOptions: { outputInText: true },
        // Suppress noisy shelljs output
        logger: {
          log: (...args: unknown[]) =>
            logger.debug(`[whisper] ${args.join(" ")}`),
          debug: () => {},
          error: (...args: unknown[]) =>
            logger.error(`[whisper] ${args.join(" ")}`),
          warn: (...args: unknown[]) =>
            logger.warn(`[whisper] ${args.join(" ")}`),
          info: () => {},
        },
      });
    } finally {
      clearInterval(progressInterval);
      try {
        fs.unlinkSync(silentWav);
      } catch {}
    }

    downloadProgress = 100;
    onProgress(100);
    logger.info(`STT model '${model}' downloaded successfully`);
  } finally {
    downloading = false;
  }
}

export async function transcribe(
  audioPath: string,
  model: string,
  language?: string,
): Promise<string> {
  const modelPath = getModelPath(model);
  if (!modelPath)
    throw new Error(`Model '${model}' not found. Download it first.`);

  const mod2 = await import("nodejs-whisper");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodewhisper = mod2.nodewhisper as any;

  const result = await nodewhisper(audioPath, {
    modelName: model,
    whisperOptions: {
      outputInText: true,
      language: language || "en",
    },
    removeWavFileAfterTranscription: true,
    logger: {
      log: (...args: unknown[]) =>
        logger.debug(`[whisper] ${args.join(" ")}`),
      debug: () => {},
      error: (...args: unknown[]) =>
        logger.error(`[whisper] ${args.join(" ")}`),
      warn: (...args: unknown[]) =>
        logger.warn(`[whisper] ${args.join(" ")}`),
      info: () => {},
    },
  });

  // whisper-cli output includes timestamps like "[00:00:00.000 --> 00:00:02.000] text"
  const cleaned = result
    .replace(/\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/g, "")
    .trim();

  return cleaned;
}

/** Create a minimal 16kHz mono WAV file (0.1s of silence). */
function createSilentWav(filePath: string): void {
  const sampleRate = 16000;
  const numSamples = sampleRate / 10;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  fs.writeFileSync(filePath, buffer);
}
