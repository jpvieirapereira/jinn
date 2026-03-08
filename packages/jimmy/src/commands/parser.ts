/**
 * Generic slash command parser.
 * Detects /command patterns in message text and extracts command + args.
 */

export interface ParsedCommand {
  command: string;
  args: string[];
  /** First @mention target (without the @) */
  target?: string;
  /** Original full text */
  raw: string;
}

/**
 * Parse a slash command from the beginning of a message.
 * Returns null if the message doesn't start with a slash command.
 */
export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.split(/\s+/);
  const command = parts[0].slice(1).toLowerCase();
  if (!command) return null;

  const args = parts.slice(1);
  const mentionArg = args.find((a) => a.startsWith("@"));
  const target = mentionArg ? mentionArg.slice(1) : undefined;

  return { command, args, target, raw: trimmed };
}

/**
 * Check if a message starts with a specific slash command.
 */
export function isCommand(text: string, command: string): boolean {
  const parsed = parseCommand(text);
  return parsed?.command === command;
}

