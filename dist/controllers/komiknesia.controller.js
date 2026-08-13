import setPayload from "../helpers/setPayload.js";
import komiknesiaScraper from "../scrapers/komiknesia.scraper.js";
import komiknesiaParser from "../parsers/komiknesia.parser.js";
import komiknesiaSchema from "../schemas/komiknesia.schema.js";
import * as v from "valibot";
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
            // Fetch popular today, latest update, dan top per type secara paralel
            const [popularDay, latestUpdate, topManga, topManhwa, topManhua] = await Promise.all([
                komiknesiaScraper.fetchJSON("contents?page=1&per_page=10&orderBy=Popular&popularWindow=day"),
                komiknesiaScraper.fetchJSON("contents?page=1&per_page=15&orderBy=Update&project=true"),
                komiknesiaScraper.fetchJSON("contents?page=1&per_page=10&type=manga&orderBy=Popular"),
                komiknesiaScraper.fetchJSON("contents?page=1&per_page=10&type=manhwa&orderBy=Popular"),
                komiknesiaScraper.fetchJSON("contents?page=1&per_page=10&type=manhua&orderBy=Popular"),
            ]);
            res.json(setPayload(res, {
                data: {
                    popularToday: (popularDay.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                    latestUpdate: (latestUpdate.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                    topManga: (topManga.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                    topManhwa: (topManhwa.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                    topManhua: (topManhua.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
                },
            }));
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
            // Map order values to API format
            const orderMap = {
                latest: "Update",
                popular: "Popular",
                "a-z": "Az",
                "z-a": "Za",
            };
            params.set("orderBy", orderMap[query?.order ?? "latest"] ?? "Update");
            // 'q' adalah param search yang valid di API Komiknesia
            if (query?.search)
                params.set("q", query.search);
            if (query?.genre)
                params.set("genre", query.genre);
            if (query?.type)
                params.set("type", query.type);
            // Note: filter status tidak didukung oleh API Komiknesia
            const raw = await komiknesiaScraper.fetchJSON(`contents?${params.toString()}`);
            const { komikList, pagination } = komiknesiaParser.parseKomikList(raw);
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
            const raw = await komiknesiaScraper.fetchJSON(`contents?${params.toString()}`);
            const { komikList, pagination } = komiknesiaParser.parseKomikList(raw);
            res.json(setPayload(res, { data: { komikList }, pagination }));
        }
        catch (error) {
            next(error);
        }
    },
    async getKomikDetails(req, res, next) {
        try {
            const { komikSlug } = v.parse(komiknesiaSchema.param.komikDetails, req.params);
            // Endpoint khusus detail komik: /api/comic/:slug
            const raw = await komiknesiaScraper.fetchJSON(`comic/${komikSlug}`);
            const details = komiknesiaParser.parseKomikDetails(raw.data);
            res.json(setPayload(res, { data: { details } }));
        }
        catch (error) {
            next(error);
        }
    },
    async getChapterDetails(req, res, next) {
        try {
            const { chapterSlug } = v.parse(komiknesiaSchema.param.chapterDetails, req.params);
            // Endpoint baca chapter: /api/chapters/slug/:chapterSlug
            const raw = await komiknesiaScraper.fetchJSON(`chapters/slug/${chapterSlug}`);
            // Ambil komikSlug dari data chapter
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
            const raw = await komiknesiaScraper.fetchJSON("contents/genres");
            const genreList = (raw.data || []).map((g) => ({
                id: g.id,
                name: g.name,
                slug: g.slug,
            }));
            res.json(setPayload(res, { data: { genreList } }));
        }
        catch (error) {
            next(error);
        }
    },
};
export default komiknesiaController;
