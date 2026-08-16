/**
 * Redis client singleton.
 *
 * Konek ke REDIS_URL dari env. Kalau REDIS_URL tidak di-set,
 * client tetap dibuat tapi semua operasi akan di-skip oleh cacheService
 * (mode no-cache / in-memory LRU saja yang aktif).
 *
 * Error handling:
 * - Event 'error' di-log tapi TIDAK pernah melempar exception.
 * - Kalau Redis down, ioredis akan retry otomatis (exponential backoff).
 * - isReady() dipakai oleh cacheService untuk guard sebelum operasi.
 */
import { Redis } from "ioredis";
const REDIS_URL = process.env.REDIS_URL;
// Buat client hanya kalau REDIS_URL tersedia.
// Kalau tidak ada, seluruh stack tetap jalan tanpa Redis (LRU in-memory only).
let client = null;
if (REDIS_URL) {
    client = new Redis(REDIS_URL, {
        // Timeout koneksi awal — jangan hang selamanya saat Railway cold start
        connectTimeout: 8_000,
        // Maksimum retry sebelum ioredis menyerah sementara dan emit 'error'
        maxRetriesPerRequest: 2,
        // Kalau koneksi putus, reconnect dengan cap 10 detik
        retryStrategy(times) {
            const delay = Math.min(times * 200, 10_000);
            return delay;
        },
        // Jangan throw kalau Redis tidak bisa dijangkau pada operasi biasa
        lazyConnect: false,
        enableOfflineQueue: false, // tolak command langsung kalau sedang disconnect
    });
    client.on("connect", () => {
        console.info("[Redis] Connected");
    });
    client.on("ready", () => {
        console.info("[Redis] Ready");
    });
    client.on("error", (err) => {
        // Hanya log — jangan re-throw, jangan crash proses
        console.error("[Redis] Error:", err.message);
    });
    client.on("close", () => {
        console.warn("[Redis] Connection closed — will retry");
    });
    client.on("reconnecting", () => {
        console.info("[Redis] Reconnecting...");
    });
}
else {
    console.warn("[Redis] REDIS_URL not set — running without Redis cache (LRU only)");
}
/** true kalau Redis client ada dan statusnya 'ready' */
export function isReady() {
    return client !== null && client.status === "ready";
}
export default client;
