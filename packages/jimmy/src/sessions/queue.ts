export class SessionQueue {
  private queues = new Map<string, Promise<void>>();
  /** Track which sessions are currently running */
  private running = new Set<string>();
  /** Track how many tasks exist per session key, including the active one. */
  private pending = new Map<string, number>();

  /**
   * Check if a session is currently running.
   */
  isRunning(sessionKey: string): boolean {
    return this.running.has(sessionKey);
  }

  getPendingCount(sessionKey: string): number {
    const total = this.pending.get(sessionKey) || 0;
    return this.running.has(sessionKey) ? Math.max(0, total - 1) : total;
  }

  getTransportState(sessionKey: string, status?: "idle" | "running" | "error" | "interrupted"): "idle" | "queued" | "running" | "error" | "interrupted" {
    if (status === "error") return "error";
    if (status === "interrupted") return "interrupted";
    if (this.running.has(sessionKey)) return "running";
    if (this.getPendingCount(sessionKey) > 0) return "queued";
    return status === "running" ? "running" : "idle";
  }

  /**
   * Enqueue a task for a session. Tasks are serialized per session key.
   */
  async enqueue(sessionKey: string, fn: () => Promise<void>): Promise<void> {
    this.pending.set(sessionKey, (this.pending.get(sessionKey) || 0) + 1);
    const prev = this.queues.get(sessionKey) || Promise.resolve();
    const next = prev.then(
      async () => {
        this.running.add(sessionKey);
        try {
          await fn();
        } finally {
          this.running.delete(sessionKey);
          this.decrementPending(sessionKey);
        }
      },
      async () => {
        this.running.add(sessionKey);
        try {
          await fn();
        } finally {
          this.running.delete(sessionKey);
          this.decrementPending(sessionKey);
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

  private decrementPending(sessionKey: string): void {
    const remaining = (this.pending.get(sessionKey) || 1) - 1;
    if (remaining <= 0) {
      this.pending.delete(sessionKey);
      return;
    }
    this.pending.set(sessionKey, remaining);
  }
}
