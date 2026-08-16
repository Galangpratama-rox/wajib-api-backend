/**
 * dataService — wrapper generic untuk semua data fetching.
 *
 * Alur per request:
 *   1. Cek Redis cache → return kalau hit
 *   2. Singleflight: kalau ada request in-flight untuk key yang sama, tunggu hasilnya
 *   3. Jalankan provider() dengan concurrency limit + timeout
 *   4. Simpan hasil ke Redis (+ stale copy kalau allowStale=true)
 *   5. Return data
 *   6. Kalau provider gagal + allowStale=true → coba return stale copy daripada throw 500
 *
 * Provider types:
 *   "scrape" → gunakan scrapeLimit + SCRAPE_TIMEOUT_MS
 *   "api"    → gunakan apiLimit + API_TIMEOUT_MS
 */
import pLimit from "p-limit";
import { getCached, setCached, getStaleCached, TTL_SCRAPE, TTL_API, } from "./cacheService.js";
// ─── Concurrency limits (configurable via env) ────────────────────────────────
const SCRAPE_CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY) || 3;
const API_CONCURRENCY = Number(process.env.API_CONCURRENCY) || 8;
const scrapeLimit = pLimit(SCRAPE_CONCURRENCY);
const apiLimit = pLimit(API_CONCURRENCY);
console.info(`[dataService] scrapeLimit=${SCRAPE_CONCURRENCY}, apiLimit=${API_CONCURRENCY}`);
// ─── Timeouts (configurable via env, in ms) ──────────────────────────────────
const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 20_000;
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS) || 10_000;
// ─── In-flight singleflight map ──────────────────────────────────────────────
// In-memory, per-instance — cukup untuk mencegah thundering herd dalam satu process.
// Scope sementara: entry dihapus begitu promise resolve/reject.
const inFlight = new Map();
// ─── Core function ────────────────────────────────────────────────────────────
/**
 * Fetch data dengan cache Redis + singleflight + concurrency limit + timeout.
 *
 * @param cacheKey   Key unik untuk Redis dan singleflight map
 * @param provider   Async function yang mengambil data aktual
 * @param options    Konfigurasi tipe, TTL, dan stale fallback
 */
export async function fetchWithCache(cacheKey, provider, options) {
    const ttl = options.ttl ?? (options.type === "api" ? TTL_API : TTL_SCRAPE);
    const timeoutMs = options.type === "api" ? API_TIMEOUT_MS : SCRAPE_TIMEOUT_MS;
    const limiter = options.type === "api" ? apiLimit : scrapeLimit;
    const allowStale = options.allowStale ?? false;
    // ── 1. Cache hit ────────────────────────────────────────────────────────────
    const cached = await getCached(cacheKey);
    if (cached !== null) {
        return { data: cached, stale: false };
    }
    // ── 2. Singleflight: dedup concurrent requests untuk key yang sama ──────────
    const existing = inFlight.get(cacheKey);
    if (existing) {
        const data = await existing;
        return { data, stale: false };
    }
    // ── 3. Buat promise baru, daftarkan ke in-flight map ──────────────────────
    const promise = limiter(async () => {
        // Re-check cache di dalam limiter — request sebelumnya mungkin sudah mengisi cache
        const cachedAfterWait = await getCached(cacheKey);
        if (cachedAfterWait !== null) {
            return cachedAfterWait;
        }
        // Jalankan provider dengan timeout
        const result = await withTimeout(provider(), timeoutMs, cacheKey);
        // ── 4. Simpan ke Redis ─────────────────────────────────────────────────
        await setCached(cacheKey, result, ttl, allowStale);
        return result;
    }).finally(() => {
        inFlight.delete(cacheKey);
    });
    inFlight.set(cacheKey, promise);
    try {
        const data = await promise;
        return { data, stale: false };
    }
    catch (err) {
        // ── 5. Stale fallback ──────────────────────────────────────────────────
        if (allowStale) {
            const staleData = await getStaleCached(cacheKey);
            if (staleData !== null) {
                console.warn(`[dataService] provider failed for "${cacheKey}", returning stale data:`, err?.message);
                return { data: staleData, stale: true };
            }
        }
        // Tidak ada stale data → propagate error ke controller
        throw err;
    }
}
// ─── Helper: timeout wrapper ─────────────────────────────────────────────────
function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`[dataService] Timeout after ${ms}ms for "${label}"`));
        }, ms);
        promise.then((value) => { clearTimeout(timer); resolve(value); }, (err) => { clearTimeout(timer); reject(err); });
    });
}
