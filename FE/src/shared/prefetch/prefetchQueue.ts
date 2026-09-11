type QueueTask<T> = () => Promise<T>;

class PrefetchQueue {
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly queue: Array<() => void> = [];
  private activeCount = 0;

  constructor(private readonly concurrency = 2) {}

  enqueue<T>(key: string, task: QueueTask<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;

    const promise = new Promise<T>((resolve, reject) => {
      const run = () => {
        this.activeCount += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.pending.delete(key);
            this.activeCount -= 1;
            this.runNext();
          });
      };

      if (this.activeCount < this.concurrency) {
        run();
      } else {
        this.queue.push(run);
      }
    });

    this.pending.set(key, promise);
    return promise;
  }

  getPending<T>(key: string): Promise<T> | undefined {
    return this.pending.get(key) as Promise<T> | undefined;
  }

  private runNext() {
    if (this.activeCount >= this.concurrency) return;
    const next = this.queue.shift();
    if (next) next();
  }
}

export const prefetchQueue = new PrefetchQueue(2);

export function canPrefetch() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  const connection = typeof navigator !== "undefined"
    ? (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    : undefined;
  if (connection?.saveData) return false;
  return connection?.effectiveType !== "2g" && connection?.effectiveType !== "slow-2g";
}
