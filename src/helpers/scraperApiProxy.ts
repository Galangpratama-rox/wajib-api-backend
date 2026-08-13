/**
 * ScraperAPI Proxy with key rotation.
 *
 * API keys are loaded from the SCRAPER_API_KEYS env variable as a
 * comma-separated list, e.g.:
 *   SCRAPER_API_KEYS=key1,key2,key3,...
 *
 * Rotation strategy:
 *   - Round-robin across all keys.
 *   - If a key returns 403/401/429, it is marked as exhausted and the next
 *     key is tried immediately (up to all available keys).
 *   - Exhausted keys are re-enabled after COOLDOWN_MS (default 5 min) so
 *     they can be retried again later.
 */

const SCRAPER_API_BASE = "http://api.scraperapi.com";
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

interface KeyState {
  key: string;
  exhaustedAt: number | null; // timestamp or null if healthy
}

// ─── Key pool ────────────────────────────────────────────────────────────────

function loadKeys(): KeyState[] {
  const raw = process.env.SCRAPER_API_KEYS ?? "";
  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keys.length === 0) return [];

  return keys.map((key) => ({ key, exhaustedAt: null }));
}

const keyPool: KeyState[] = loadKeys();
let currentIndex = 0;

function getNextKey(): string | null {
  if (keyPool.length === 0) return null;

  const now = Date.now();

  // Re-enable keys that have cooled down
  for (const ks of keyPool) {
    if (ks.exhaustedAt !== null && now - ks.exhaustedAt >= COOLDOWN_MS) {
      ks.exhaustedAt = null;
    }
  }

  // Try up to keyPool.length times to find a healthy key
  for (let i = 0; i < keyPool.length; i++) {
    const idx = (currentIndex + i) % keyPool.length;
    const ks = keyPool[idx];
    if (ks && ks.exhaustedAt === null) {
      // Advance round-robin pointer for next call
      currentIndex = (idx + 1) % keyPool.length;
      return ks.key;
    }
  }

  return null; // All keys exhausted
}

function markKeyExhausted(key: string): void {
  const ks = keyPool.find((k) => k.key === key);
  if (ks !== undefined) {
    ks.exhaustedAt = Date.now();
    console.warn(`[ScraperAPI] Key ...${key.slice(-6)} marked exhausted. ${keyPool.filter((k) => k.exhaustedAt === null).length}/${keyPool.length} keys remaining.`);
  }
}

// ─── Public fetch via ScraperAPI ─────────────────────────────────────────────

/**
 * Fetch a URL through ScraperAPI.
 * Automatically rotates keys on 401/403/429.
 * Throws if all keys are exhausted or no keys are configured.
 */
export async function fetchViaProxy(targetUrl: string): Promise<string> {
  if (keyPool.length === 0) {
    throw new Error("ScraperAPI: no keys configured (set SCRAPER_API_KEYS env variable)");
  }

  const triedKeys = new Set<string>();

  while (true) {
    const key = getNextKey();

    if (!key || triedKeys.has(key)) {
      throw new Error("ScraperAPI: all keys exhausted, cannot fetch " + targetUrl);
    }

    triedKeys.add(key);

    const proxyUrl = `${SCRAPER_API_BASE}?api_key=${key}&url=${encodeURIComponent(targetUrl)}&render=false`;

    try {
      const res = await fetch(proxyUrl);

      // Key-level errors → rotate
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        markKeyExhausted(key);
        continue;
      }

      if (!res.ok) {
        throw new Error(`ScraperAPI: upstream returned ${res.status} for ${targetUrl}`);
      }

      return res.text();
    } catch (err) {
      // Network error on this key → try next
      if (err instanceof Error && err.message.includes("ScraperAPI: upstream")) {
        throw err;
      }
      markKeyExhausted(key);
      continue;
    }
  }
}

export function hasProxyKeys(): boolean {
  return keyPool.length > 0;
}
