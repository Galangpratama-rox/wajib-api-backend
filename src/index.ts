import { clientCache } from "@middlewares/cache.js";
import appConfig from "@configs/app.config.js";
import express from "express";
import errorHandler from "@middlewares/errorHandler.js";
import otakudesuRouter from "@routes/otakudesu.routes.js";
import samehadakuRouter from "@routes/samehadaku.routes.js";
import kuramanimeRouter from "@routes/kuramanime.routes.js";
import komiknesiaRouter from "@routes/komiknesia.routes.js";
import setPayload from "@helpers/setPayload.js";
import { getCacheStats } from "@services/cacheService.js";
import redisClient, { isReady } from "@utils/redisClient.js";
import cors from "cors";

// ─── Side-effect: inisialisasi Redis client ──────────────────────────────────
// Import cukup untuk memicu koneksi saat startup. Modul lain yang butuh Redis
// mengimport dari @utils/redisClient secara langsung.
import "@utils/redisClient.js";
const { PORT } = appConfig;
const app = express();

// ─── Process-level safety net ────────────────────────────────────────────────
// Mencegah unhandledRejection / uncaughtException (mis. ETIMEDOUT dari fetch
// yang tidak di-catch) langsung membunuh container Railway.
process.on("unhandledRejection", (reason) => {
  // Log tapi JANGAN process.exit — biarkan container tetap berjalan.
  // Error per-request tidak boleh membunuh seluruh proses.
  console.error("[process] unhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  // Untuk exception di luar async context (sangat jarang setelah perbaikan di atas).
  // Log saja; Railway akan restart kalau proses memang sudah tidak bisa recover.
  console.error("[process] uncaughtException:", err?.message ?? err, err?.stack ?? "");
});
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors());
app.use(clientCache(1));

app.get("/", (req, res) => {
  const routes: IRouteData[] = [
    {
      method: "GET",
      path: "/otakudesu",
      description: "Otakudesu",
      pathParams: [],
      queryParams: [],
    },
    {
      method: "GET",
      path: "/kuramanime",
      description: "Kuramanime",
      pathParams: [],
      queryParams: [],
    },
    {
      method: "GET",
      path: "/komiknesia",
      description: "Komiknesia",
      pathParams: [],
      queryParams: [],
    },
    {
      method: "GET",
      path: "/cache/stats",
      description: "Redis cache statistics (debug)",
      pathParams: [],
      queryParams: [],
    },
  ];

  res.json(setPayload(res, { data: { routes } }));
});

// ─── Cache debug endpoint ────────────────────────────────────────────────────
app.get("/cache/stats", async (req, res, next) => {
  try {
    const stats = await getCacheStats();
    res.json(setPayload(res, { data: stats ?? { keyCount: 0, redisStatus: "unavailable" } }));
  } catch (err) {
    next(err);
  }
});

// DELETE /cache/flush?prefix=xxx  — hapus semua key (atau per prefix)
// Contoh: DELETE /cache/flush             → flush semua key
//         DELETE /cache/flush?prefix=komiknesia  → hapus key yg diawali "komiknesia"
app.delete("/cache/flush", async (req, res, next) => {
  try {
    if (!isReady() || !redisClient) {
      res.status(503).json(setPayload(res, { data: { deleted: 0, message: "Redis not available" } }));
      return;
    }
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix.trim() : "";
    let deleted = 0;
    if (prefix) {
      // Hapus hanya key yang match prefix (scan untuk keamanan, hindari KEYS di prod)
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== "0");
    } else {
      // Flush semua
      await redisClient.flushdb();
      deleted = -1; // -1 = semua
    }
    res.json(setPayload(res, { data: { deleted, prefix: prefix || "*", message: "Cache flushed" } }));
  } catch (err) {
    next(err);
  }
});

app.use("/otakudesu", otakudesuRouter);
app.use("/kuramanime", kuramanimeRouter);
app.use("/samehadaku", samehadakuRouter);
app.use("/komiknesia", komiknesiaRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`server is running on http://localhost:${PORT}`);
});
