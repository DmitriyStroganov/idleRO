/**
 * Resource Registry — lazy-loads and caches .spr/.act file pairs.
 *
 * L1 cache: in-memory Map (instant, lost on reload).
 * Files are fetched from `sprites/raw/{key}.spr` and `{key}.act`.
 */

export interface SprActData {
  spr: ArrayBuffer;
  act: ArrayBuffer;
}

class ResourceRegistryImpl {
  private cache = new Map<string, SprActData>();
  private pending = new Map<string, Promise<SprActData>>();

  /**
   * Fetch a .spr/.act pair by logical key. Cached after first fetch.
   * @param key  path without extension, e.g. "weapon/novice_dagger"
   */
  async fetch(key: string): Promise<SprActData> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const inflight = this.pending.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      const [spr, act] = await Promise.all([
        fetch(`sprites/raw/${key}.spr`).then(r => r.arrayBuffer()),
        fetch(`sprites/raw/${key}.act`).then(r => r.arrayBuffer()),
      ]);
      const data = { spr, act };
      this.cache.set(key, data);
      this.pending.delete(key);
      return data;
    })();

    this.pending.set(key, promise);
    return promise;
  }

  /** Check if a key is already cached (no fetch needed). */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** Preload multiple keys in parallel. */
  async preload(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k => this.fetch(k).catch(() => {})));
  }

  /** Clear cache (e.g. on class change). */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }
}

export const registry = new ResourceRegistryImpl();
