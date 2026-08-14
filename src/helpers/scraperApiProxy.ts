/**
 * ScraperAPI Proxy with key rotation.
 *
 * API keys are loaded from the SCRAPER_API_KEYS env variable as a
 * comma-separated list, e.g.:
 *   SCRAPER_API_KEYS=key1,key2,key3,...
 *
 * Proxy mode dikendalikan oleh env var USE_PROXY:
 *   USE_PROXY=true  → aktifkan ScraperAPI (untuk IP yang diblokir Kuramanime)
 *   USE_PROXY=false → bypass ScraperAPI, direct fetch (default, IP Railway tidak diblok)
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

// ─── Proxy mode toggle ───────────────────────────────────────────────────────
// USE_PROXY=true  → pakai ScraperAPI (IP diblokir Kuramanime)
// USE_PROXY=false → direct fetch, bypass ScraperAPI (default)
// Dibaca sekali saat startup agar konsisten selama proses berjalan.
const USE_PROXY = process.env.USE_PROXY?.toLowerCase() === "true";

if (USE_PROXY) {
  console.info("[scraperApiProxy] Proxy mode: ENABLED (USE_PROXY=true)");
} else {
  console.info("[scraperApiProxy] Proxy mode: DISABLED (USE_PROXY=false or not set) — direct fetch");
}

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
 * Fetch a URL through ScraperAPI (static HTML, no JS rendering).
 * Automatically rotates keys on 401/403/429.
 */
export async function fetchViaProxy(targetUrl: string): Promise<string> {
  return _fetchViaProxy(targetUrl, false);
}

/**
 * Fetch a URL through ScraperAPI with JS rendering enabled.
 * Use this for pages that require JavaScript to load content (e.g. video player).
 * Counts as 5 API credits per request.
 *
 * @param waitSelector CSS selector to wait for before returning HTML (e.g. "#player source")
 * @param waitMs Additional wait time in ms after selector is found (default 0)
 */
export async function fetchViaProxyRendered(
  targetUrl: string,
  waitSelector?: string,
  waitMs?: number
): Promise<string> {
  return _fetchViaProxy(targetUrl, true, waitSelector, waitMs);
}

async function _fetchViaProxy(
  targetUrl: string,
  render: boolean,
  waitSelector?: string,
  waitMs?: number
): Promise<string> {
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

    // Build proxy URL with optional render params
    let proxyUrl = `${SCRAPER_API_BASE}?api_key=${key}&url=${encodeURIComponent(targetUrl)}&render=${render}`;
    if (render && waitSelector) {
      // wait_for_selector: ScraperAPI waits until element is present before returning HTML
      proxyUrl += `&wait_for_selector=${encodeURIComponent(waitSelector)}`;
    }
    if (render && waitMs) {
      // wait: additional ms to wait after page load
      proxyUrl += `&wait=${waitMs}`;
    }

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
  return USE_PROXY && keyPool.length > 0;
}
