import setPayload from "../helpers/setPayload.js";
import kuramanimeConfig from "../configs/kuramanime.config.js";
import kuramanimeScraper from "../scrapers/kuramanime.scraper.js";
import kuramanimeParser from "../parsers/kuramanime.parser.js";
import kuramanimeSchema from "../schemas/kuramanime.schema.js";
import { scrapeAndParse } from "../services/htmlScraperProvider.js";
import { fetchWithCache } from "../services/dataService.js";
import * as v from "valibot";
const { baseUrl } = kuramanimeConfig;
// Opsi default untuk semua endpoint Kuramanime (HTML scraping)
const SCRAPE_OPTS = {
    type: "scrape",
    allowStale: true,
};
// Episode berisi URL streaming yang berumur pendek — allowStale=false
const EPISODE_OPTS = {
    type: "scrape",
    allowStale: false,
    ttl: 300, // 5 menit
};
const kuramanimeController = {
    async getRoot(req, res, next) {
        const routes = [
            {
                method: "GET",
                path: "/kuramanime/home",
                description: "Halaman utama",
                pathParams: [],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/kuramanime/anime",
                description: "Daftar anime",
                pathParams: [],
                queryParams: [
                    { key: "search", value: "string", defaultValue: null, required: false },
                    { key: "status", value: '"ongoing" | "completed" | "upcoming" | "movie"', defaultValue: null, required: false },
                    { key: "sort", value: '"a-z" | "z-a" | "oldest" | "latest" | "popular" | "most_viewed" | "updated"', defaultValue: '"latest" | "updated"', required: false },
                    { key: "page", value: "string", defaultValue: "1", required: false },
                ],
            },
            {
                method: "GET",
                path: "/kuramanime/schedule",
                description: "Jadwal rilis",
                pathParams: [],
                queryParams: [
                    { key: "day", value: '"all" | "random" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"', defaultValue: "all", required: false },
                    { key: "page", value: "string", defaultValue: "1", required: false },
                ],
            },
            {
                method: "GET",
                path: "/kuramanime/properties/{propertyType}",
                description: "Daftar properti berdasarkan tipe properti",
                pathParams: [{ key: "propertyType", value: '"genre" | "season" | "studio" | "type" | "quality" | "source" | "country"', defaultValue: null, required: true }],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/kuramanime/properties/{propertyType}/{propertyId}",
                description: "Daftar anime berdasarkan id properti",
                pathParams: [
                    { key: "propertyType", value: '"genre" | "season" | "studio" | "type" | "quality" | "source" | "country"', defaultValue: null, required: true },
                    { key: "propertyId", value: "string", defaultValue: null, required: true },
                ],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/kuramanime/anime/{animeId}/{animeSlug}",
                description: "Detail anime berdasarkan id anime",
                pathParams: [
                    { key: "animeId", value: "string", defaultValue: null, required: true },
                    { key: "animeSlug", value: "string", defaultValue: null, required: true },
                ],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/kuramanime/batch/{animeId}/{animeSlug}/{batchId}",
                description: "Batch anime berdasarkan id batch",
                pathParams: [
                    { key: "animeId", value: "string", defaultValue: null, required: true },
                    { key: "animeSlug", value: "string", defaultValue: null, required: true },
                    { key: "batchId", value: "string", defaultValue: null, required: true },
                ],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/kuramanime/episode/{animeId}/{animeSlug}/{episodeId}",
                description: "Detail episode berdasarkan id episode",
                pathParams: [
                    { key: "animeId", value: "string", defaultValue: null, required: true },
                    { key: "animeSlug", value: "string", defaultValue: null, required: true },
                    { key: "episodeId", value: "string", defaultValue: null, required: true },
                ],
                queryParams: [],
            },
        ];
        res.json(setPayload(res, { message: "Status: OK 🚀", data: { routes } }));
    },
    async getHome(req, res, next) {
        try {
            const cacheKey = "kuramanime:home";
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, "/", (doc) => kuramanimeParser.parseHome(doc), {
                ref: "https://google.com",
            }), SCRAPE_OPTS);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data }));
        }
        catch (error) {
            next(error);
        }
    },
    async getAnimes(req, res, next) {
        try {
            const query = v.parse(kuramanimeSchema.query.animes, req.query);
            const status = query?.status;
            const search = query?.search || "";
            const page = Number(query?.page) || 1;
            const sort = (query?.sort === "a-z" ? "ascending" : query?.sort === "z-a" ? "descending" : query?.sort) ||
                (status === "ongoing" ? "updated" : "latest");
            function getPathname() {
                if (status) {
                    return `/quick/${status === "completed" ? "finished" : status}?order_by=${sort}&page=${page}`;
                }
                if (search) {
                    return `/anime?order_by=${sort}&page=${page}&search=${search}`;
                }
                return `/anime?order_by=${sort}&page=${page}`;
            }
            const pathname = getPathname();
            const cacheKey = `kuramanime:animes:${pathname}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, pathname, (doc) => ({
                animeList: status !== "ongoing" ? kuramanimeParser.parseAnimes(doc) : undefined,
                episodeList: status === "ongoing" ? kuramanimeParser.parseEpisodes(doc) : undefined,
                pagination: kuramanimeParser.parsePagination(doc),
            }), { ref: baseUrl }), SCRAPE_OPTS);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, {
                data: { animeList: data.animeList, episodeList: data.episodeList },
                pagination: data.pagination,
            }));
        }
        catch (error) {
            next(error);
        }
    },
    async getProperties(req, res, next) {
        try {
            const { propertyType } = v.parse(kuramanimeSchema.param.properties, req.params);
            const pathname = `/properties/${propertyType}`;
            const cacheKey = `kuramanime:properties:${propertyType}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, pathname, (doc) => kuramanimeParser.parseProperties(doc), {
                ref: baseUrl,
            }), { ...SCRAPE_OPTS, ttl: 3600 });
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { propertyType, propertyList: data } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getAnimesByProperty(req, res, next) {
        try {
            const { propertyType, propertyId } = v.parse(kuramanimeSchema.param.animesByPropertyId, req.params);
            const query = v.parse(kuramanimeSchema.query.animesByPropertyId, req.query);
            const page = Number(query?.page) || 1;
            const sort = (query?.sort === "a-z" ? "ascending" : query?.sort === "z-a" ? "descending" : query?.sort) ||
                "latest";
            const pathname = `/properties/${propertyType}/${propertyId}?order_by=${sort}&page=${page}`;
            const cacheKey = `kuramanime:property:${propertyType}:${propertyId}:${sort}:${page}`;
            const { data, stale } = await fetchWithCache(cacheKey, () => scrapeAndParse(baseUrl, pathname, (doc) => ({
                animeList: kuramanimeParser.parseAnimes(doc),
                pagination: kuramanimeParser.parsePagination(doc),
            }), { ref: baseUrl }), SCRAPE_OPTS);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { animeList: data.animeList }, pagination: data.pagination }));
        }
        catch (error) {
            next(error);
        }
    },
    async getScheduledAnimes(req, res, next) {
        try {
            const query = v.parse(kuramanimeSchema.query.scheduledAnimes, req.query);
            const page = Number(query?.page) || 1;
            const day = query?.day || "all";
            // "all" fetch 7 hari — sangat lambat tanpa cache, 1 jam TTL sangat membantu
            const cacheKey = `kuramanime:schedule:${day}:${page}`;
            const { data, stale } = await fetchWithCache(cacheKey, async () => {
                if (day === "all") {
                    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
                    const animeList = [];
                    for (const d of days) {
                        try {
                            const pathname = `/schedule?scheduled_day=${d}&page=${page}`;
                            const dayList = await scrapeAndParse(baseUrl, pathname, (doc) => kuramanimeParser.parseScheduledAnimes(doc, false), { ref: baseUrl });
                            animeList.push(...dayList);
                        }
                        catch (_) {
                            // skip hari yang gagal
                        }
                        await new Promise((r) => setTimeout(r, 300));
                    }
                    return { animeList, pagination: undefined };
                }
                const pathname = `/schedule?scheduled_day=${day}&page=${page}`;
                return scrapeAndParse(baseUrl, pathname, (doc) => ({
                    animeList: kuramanimeParser.parseScheduledAnimes(doc),
                    pagination: kuramanimeParser.parsePagination(doc),
                }), { ref: baseUrl });
            }, { ...SCRAPE_OPTS, ttl: 3600 });
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { animeList: data.animeList }, pagination: data.pagination }));
        }
        catch (error) {
            next(error);
        }
    },
    async getAnimeDetails(req, res, next) {
        try {
            const params = v.parse(kuramanimeSchema.param.animeDetails, req.params);
            const pathname = `/anime/${params.animeId}/${params.animeSlug}`;
            const cacheKey = `kuramanime:anime:${params.animeId}:${params.animeSlug}`;
            const { data: details, stale } = await fetchWithCache(cacheKey, async () => {
                const doc = await scrapeAndParse(baseUrl, pathname, (d) => d, { ref: baseUrl });
                let parsed;
                try {
                    parsed = kuramanimeParser.parseAnimeDetails(doc, params);
                }
                catch (parseErr) {
                    console.error(`[getAnimeDetails] parse error for ${pathname}:`, parseErr?.status, parseErr?.message);
                    throw parseErr;
                }
                const last = parsed.episode.last;
                if (last !== null && last >= 1) {
                    parsed.episode.first = 1;
                    parsed.episodeList = Array.from({ length: last }, (_, i) => {
                        const epNum = i + 1;
                        return {
                            title: `Ep ${epNum}`,
                            episodeId: String(epNum),
                            animeId: params.animeId,
                            animeSlug: params.animeSlug,
                            kuramanimeUrl: undefined,
                        };
                    });
                }
                return parsed;
            }, { ...SCRAPE_OPTS, ttl: 1800 });
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { details } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getBatchDetails(req, res, next) {
        try {
            const params = v.parse(kuramanimeSchema.param.batchDetails, req.params);
            const mainPathname = `/anime/${params.animeId}/${params.animeSlug}/batch/${params.batchId}`;
            const cacheKey = `kuramanime:batch:${params.animeId}:${params.animeSlug}:${params.batchId}`;
            const { data, stale } = await fetchWithCache(cacheKey, async () => {
                const secret = await kuramanimeScraper.scrapeSecret(`${baseUrl}${mainPathname}`);
                const pathname = `${mainPathname}?Ub3BzhijicHXZdv=${secret}&C2XAPerzX1BM7V9=kuramadrive&page=1`;
                const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);
                return kuramanimeParser.parseBatchDetails(document, params);
            }, { ...SCRAPE_OPTS, ttl: 1800 });
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
            const params = v.parse(kuramanimeSchema.param.episodeDetails, req.params);
            const mainPathname = `/anime/${params.animeId}/${params.animeSlug}/episode/${params.episodeId}`;
            const cacheKey = `kuramanime:episode:${params.animeId}:${params.animeSlug}:${params.episodeId}`;
            const { data } = await fetchWithCache(cacheKey, async () => {
                const t0 = Date.now();
                const [secret, browserResult] = await Promise.all([
                    kuramanimeScraper.scrapeSecret(`${baseUrl}${mainPathname}`),
                    kuramanimeScraper.scrapeEpisodeWithBrowser(params.animeId, params.animeSlug, params.episodeId),
                ]);
                console.info(`[getEpisodeDetails] parallel fetch done in ${Date.now() - t0}ms`);
                const pathname = `${mainPathname}?Ub3BzhijicHXZdv=${secret}&C2XAPerzX1BM7V9=kuramadrive&page=1`;
                const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);
                console.info(`[getEpisodeDetails] dom fetch done in ${Date.now() - t0}ms total`);
                return kuramanimeParser.parseEpisodeDetails(document, params, browserResult);
            }, EPISODE_OPTS);
            res.json(setPayload(res, { data: { details: data } }));
        }
        catch (error) {
            next(error);
        }
    },
};
export default kuramanimeController;
