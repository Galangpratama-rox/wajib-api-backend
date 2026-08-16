import setPayload from "../helpers/setPayload.js";
import komiknesiaParser from "../parsers/komiknesia.parser.js";
import komiknesiaSchema from "../schemas/komiknesia.schema.js";
import komiknesiaConfig, { komiknesiaOrigin } from "../configs/komiknesia.config.js";
import { fetchJson } from "../services/apiProvider.js";
import { fetchWithCache } from "../services/dataService.js";
import * as v from "valibot";
const { baseUrl } = komiknesiaConfig;
// Headers dikirim ke semua request Komiknesia API
const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
    Origin: komiknesiaOrigin,
    Referer: `${komiknesiaOrigin}/`,
    Accept: "application/json",
};
// Opsi default untuk semua endpoint Komiknesia (direct REST API)
const API_OPTS = {
    type: "api",
    allowStale: true,
};
/** Helper: fetch JSON dari Komiknesia API menggunakan apiProvider */
function apiGet(pathname) {
    const url = new URL(pathname, baseUrl);
    return fetchJson(url, { headers: API_HEADERS, retry429: true });
}
const komiknesiaController = {
    async getRoot(_req, res, _next) {
        const routes = [
            {
                method: "GET",
                path: "/komiknesia/home",
                description: "Daftar komik populer, update terbaru, dan top per kategori untuk halaman home",
                pathParams: [],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/komiknesia/komik",
                description: "Daftar komik dengan filter dan pencarian",
                pathParams: [],
                queryParams: [
                    { key: "search", value: "string", defaultValue: null, required: false },
                    { key: "genre", value: "string (slug genre)", defaultValue: null, required: false },
                    { key: "type", value: '"manga" | "manhwa" | "manhua"', defaultValue: null, required: false },
                    { key: "order", value: '"latest" | "popular" | "a-z" | "z-a"', defaultValue: '"latest"', required: false },
                    { key: "page", value: "string", defaultValue: "1", required: false },
                ],
            },
            {
                method: "GET",
                path: "/komiknesia/komik/:komikSlug",
                description: "Detail komik beserta daftar chapter",
                pathParams: [
                    { key: "komikSlug", value: "string", defaultValue: null, required: true },
                ],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/komiknesia/chapter/:komikSlug/:chapterSlug",
                description: "Halaman chapter — daftar gambar untuk dibaca",
                pathParams: [
                    { key: "komikSlug", value: "string", defaultValue: null, required: true },
                    { key: "chapterSlug", value: "string", defaultValue: null, required: true },
                ],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/komiknesia/genre",
                description: "Daftar semua genre",
                pathParams: [],
                queryParams: [],
            },
            {
                method: "GET",
                path: "/komiknesia/genre/:genreId",
                description: "Daftar komik berdasarkan genre",
                pathParams: [
                    { key: "genreId", value: "string (slug genre)", defaultValue: null, required: true },
                ],
                queryParams: [
                    { key: "page", value: "string", defaultValue: "1", required: false },
                ],
            },
        ];
        res.json(setPayload(res, { message: "Status: OK 🚀", data: { routes } }));
    },
    async getHome(_req, res, next) {
        try {
            const cacheKey = "komiknesia:home";
            const { data, stale } = await fetchWithCache(cacheKey, async () => {
                // 5 request paralel ke API
                const [popularDay, latestUpdate, topManga, topManhwa, topManhua] = await Promise.all([
                    apiGet("contents?page=1&per_page=10&orderBy=Popular&popularWindow=day"),
                    apiGet("contents?page=1&per_page=15&orderBy=Update&project=true"),
                    apiGet("contents?page=1&per_page=10&type=manga&orderBy=Popular"),
                    apiGet("contents?page=1&per_page=10&type=manhwa&orderBy=Popular"),
                    apiGet("contents?page=1&per_page=10&type=manhua&orderBy=Popular"),
                ]);
                return {
                    popularToday: (popularDay.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                    latestUpdate: (latestUpdate.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                    topManga: (topManga.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                    topManhwa: (topManhwa.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                    topManhua: (topManhua.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                };
            }, API_OPTS);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data }));
        }
        catch (error) {
            next(error);
        }
    },
    async getKomiks(req, res, next) {
        try {
            const query = v.parse(komiknesiaSchema.query.komiks, req.query);
            const page = Number(query?.page) || 1;
            const perPage = 15;
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("per_page", String(perPage));
            const orderMap = {
                latest: "Update",
                popular: "Popular",
                "a-z": "Az",
                "z-a": "Za",
            };
            params.set("orderBy", orderMap[query?.order ?? "latest"] ?? "Update");
            if (query?.search)
                params.set("q", query.search);
            if (query?.genre)
                params.set("genre", query.genre);
            if (query?.type)
                params.set("type", query.type);
            const cacheKey = `komiknesia:komiks:${params.toString()}`;
            const { data: raw, stale } = await fetchWithCache(cacheKey, () => apiGet(`contents?${params.toString()}`), API_OPTS);
            const { komikList, pagination } = komiknesiaParser.parseKomikList(raw);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { komikList }, pagination }));
        }
        catch (error) {
            next(error);
        }
    },
    async getKomiksByGenre(req, res, next) {
        try {
            const { genreId } = v.parse(komiknesiaSchema.param.genreKomiks, req.params);
            const query = v.parse(komiknesiaSchema.query.komiks, req.query);
            const page = Number(query?.page) || 1;
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("per_page", "15");
            params.set("genre", genreId);
            params.set("orderBy", "Update");
            const cacheKey = `komiknesia:genre:${genreId}:${page}`;
            const { data: raw, stale } = await fetchWithCache(cacheKey, () => apiGet(`contents?${params.toString()}`), API_OPTS);
            const { komikList, pagination } = komiknesiaParser.parseKomikList(raw);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { komikList }, pagination }));
        }
        catch (error) {
            next(error);
        }
    },
    async getKomikDetails(req, res, next) {
        try {
            const { komikSlug } = v.parse(komiknesiaSchema.param.komikDetails, req.params);
            const cacheKey = `komiknesia:komik:${komikSlug}`;
            const { data: raw, stale } = await fetchWithCache(cacheKey, () => apiGet(`comic/${komikSlug}`), API_OPTS);
            const details = komiknesiaParser.parseKomikDetails(raw.data);
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { details } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getChapterDetails(req, res, next) {
        try {
            const { chapterSlug } = v.parse(komiknesiaSchema.param.chapterDetails, req.params);
            // Chapter images berumur pendek — allowStale=false supaya tidak return URL gambar expired
            const cacheKey = `komiknesia:chapter:${chapterSlug}`;
            const { data: raw } = await fetchWithCache(cacheKey, () => apiGet(`chapters/slug/${chapterSlug}`), { type: "api", allowStale: false });
            const komikSlug = raw.data?.content?.slug ?? "";
            const details = komiknesiaParser.parseChapterDetails(raw.data, komikSlug);
            res.json(setPayload(res, { data: { details } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getGenres(_req, res, next) {
        try {
            const cacheKey = "komiknesia:genres";
            const { data: raw, stale } = await fetchWithCache(cacheKey, () => apiGet("contents/genres"), { ...API_OPTS, ttl: 3600 } // genre list jarang berubah, TTL 1 jam
            );
            const genreList = (raw.data || []).map((g) => ({
                id: g.id,
                name: g.name,
                slug: g.slug,
            }));
            if (stale)
                res.setHeader("X-Cache-Stale", "true");
            res.json(setPayload(res, { data: { genreList } }));
        }
        catch (error) {
            next(error);
        }
    },
};
export default komiknesiaController;
