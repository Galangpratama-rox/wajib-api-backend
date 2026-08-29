/**
 * Cache service terpusat berbasis Redis.
 *
 * Semua operasi bersifat fire-safe: kalau Redis down atau operasi gagal,
 * fungsi akan return null/false dan pemanggil melanjutkan tanpa cache
 * (graceful degradation), tidak pernah throw ke caller.
 *
 * TTL defaults (dari env, dalam detik):
 *   CACHE_TTL_SCRAPE  : untuk HTML scraping           default 600  (10 menit)
 *   CACHE_TTL_API     : untuk direct REST API call     default 300  (5 menit)
 *
 * Stale key convention:
 *   Key stale disimpan dengan suffix ":stale" tanpa TTL (persist sampai dihapus manual).
 *   Dipakai sebagai last-resort fallback kalau provider gagal total.
 */

import redisClient, { isReady } from "@utils/redisClient.js";

// ─── TTL config ───────────────────────────────────────────────────────────────
export const TTL_SCRAPE = Number(process.env.CACHE_TTL_SCRAPE) || 600;   // 10 menit
export const TTL_API    = Number(process.env.CACHE_TTL_API)    || 300;    // 5 menit
export const TTL_DEFAULT = Number(process.env.CACHE_TTL_SECONDS) || TTL_SCRAPE;

const STALE_SUFFIX = ":stale";

// ─── Core operations ─────────────────────────────────────────────────────────

/**
 * Ambil nilai dari Redis. Return null kalau tidak ada atau Redis down.
 * Juga skip (return null) kalau data tersimpan masih dalam format encrypted
 * lama { encrypted: true, data, time } — supaya otomatis di-refresh.
 */
export async function getCached<T = unknown>(key: string): Promise<T | null> {
  if (!isReady()) return null;
  try {
    const raw = await redisClient!.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Tolak cache lama yang berisi encrypted response mentah
    if (parsed && typeof parsed === "object" && parsed.encrypted === true && parsed.data && parsed.time) {
      console.warn(`[cacheService] Stale encrypted cache detected for "${key}", invalidating`);
      await redisClient!.del(key, key + ":stale").catch(() => {});
      return null;
    }
    return parsed as T;
  } catch (err) {
    console.error("[cacheService] getCached error:", (err as Error).message);
    return null;
  }
}

/**
 * Simpan nilai ke Redis dengan TTL (detik).
 * Juga simpan salinan stale (tanpa TTL) untuk fallback.
 */
export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds: number = TTL_DEFAULT,
  storeStale = false
): Promise<void> {
  if (!isReady()) return;
  try {
    const serialized = JSON.stringify(value);
    await redisClient!.set(key, serialized, "EX", ttlSeconds);
    if (storeStale) {
      // Simpan stale copy tanpa TTL — untuk fallback kalau provider gagal
      await redisClient!.set(key + STALE_SUFFIX, serialized);
    }
  } catch (err) {
    console.error("[cacheService] setCached error:", (err as Error).message);
  }
}

/**
 * Ambil stale copy (salinan terakhir yang tersimpan tanpa TTL).
 * Return null kalau tidak ada atau masih format encrypted lama.
 */
export async function getStaleCached<T = unknown>(key: string): Promise<T | null> {
  if (!isReady()) return null;
  try {
    const raw = await redisClient!.get(key + STALE_SUFFIX);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Tolak stale cache yang masih encrypted mentah
    if (parsed && typeof parsed === "object" && parsed.encrypted === true && parsed.data && parsed.time) {
      await redisClient!.del(key + STALE_SUFFIX).catch(() => {});
      return null;
    }
    return parsed as T;
  } catch (err) {
    console.error("[cacheService] getStaleCached error:", (err as Error).message);
    return null;
  }
}

/**
 * Hapus key dan stale copy-nya.
 */
export async function deleteCached(key: string): Promise<void> {
  if (!isReady()) return;
  try {
    await redisClient!.del(key, key + STALE_SUFFIX);
  } catch (err) {
    console.error("[cacheService] deleteCached error:", (err as Error).message);
  }
}

/**
 * Statistik Redis untuk endpoint debug.
 * Return null kalau Redis tidak tersedia.
 */
export async function getCacheStats(): Promise<{
  keyCount: number;
  redisStatus: string;
} | null> {
  if (!redisClient) {
    return { keyCount: 0, redisStatus: "not_configured" };
  }
  if (!isReady()) {
    return { keyCount: 0, redisStatus: redisClient.status };
  }
  try {
    const keyCount = await redisClient.dbsize();
    return { keyCount, redisStatus: redisClient.status };
  } catch (err) {
    console.error("[cacheService] getCacheStats error:", (err as Error).message);
    return { keyCount: 0, redisStatus: "error" };
  }
}
