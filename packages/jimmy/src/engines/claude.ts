import { spawn, type ChildProcess } from "node:child_process";
import type { InterruptibleEngine, EngineRunOpts, EngineResult, StreamDelta } from "../shared/types.js";
import { logger } from "../shared/logger.js";

interface LiveProcess {
  proc: ChildProcess;
  terminationReason: string | null;
}

/** Errors that are likely transient and worth retrying */
const TRANSIENT_PATTERNS = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /socket hang up/i,
  /503/,
  /529/,
  /overloaded/i,
  /rate limit/i,
  /spawn.*EAGAIN/i,
];

function isTransientError(stderr: string, code: number | null): boolean {
  // Exit code 1 with no meaningful stderr is often a transient crash
  if (code === 1 && stderr.trim().length < 10) return true;
  return TRANSIENT_PATTERNS.some((pat) => pat.test(stderr));
}

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

export class ClaudeEngine implements InterruptibleEngine {
  name = "claude" as const;
  private liveProcesses = new Map<string, LiveProcess>();

  kill(sessionId: string, reason = "Interrupted"): void {
    const live = this.liveProcesses.get(sessionId);
    if (!live) return;

    live.terminationReason = reason;
    logger.info(`Killing Claude process for session ${sessionId}`);
    this.signalProcess(live.proc, "SIGTERM");
    setTimeout(() => {
      if (live.proc.exitCode === null) {
        this.signalProcess(live.proc, "SIGKILL");
      }
    }, 2000);
  }

  killAll(): void {
    for (const sessionId of this.liveProcesses.keys()) {
      this.kill(sessionId, "Interrupted: gateway shutting down");
    }
  }

  isAlive(sessionId: string): boolean {
    const live = this.liveProcesses.get(sessionId);
    return !!live && !live.proc.killed && live.proc.exitCode === null;
  }

  async run(opts: EngineRunOpts): Promise<EngineResult> {
    let lastResult: EngineResult | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delayMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        logger.warn(
          `Claude engine retry ${attempt}/${MAX_RETRIES} for session ${opts.sessionId || "unknown"} after ${delayMs}ms`,
        );
        // Emit a status delta so the UI knows we're retrying
        opts.onStream?.({ type: "status", content: `Retrying (attempt ${attempt + 1}/${MAX_RETRIES + 1})...` });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const result = await this.runOnce(opts);
      lastResult = result;

      // Success or non-transient error — return immediately
      if (!result.error) return result;

      // If the process was intentionally killed, don't retry
      if (result.error.startsWith("Interrupted")) return result;

      // Check if this is a transient failure worth retrying
      if (attempt < MAX_RETRIES && isTransientError(result.error, null)) {
        logger.warn(`Transient Claude failure (attempt ${attempt + 1}): ${result.error.slice(0, 200)}`);
        continue;
      }

      // Non-transient or final attempt — return the error
      return result;
    }

