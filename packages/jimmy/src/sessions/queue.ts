export class SessionQueue {
  private queues = new Map<string, Promise<void>>();
  /** Track which sessions are currently running */
  private running = new Set<string>();

  /**
   * Check if a session is currently running.
   */
  isRunning(sessionKey: string): boolean {
    return this.running.has(sessionKey);
  }

  /**
   * Enqueue a task for a session. Tasks are serialized per session key.
   */
  async enqueue(sessionKey: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.queues.get(sessionKey) || Promise.resolve();
    const next = prev.then(
      async () => {
        this.running.add(sessionKey);
        try {
          await fn();
        } finally {
          this.running.delete(sessionKey);
        }
      },
      async () => {
        this.running.add(sessionKey);
        try {
          await fn();
        } finally {
          this.running.delete(sessionKey);
        }
      },
    );
    this.queues.set(sessionKey, next);
    void next.finally(() => {
      if (this.queues.get(sessionKey) === next) {
        this.queues.delete(sessionKey);
      }
    });
    return next;
  }
}
