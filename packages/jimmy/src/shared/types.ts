export type StreamDeltaType = "text" | "tool_use" | "tool_result" | "status" | "error";

export interface StreamDelta {
  type: StreamDeltaType;
  content: string;
  toolName?: string;
  toolId?: string;
}

export interface Engine {
  name: string;
  run(opts: EngineRunOpts): Promise<EngineResult>;
}

export interface InterruptibleEngine extends Engine {
  /** Kill a running engine process for a specific Jinn session. */
  kill(sessionId: string, reason?: string): void;
  /** Check if a live engine process is still running for this session. */
  isAlive(sessionId: string): boolean;
  /** Kill all live engine processes during gateway shutdown. */
  killAll(): void;
}

export function isInterruptibleEngine(engine: Engine): engine is InterruptibleEngine {
  return "kill" in engine && "isAlive" in engine && "killAll" in engine;
}

export interface EngineRunOpts {
  prompt: string;
  resumeSessionId?: string;
  systemPrompt?: string;
  cwd: string;
  bin?: string;
  model?: string;
  effortLevel?: string;
  attachments?: string[];
  /** Extra CLI flags to pass to the engine binary (e.g. ["--chrome"]) */
  cliFlags?: string[];
  onStream?: (delta: StreamDelta) => void;
  /** Unique Jinn session ID for tracking the spawned process. */
  sessionId?: string;
}

export interface EngineResult {
  sessionId: string;
  result: string;
  cost?: number;
  durationMs?: number;
  numTurns?: number;
  error?: string;
}

export interface Connector {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(target: Target, text: string): Promise<string | void>;
  addReaction(target: Target, emoji: string): Promise<void>;
  removeReaction(target: Target, emoji: string): Promise<void>;
  editMessage(target: Target, text: string): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => void): void;
}

export interface IncomingMessage {
  source: string;
  channel: string;
  thread?: string;
  user: string;
  userId: string;
  text: string;
  attachments: Attachment[];
  raw: any;
}

export interface Attachment {
  name: string;
  url: string;
  mimeType: string;
  localPath?: string;
}

export interface Target {
  channel: string;
  thread?: string;
  messageTs?: string;
}

export interface Session {
  id: string;
  engine: string;
  engineSessionId: string | null;
  source: string;
  sourceRef: string;
  employee: string | null;
  model: string | null;
  title: string | null;
  parentSessionId: string | null;
  status: "idle" | "running" | "error";
  createdAt: string;
  lastActivity: string;
  lastError: string | null;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  timezone?: string;
  engine?: string;
  model?: string;
  employee?: string;
  prompt: string;
  delivery?: CronDelivery;
}

export interface CronDelivery {
  connector: string;
  channel: string;
}

export interface Employee {
  name: string;
  displayName: string;
  department: string;
  rank: "executive" | "manager" | "senior" | "employee";
  engine: string;
  model: string;
  persona: string;
  /** Emoji icon for this employee (shown in sidebar, org chart, etc.) */
  emoji?: string;
  /** Extra CLI flags passed to the engine (e.g. ["--chrome"]) */
  cliFlags?: string[];
}

export interface Department {
  name: string;
  displayName: string;
  description: string;
}

export interface WebConnectorConfig {}

export interface PortalConfig {
  portalName?: string;
  operatorName?: string;
  language?: string;
}

export interface JinnConfig {
  jinn?: { version?: string };
  gateway: { port: number; host: string; streaming?: boolean };
  engines: {
    default: "claude" | "codex";
    claude: { bin: string; model: string; effortLevel?: string };
    codex: { bin: string; model: string; effortLevel?: string };
  };
  connectors: Record<string, any> & { web?: WebConnectorConfig };
  logging: { file: boolean; stdout: boolean; level: string };
  cron?: { defaultDelivery?: CronDelivery };
  portal?: PortalConfig;
}