    return lastResult!;
  }

  private async runOnce(opts: EngineRunOpts): Promise<EngineResult> {
    const streaming = !!opts.onStream;
    const args = ["-p", "--output-format", streaming ? "stream-json" : "json", "--verbose", "--dangerously-skip-permissions", "--chrome"];

    if (streaming) args.push("--include-partial-messages");
    if (opts.resumeSessionId) args.push("--resume", opts.resumeSessionId);
    if (opts.model) args.push("--model", opts.model);
    if (opts.effortLevel && opts.effortLevel !== "default") args.push("--effort", opts.effortLevel);
    if (opts.systemPrompt) args.push("--append-system-prompt", opts.systemPrompt);
    let prompt = opts.prompt;
    if (opts.attachments?.length) {
      prompt += "\n\nAttached files:\n" + opts.attachments.map((a) => `- ${a}`).join("\n");
    }
    // Prompt MUST come before --mcp-config because --mcp-config is variadic
    // and would consume the prompt as another config path
    args.push(prompt);

    if (opts.mcpConfigPath) args.push("--mcp-config", opts.mcpConfigPath);
    if (opts.cliFlags?.length) args.push(...opts.cliFlags);

    const bin = opts.bin || "claude";
    logger.info(
      `Claude engine (one-shot) starting: ${bin} -p --output-format ${streaming ? "stream-json" : "json"} --model ${opts.model || "default"} (resume: ${opts.resumeSessionId || "none"})`,
    );

    const cleanEnv = this.buildCleanEnv();

    return new Promise((resolve, reject) => {
      const proc = spawn(bin, args, {
        cwd: opts.cwd,
        env: cleanEnv,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });

      if (opts.sessionId) {
        this.liveProcesses.set(opts.sessionId, {
          proc,
          terminationReason: null,
        });
      }

      let stdout = "";
      let stderr = "";
      let settled = false;
      let lastResultMsg: Record<string, unknown> | null = null;
      let lineCount = 0;
      let inTool = false;

      if (streaming && opts.onStream) {
        const onStream = opts.onStream;
        let lineBuf = "";

        proc.stdout.on("data", (d: Buffer) => {
          const chunk = d.toString();
          stdout += chunk;
          lineBuf += chunk;
          const lines = lineBuf.split("\n");
          lineBuf = lines.pop() || "";
          for (const line of lines) {
            const parsed = this.processStreamLine(line, lineCount++, inTool);
            if (!parsed) continue;

            if (parsed.type === "__result") {
              lastResultMsg = parsed.msg;
              continue;
            }

            if (parsed.type === "__tool_start") {
              inTool = true;
              onStream(parsed.delta);
              continue;
            }

            if (parsed.type === "__tool_end") {
              inTool = false;
              onStream(parsed.delta);
              continue;
            }

            onStream(parsed.delta);
          }
        });
      } else {
        proc.stdout.on("data", (d: Buffer) => {
          stdout += d.toString();
        });
      }

      proc.stderr.on("data", (d: Buffer) => {
        const chunk = d.toString();
        stderr += chunk;
        for (const line of chunk.trim().split("\n").filter(Boolean)) {
          logger.debug(`[claude stderr] ${line}`);
        }
      });

      proc.on("close", (code) => {
        if (settled) return;
        settled = true;

        const terminationReason = opts.sessionId
          ? this.liveProcesses.get(opts.sessionId)?.terminationReason ?? null
          : null;
        if (opts.sessionId) {
          this.liveProcesses.delete(opts.sessionId);
        }

        logger.info(`Claude engine (one-shot) exited with code ${code}`);

        if (terminationReason) {
          resolve({
            sessionId: opts.resumeSessionId || "",
            result: "",
            error: terminationReason,
          });
          return;
        }

        if (code === 0) {
          if (streaming && lastResultMsg) {
            resolve(this.extractResult(lastResultMsg, opts.resumeSessionId));
            return;
          }

          try {
            const parsed = JSON.parse(stdout);
            // Claude --output-format json returns an array of events.
            // The last element with type "result" has the final output.
            let result: Record<string, unknown>;
            if (Array.isArray(parsed)) {
              const resultEvent = [...parsed].reverse().find((e: Record<string, unknown>) => e.type === "result");
              result = resultEvent || parsed[parsed.length - 1] || {};
            } else {
              result = parsed;
            }
            logger.info(`Claude result: session_id=${result.session_id || "none"}, result_length=${((result.result as string) || "").length}, cost=$${result.total_cost_usd || 0}`);
            resolve({
              sessionId: result.session_id as string,
              result: result.result as string,
              cost: result.total_cost_usd as number,
              durationMs: result.duration_ms as number,
              numTurns: result.num_turns as number,
            });
          } catch (err) {
            logger.error(`Failed to parse Claude output: ${err}\nstdout: ${stdout.slice(0, 500)}`);
            resolve({
              sessionId: opts.resumeSessionId || "",
              result: stdout || "(unparseable output)",
              error: `Failed to parse Claude output: ${err}`,
            });
          }
          return;
        }

        // Non-zero exit code — log full stderr for debugging
        if (stderr.trim()) {
          logger.error(`Claude stderr (exit code ${code}):\n${stderr}`);
        }

        const errMsg = `Claude exited with code ${code}${stderr.trim() ? `: ${stderr.slice(0, 500)}` : " (no stderr output)"}`;
        logger.error(errMsg);

        // Emit error delta so WebSocket clients see the failure immediately
        opts.onStream?.({ type: "error", content: errMsg });

        resolve({
          sessionId: opts.resumeSessionId || "",
          result: "",
          error: errMsg,
        });
      });

      proc.on("error", (err) => {
        if (settled) return;
        settled = true;
        if (opts.sessionId) {
          this.liveProcesses.delete(opts.sessionId);
        }
        const errMsg = `Failed to spawn Claude CLI: ${err.message}`;
        logger.error(errMsg);
        opts.onStream?.({ type: "error", content: errMsg });
        reject(new Error(errMsg));
      });
    });
  }

  private processStreamLine(
    line: string,
    lineCount: number,
    inTool: boolean,
  ):
    | { type: "__result"; msg: Record<string, unknown> }
    | { type: "__tool_start"; delta: StreamDelta }
    | { type: "__tool_end"; delta: StreamDelta }
    | { type: "delta"; delta: StreamDelta }
    | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    if (lineCount <= 5) {
      logger.debug(`[claude stream] line ${lineCount}: ${trimmed.slice(0, 300)}`);
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      logger.debug(`[claude stream] unparseable line: ${trimmed.slice(0, 100)}`);
      return null;
    }

    const msgType = String(msg.type || "");
    if (msgType === "result") {
      return { type: "__result", msg };
    }

    if (msgType === "stream_event") {
      const event = msg.event as Record<string, unknown> | undefined;
      if (!event) return null;
      const eventType = String(event.type || "");

      if (eventType === "content_block_start") {
        const block = event.content_block as Record<string, unknown> | undefined;
        if (block?.type === "tool_use") {
          const toolName = String(block.name || "unknown");
          const toolId = String(block.id || "");
          return {
            type: "__tool_start",
            delta: { type: "tool_use", content: `Using ${toolName}`, toolName, toolId },
          };
        }
      } else if (eventType === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (!delta) return null;
        if (delta.type === "text_delta" && !inTool) {
          const text = String(delta.text || "");
          if (text) {
            return { type: "delta", delta: { type: "text", content: text } };
          }
        }
      } else if (eventType === "content_block_stop" && inTool) {
        return { type: "__tool_end", delta: { type: "tool_result", content: "" } };
      }
      return null;
    }

    return null;
  }

  private extractResult(result: Record<string, unknown>, fallbackSessionId?: string): EngineResult {
    return {
      sessionId: String(result.session_id || fallbackSessionId || ""),
      result: String(result.result || ""),
      cost: typeof result.total_cost_usd === "number" ? result.total_cost_usd : undefined,
      durationMs: typeof result.duration_ms === "number" ? result.duration_ms : undefined,
      numTurns: typeof result.num_turns === "number" ? result.num_turns : undefined,
    };
  }

  private buildCleanEnv(): Record<string, string> {
    const cleanEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_")) continue;
      if (v !== undefined) cleanEnv[k] = v;
    }
    return cleanEnv;
  }

  private signalProcess(proc: ChildProcess, signal: NodeJS.Signals): void {
    if (proc.exitCode !== null) return;
    try {
      if (process.platform !== "win32" && proc.pid) {
        process.kill(-proc.pid, signal);
      } else {
        proc.kill(signal);
      }
    } catch (err) {
      logger.debug(`Failed to send ${signal} to Claude process: ${err instanceof Error ? err.message : err}`);
    }
  }
}
