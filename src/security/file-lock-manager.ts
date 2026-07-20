export class FileLockManager {
  private readonly queues = new Map<string, Promise<unknown>>();

  async withFileLock<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(filePath) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.queues.set(filePath, queued);

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (this.queues.get(filePath) === queued) {
        this.queues.delete(filePath);
      }
    }
  }
}
