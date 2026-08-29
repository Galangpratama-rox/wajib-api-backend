import type { Request, Response, NextFunction } from "express";
import setPayload from "@helpers/setPayload.js";
import komiknesiaParser from "@parsers/komiknesia.parser.js";
import komiknesiaSchema from "@schemas/komiknesia.schema.js";
import komiknesiaConfig, { komiknesiaOrigin } from "@configs/komiknesia.config.js";
import { fetchJson } from "@services/apiProvider.js";
import { fetchWithCache, type DataServiceOptions } from "@services/dataService.js";
import type {
  IKomiknesiaListResponse,
  IKomiknesiaComicDetailRaw,
  IKomiknesiaChapterReadRaw,
} from "@interfaces/komiknesia.interface.js";
import * as v from "valibot";

const { baseUrl } = komiknesiaConfig;

// Headers dikirim ke semua request Komiknesia API
const API_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
  Origin: komiknesiaOrigin,
  Referer: `${komiknesiaOrigin}/`,
  Accept: "application/json",
  "X-Device-Id": `dv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`,
};

// Opsi default untuk semua endpoint Komiknesia (direct REST API)
const API_OPTS: DataServiceOptions = {
  type: "api",
  allowStale: true,
};

/** Helper: fetch JSON dari Komiknesia API menggunakan apiProvider */
function apiGet<T>(pathname: string): Promise<T> {
  const url = new URL(pathname, baseUrl);
  return fetchJson<T>(url, { headers: API_HEADERS, retry429: true });
}

const komiknesiaController = {
  async getRoot(_req: Request, res: Response, _next: NextFunction) {
    const routes: IRouteData[] = [
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

  async getHome(_req: Request, res: Response, next: NextFunction) {
    try {
      const cacheKey = "komiknesia:home";

      const { data, stale } = await fetchWithCache(
        cacheKey,
        async () => {
          // 5 request paralel ke API
          const [popularDay, latestUpdate, topManga, topManhwa, topManhua] = await Promise.all([
            apiGet<IKomiknesiaListResponse>("contents?page=1&per_page=10&orderBy=Popular&popularWindow=day"),
            apiGet<IKomiknesiaListResponse>("contents?page=1&per_page=15&orderBy=Update&project=true"),
            apiGet<IKomiknesiaListResponse>("contents?page=1&per_page=10&type=manga&orderBy=Popular"),
            apiGet<IKomiknesiaListResponse>("contents?page=1&per_page=10&type=manhwa&orderBy=Popular"),
            apiGet<IKomiknesiaListResponse>("contents?page=1&per_page=10&type=manhua&orderBy=Popular"),
          ]);

          return {
            popularToday: (popularDay.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
            latestUpdate: (latestUpdate.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
            topManga: (topManga.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
            topManhwa: (topManhwa.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
            topManhua: (topManhua.data || []).map((item) => komiknesiaParser.parseKomikCard(item)),
          };
        },
        API_OPTS
      );

      if (stale) res.setHeader("X-Cache-Stale", "true");
      res.json(setPayload(res, { data }));
    } catch (error) {
      next(error);
    }
  },

  async getKomiks(req: Request, res: Response, next: NextFunction) {
    try {
      const query = v.parse(komiknesiaSchema.query.komiks, req.query);
      const page = Number(query?.page) || 1;
      const perPage = 15;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));

      const orderMap: Record<string, string> = {
        latest: "Update",
        popular: "Popular",
        "a-z": "Az",
        "z-a": "Za",
      };
      params.set("orderBy", orderMap[query?.order ?? "latest"] ?? "Update");

      if (query?.search) params.set("q", query.search);
      if (query?.genre) params.set("genre", query.genre);
      if (query?.type) params.set("type", query.type);

      const cacheKey = `komiknesia:komiks:${params.toString()}`;

      const { data: raw, stale } = await fetchWithCache(
        cacheKey,
        () => apiGet<IKomiknesiaListResponse>(`contents?${params.toString()}`),
        API_OPTS
      );

      const { komikList, pagination } = komiknesiaParser.parseKomikList(raw);

      if (stale) res.setHeader("X-Cache-Stale", "true");
      res.json(setPayload(res, { data: { komikList }, pagination }));
    } catch (error) {
      next(error);
    }
  },

  async getKomiksByGenre(req: Request, res: Response, next: NextFunction) {
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

      const { data: raw, stale } = await fetchWithCache(
        cacheKey,
        () => apiGet<IKomiknesiaListResponse>(`contents?${params.toString()}`),
        API_OPTS
      );

      const { komikList, pagination } = komiknesiaParser.parseKomikList(raw);

      if (stale) res.setHeader("X-Cache-Stale", "true");
      res.json(setPayload(res, { data: { komikList }, pagination }));
    } catch (error) {
      next(error);
    }
  },

  async getKomikDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { komikSlug } = v.parse(komiknesiaSchema.param.komikDetails, req.params);
      const cacheKey = `komiknesia:komik:${komikSlug}`;

      const { data: raw, stale } = await fetchWithCache(
        cacheKey,
        () => apiGet<{ status: boolean; data: IKomiknesiaComicDetailRaw }>(`comic/${komikSlug}`),
        API_OPTS
      );

      const details = komiknesiaParser.parseKomikDetails(raw.data);

      if (stale) res.setHeader("X-Cache-Stale", "true");
      res.json(setPayload(res, { data: { details } }));
    } catch (error) {
      next(error);
    }
  },

  async getChapterDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { chapterSlug } = v.parse(komiknesiaSchema.param.chapterDetails, req.params);
      // Chapter images berumur pendek — allowStale=false supaya tidak return URL gambar expired
      const cacheKey = `komiknesia:chapter:${chapterSlug}`;

      const { data: raw } = await fetchWithCache(
        cacheKey,
        () => apiGet<{ status: boolean; data: IKomiknesiaChapterReadRaw }>(`chapters/slug/${chapterSlug}`),
        { type: "api", allowStale: false }
      );

      const komikSlug = raw.data?.content?.slug ?? "";
      const details = komiknesiaParser.parseChapterDetails(raw.data, komikSlug);

      res.json(setPayload(res, { data: { details } }));
    } catch (error) {
      next(error);
    }
  },

  async getGenres(_req: Request, res: Response, next: NextFunction) {
    try {
      const cacheKey = "komiknesia:genres";

      const { data: raw, stale } = await fetchWithCache(
        cacheKey,
        () => apiGet<{ status: boolean; data: { id: number; name: string; slug: string }[] }>("contents/genres"),
        { ...API_OPTS, ttl: 3600 } // genre list jarang berubah, TTL 1 jam
      );

      const genreList = (raw.data || []).map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
      }));

      if (stale) res.setHeader("X-Cache-Stale", "true");
      res.json(setPayload(res, { data: { genreList } }));
    } catch (error) {
      next(error);
    }
  },
};

export default komiknesiaController;
