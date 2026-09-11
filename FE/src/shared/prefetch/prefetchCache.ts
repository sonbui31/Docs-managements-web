type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class PrefetchCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  deleteByPrefix(prefix: string) {
    Array.from(this.entries.keys())
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => this.entries.delete(key));
  }

  clear() {
    this.entries.clear();
  }
}

export const prefetchCache = new PrefetchCache();
