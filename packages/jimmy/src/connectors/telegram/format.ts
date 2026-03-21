const TELEGRAM_MAX_LENGTH = 4096;

/**
 * Convert standard markdown to Telegram MarkdownV2-compatible format.
 * Handles headings, bold, italic, strikethrough, links, and bullet lists.
 * Preserves code blocks and inline code untouched.
 */
export function markdownToTelegram(text: string): string {
  // Split text into code and non-code segments to protect code from conversion
  const segments = text.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return segments
    .map((segment, i) => {
      // Odd indices are code matches — leave them untouched
      if (i % 2 === 1) return segment;

      return (
        segment
          // Headings: ## text → bold (placeholder to avoid italic capture)
          .replace(/^(#{1,6})\s+(.+)$/gm, (_match, _hashes, content) => `\x00BOLD${content}\x00BOLD`)
          // Bold: **text** or __text__ → placeholder
          .replace(/\*\*(.+?)\*\*/g, "\x00BOLD$1\x00BOLD")
          .replace(/__(.+?)__/g, "\x00BOLD$1\x00BOLD")
          // Italic: *text* → _text_ (after bold is extracted)
          .replace(/\*(.+?)\*/g, "_$1_")
          // Restore bold markers → *text*
          .replace(/\x00BOLD(.+?)\x00BOLD/g, "*$1*")
          // Strikethrough: ~~text~~ → ~text~
          .replace(/~~(.+?)~~/g, "~$1~")
          // Bullet lists: - item or * item → • item
          .replace(/^(\s*)[-*]\s+/gm, "$1• ")
      );
    })
    .join("");
}

/**
 * Split text into chunks that fit within Telegram's message length limit (4096 chars).
 * Converts markdown to Telegram format before chunking.
 */
export function formatResponse(text: string): string[] {
  const converted = markdownToTelegram(text);

  if (converted.length <= TELEGRAM_MAX_LENGTH) {
    return [converted];
  }

  const chunks: string[] = [];
  let remaining = converted;

  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline boundary within the limit
    let splitIndex = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf(" ", TELEGRAM_MAX_LENGTH);
    }
    if (splitIndex <= 0) {
      splitIndex = TELEGRAM_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
