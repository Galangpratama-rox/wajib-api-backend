import otakudesuScraper from "../scrapers/otakudesu.scraper.js";
import otakudesuParser from "../parsers/otakudesu.parser.js";
import otakudesuConfig from "../configs/otakudesu.config.js";
import otakudesuSchema from "../schemas/otakudesu.schema.js";
import setPayload from "../helpers/setPayload.js";
import { scrapeAndParse } from "../services/htmlScraperProvider.js";
import { fetchWithCache } from "../services/dataService.js";
import * as v from "valibot";
import https from "https";
import http from "http";
const { baseUrl } = otakudesuConfig;
// Opsi default untuk semua endpoint Otakudesu (HTML scraping)
const SCRAPE_OPTS = {
    type: "scrape",
    allowStale: true,
};
// Episode/server berisi URL streaming yang berumur pendek — jangan return stale
const EPISODE_OPTS = {
    type: "scrape",
    allowStale: false,
    ttl: 300, // 5 menit — lebih pendek karena URL server sering berubah
};
const otakudesuController = {
    async getRoot(req, res, next) {
        const routes = [
            {
                method: "GET",
                path: "/otakudesu/home",
                description: "Halaman utama",
                pathParams: [],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/otakudesu/schedule",
                description: "Jadwal rilis",
                pathParams: [],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/otakudesu/anime",
                description: "Daftar semua anime",
                pathParams: [],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/otakudesu/genre",
                description: "Daftar semua genre",
                pathParams: [],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/otakudesu/ongoing",
                description: "Daftar anime sedang tayang",
                pathParams: [],
                queryParams: [{ key: "page", value: "string", defaultValue: "1", required: false }],
            },
            {
                method: "GET",
                path: "/otakudesu/completed",
                description: "Daftar anime selesai",
                pathParams: [],
                queryParams: [{ key: "page", value: "string", defaultValue: "1", required: false }],
            },
            {
                method: "GET",
                path: "/otakudesu/search",
                description: "Daftar anime berdasarkan pencarian",
                pathParams: [],
                queryParams: [{ key: "q", value: "string", defaultValue: null, required: true }],
            },
            {
                method: "GET",
                path: "/otakudesu/genre/{genreId}",
                description: "Daftar anime berdasarkan genre",
                pathParams: [{ key: "genreId", value: "string", defaultValue: null, required: true }],
                queryParams: [{ key: "page", value: "string", defaultValue: "1", required: false }],
            },
            {
                method: "GET",
                path: "/otakudesu/batch/{batchId}",
                description: "Batch anime berdasarkan id batch",
                pathParams: [{ key: "batchId", value: "string", defaultValue: null, required: true }],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/otakudesu/anime/{animeId}",
                description: "Detail anime berdasarkan id anime",
                pathParams: [{ key: "animeId", value: "string", defaultValue: null, required: true }],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/otakudesu/episode/{episodeId}",
                description: "Detail episode berdasarkan id episode",
                pathParams: [{ key: "episodeId", value: "string", defaultValue: null, required: true }],
                queryParams: [],
            },
            {
                method: "GET | POST",
                path: "/otakudesu/server/{serverId}",
                description: 'Link video berdasarkan id server. Response berisi "url" (iframe desustream), "videoUrl" (direct mp4/video URL siap pakai di <video>), dan "type" (odstream | ondesuhd | unknown)',
                pathParams: [{ key: "serverId", value: "string", defaultValue: null, required: true }],
                queryParams: [],
            },
        ];
        res.json(setPayload(res, { message: "Status: OK 🚀", data: { routes } }));
    },
    async getHome(req, res, next) {
        try {
            const cacheKey = "otakudesu:home";
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, "/", (doc) => otakudesuParser.parseHome(doc), {
                ref: "https://google.com/",
            }), SCRAPE_OPTS);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data }));
        }
        catch (error) {
            next(error);
        }
    },
    async getSchedule(req, res, next) {
        try {
            const cacheKey = "otakudesu:schedule";
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, "/jadwal-rilis/", (doc) => otakudesuParser.parseSchedules(doc)), { ...SCRAPE_OPTS, ttl: 3600 } // jadwal jarang berubah, 1 jam
            );
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { scheduleList: data } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getAllAnimes(req, res, next) {
        try {
            const cacheKey = "otakudesu:all-animes";
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, "/anime-list/", (doc) => otakudesuParser.parseAllAnimes(doc), { sanitize: true }), { ...SCRAPE_OPTS, ttl: 3600 });
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { list: data } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getAllGenres(req, res, next) {
        try {
            const cacheKey = "otakudesu:genres";
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, "/genre-list/", (doc) => otakudesuParser.parseAllGenres(doc)), { ...SCRAPE_OPTS, ttl: 3600 });
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { genreList: data } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getOngoingAnimes(req, res, next) {
        try {
            const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
            const pathname = page > 1 ? `/ongoing-anime/page/${page}/` : "/ongoing-anime/";
            const cacheKey = `otakudesu:ongoing:${page}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, pathname, (doc) => ({
                animeList: otakudesuParser.parseOngoingAnimes(doc),
                pagination: otakudesuParser.parsePagination(doc),
            })), SCRAPE_OPTS);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { animeList: data.animeList }, pagination: data.pagination }));
        }
        catch (error) {
            next(error);
        }
    },
    async getCompletedAnimes(req, res, next) {
        try {
            const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
            const pathname = page > 1 ? `/complete-anime/page/${page}/` : "/complete-anime/";
            const cacheKey = `otakudesu:completed:${page}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, pathname, (doc) => ({
                animeList: otakudesuParser.parseCompletedAnimes(doc),
                pagination: otakudesuParser.parsePagination(doc),
            })), SCRAPE_OPTS);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { animeList: data.animeList }, pagination: data.pagination }));
        }
        catch (error) {
            next(error);
        }
    },
    async getSearchedAnimes(req, res, next) {
        try {
            const { q } = v.parse(otakudesuSchema.query.searchedAnimes, req.query);
            const pathname = `/?s=${q}&post_type=anime`;
            const cacheKey = `otakudesu:search:${encodeURIComponent(q)}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, pathname, (doc) => otakudesuParser.parseSearchedAnimes(doc)), { ...SCRAPE_OPTS, ttl: 120 } // hasil search lebih cepat expired
            );
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { animeList: data } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getAnimesByGenre(req, res, next) {
        try {
            const genreId = req.params.genreId;
            const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
            const pathname = page > 1 ? `/genres/${genreId}/page/${page}/` : `/genres/${genreId}/`;
            const cacheKey = `otakudesu:genre:${genreId}:${page}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, pathname, (doc) => ({
                animeList: otakudesuParser.parseAnimesByGenre(doc),
                pagination: otakudesuParser.parsePagination(doc),
            })), SCRAPE_OPTS);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { animeList: data.animeList }, pagination: data.pagination }));
        }
        catch (error) {
            next(error);
        }
    },
    async getBatchDetails(req, res, next) {
        try {
            const batchId = req.params.batchId;
            const cacheKey = `otakudesu:batch:${batchId}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, `/batch/${batchId}/`, (doc) => otakudesuParser.parseBatchDetails(doc)), { ...SCRAPE_OPTS, ttl: 1800 } // batch jarang berubah
            );
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { details: data } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getAnimeDetails(req, res, next) {
        try {
            const animeId = req.params.animeId;
            const cacheKey = `otakudesu:anime:${animeId}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, `/anime/${animeId}/`, (doc) => otakudesuParser.parseAnimeDetails(doc)), { ...SCRAPE_OPTS, ttl: 1800 });
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { details: data } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getEpisodeDetails(req, res, next) {
        try {
            const episodeId = req.params.episodeId;
            const pathname = `/episode/${episodeId}/`;
            const cacheKey = `otakudesu:episode:${episodeId}`;
            const { data } = await fetchWithCache(cacheKey, async () => {
                // parseEpisodeDetails adalah async (butuh scrapeNonce & scrapeServer)
                // Jadi kita tidak bisa pakai scrapeAndParse langsung
                const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
                return otakudesuParser.parseEpisodeDetails(document, new URL(pathname, baseUrl).toString());
            }, EPISODE_OPTS);
            res.json(setPayload(res, { data: { details: data } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getServerDetails(req, res, next) {
        try {
            const serverId = req.params.serverId || "";
            // Server ID berisi nonce yang expire — jangan cache
            const details = await otakudesuParser.parseServerDetails(serverId);
            res.json(setPayload(res, { data: { details } }));
        }
        catch (error) {
            if (error.message?.includes("is not valid JSON")) {
                res.status(400).json(setPayload(res));
                return;
            }
            next(error);
        }
    },
    async videoStream(req, res, next) {
        // Handle CORS preflight
        if (req.method === "OPTIONS") {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Range");
            res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
            res.status(204).end();
            return;
        }
        const rawUrl = req.query.url;
        if (!rawUrl) {
            res.status(400).json(setPayload(res, { message: "Query parameter 'url' is required." }));
            return;
        }
        let targetUrl;
        try {
            targetUrl = decodeURIComponent(rawUrl);
        }
        catch {
            res.status(400).json(setPayload(res, { message: "Invalid URL encoding." }));
            return;
        }
        let parsedUrl;
        try {
            parsedUrl = new URL(targetUrl);
        }
        catch {
            res.status(400).json(setPayload(res, { message: "URL tidak valid." }));
            return;
        }
        const allowedDomains = ["googlevideo.com", "archive.org", "blogger.com"];
        const hostname = parsedUrl.hostname.toLowerCase();
        const isAllowed = allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
        if (!isAllowed) {
            res.status(403).json(setPayload(res, {
                message: `Domain tidak diizinkan. Hanya domain berikut yang diperbolehkan: ${allowedDomains.join(", ")}`,
            }));
            return;
        }
        const doFetch = (url, rangeHeader, redirectCount = 0) => {
            return new Promise((resolve, reject) => {
                if (redirectCount > 5) {
                    reject(new Error("Terlalu banyak redirect."));
                    return;
                }
                const parsedTarget = new URL(url);
                const lib = parsedTarget.protocol === "https:" ? https : http;
                const reqHeaders = {
                    Referer: "https://otakudesu.blog/",
                    Origin: "https://otakudesu.blog",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                };
                if (rangeHeader) {
                    reqHeaders["Range"] = rangeHeader;
                }
                const options = {
                    hostname: parsedTarget.hostname,
                    port: parsedTarget.port || (parsedTarget.protocol === "https:" ? 443 : 80),
                    path: parsedTarget.pathname + parsedTarget.search,
                    method: "GET",
                    headers: reqHeaders,
                    timeout: 20000,
                };
                const upstreamReq = lib.request(options, (upstreamRes) => {
                    const statusCode = upstreamRes.statusCode ?? 500;
                    if ((statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) &&
                        upstreamRes.headers.location) {
                        const redirectUrl = new URL(upstreamRes.headers.location, url).toString();
                        upstreamRes.resume();
                        resolve(doFetch(redirectUrl, rangeHeader, redirectCount + 1));
                        return;
                    }
                    if (res.headersSent) {
                        upstreamRes.resume();
                        resolve();
                        return;
                    }
                    res.setHeader("Access-Control-Allow-Origin", "*");
                    res.setHeader("Access-Control-Allow-Headers", "Range");
                    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
                    const forwardHeaders = ["content-type", "content-range", "accept-ranges", "content-length"];
                    for (const header of forwardHeaders) {
                        const value = upstreamRes.headers[header];
                        if (value) {
                            res.setHeader(header, value);
                        }
                    }
                    res.status(statusCode);
                    upstreamRes.pipe(res);
                    upstreamRes.on("end", resolve);
                    upstreamRes.on("error", reject);
                });
                upstreamReq.on("error", reject);
                upstreamReq.on("timeout", () => {
                    upstreamReq.destroy();
                    reject(new Error("Upstream request timeout"));
                });
                upstreamReq.end();
            });
        };
        try {
            const rangeHeader = req.headers["range"];
            let clientGone = false;
            req.on("close", () => { clientGone = true; });
            req.on("aborted", () => { clientGone = true; });
            await doFetch(targetUrl, rangeHeader);
        }
        catch (error) {
            next(error);
        }
    },
};
export default otakudesuController;
