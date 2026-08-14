import type { Request, Response, NextFunction } from "express";
import otakudesuScraper from "@scrapers/otakudesu.scraper.js";
import otakudesuParser from "@parsers/otakudesu.parser.js";
import otakudesuConfig from "@configs/otakudesu.config.js";
import otakudesuSchema from "@schemas/otakudesu.schema.js";
import setPayload from "@helpers/setPayload.js";
import * as v from "valibot";
import https from "https";
import http from "http";

const { baseUrl } = otakudesuConfig;

const otakudesuController = {
  async getRoot(req: Request, res: Response, next: NextFunction) {
    const routes: IRouteData[] = [
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
        queryParams: [
          {
            key: "page",
            value: "string",
            defaultValue: "1",
            required: false,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/completed",
        description: "Daftar anime selesai",
        pathParams: [],
        queryParams: [
          {
            key: "page",
            value: "string",
            defaultValue: "1",
            required: false,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/search",
        description: "Daftar anime berdasarkan pencarian",
        pathParams: [],
        queryParams: [
          {
            key: "q",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/genre/{genreId}",
        description: "Daftar anime berdasarkan genre",
        pathParams: [
          {
            key: "genreId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [
          {
            key: "page",
            value: "string",
            defaultValue: "1",
            required: false,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/batch/{batchId}",
        description: "Batch anime berdasarkan id batch",
        pathParams: [
          {
            key: "batchId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/anime/{animeId}",
        description: "Detail anime berdasarkan id anime",
        pathParams: [
          {
            key: "animeId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/episode/{episodeId}",
        description: "Detail episode berdasarkan id episode",
        pathParams: [
          {
            key: "episodeId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [],
      },
      {
        method: "GET | POST",
        path: "/otakudesu/server/{serverId}",
        description:
          'Link video berdasarkan id server. Response berisi "url" (iframe desustream), "videoUrl" (direct mp4/video URL siap pakai di <video>), dan "type" (odstream | ondesuhd | unknown)',
        pathParams: [
          {
            key: "serverId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [],
      },
    ];

    res.json(
      setPayload(res, {
        message: "Status: OK 🚀",
        data: { routes },
      })
    );
  },

  async getHome(req: Request, res: Response, next: NextFunction) {
    try {
      const ref = "https://google.com/";
      const document = await otakudesuScraper.scrapeDOM("/", ref);
      const home = otakudesuParser.parseHome(document);
      const payload = setPayload(res, {
        data: home,
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const pathname = "/jadwal-rilis/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const scheduleList = otakudesuParser.parseSchedules(document);
      const payload = setPayload(res, {
        data: { scheduleList },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getAllAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const pathname = "/anime-list/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl, true);
      const list = otakudesuParser.parseAllAnimes(document);
      const payload = setPayload(res, {
        data: { list },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getAllGenres(req: Request, res: Response, next: NextFunction) {
    try {
      const pathname = "/genre-list/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const genreList = otakudesuParser.parseAllGenres(document);
      const payload = setPayload(res, {
        data: { genreList },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getOngoingAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
      const pathname = page > 1 ? `/ongoing-anime/page/${page}/` : "/ongoing-anime/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const animeList = otakudesuParser.parseOngoingAnimes(document);
      const pagination = otakudesuParser.parsePagination(document);
      const payload = setPayload(res, {
        data: { animeList },
        pagination,
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getCompletedAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
      const pathname = page > 1 ? `/complete-anime/page/${page}/` : "/complete-anime/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const animeList = otakudesuParser.parseCompletedAnimes(document);
      const pagination = otakudesuParser.parsePagination(document);
      const payload = setPayload(res, {
        data: { animeList },
        pagination,
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getSearchedAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const { q } = v.parse(otakudesuSchema.query.searchedAnimes, req.query);
      const pathname = `/?s=${q}&post_type=anime`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const animeList = otakudesuParser.parseSearchedAnimes(document);
      const payload = setPayload(res, {
        data: { animeList },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getAnimesByGenre(req: Request, res: Response, next: NextFunction) {
    try {
      const genreId = req.params.genreId;
      const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
      const pathname = page > 1 ? `/genres/${genreId}/page/${page}/` : `/genres/${genreId}/`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const animeList = otakudesuParser.parseAnimesByGenre(document);
      const pagination = otakudesuParser.parsePagination(document);
      const payload = setPayload(res, {
        data: { animeList },
        pagination,
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getBatchDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const batchId = req.params.batchId;
      const pathname = `/batch/${batchId}/`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const details = otakudesuParser.parseBatchDetails(document);
      const payload = setPayload(res, {
        data: { details },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getAnimeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const animeId = req.params.animeId;
      const pathname = `/anime/${animeId}/`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const details = otakudesuParser.parseAnimeDetails(document);
      const payload = setPayload(res, {
        data: { details },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getEpisodeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const episodeId = req.params.episodeId;
      const pathname = `/episode/${episodeId}/`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const details = await otakudesuParser.parseEpisodeDetails(
        document,
        new URL(pathname, baseUrl).toString()
      );
      const payload = setPayload(res, {
        data: { details },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getServerDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const serverId = req.params.serverId || "";
      const details = await otakudesuParser.parseServerDetails(serverId);
      const payload = setPayload(res, {
        data: { details },
      });

      res.json(payload);
    } catch (error: any) {
      if (error.message.includes("is not valid JSON")) {
        res.status(400).json(setPayload(res));

        return;
      }

      next(error);
    }
  },

  async videoStream(req: Request, res: Response, next: NextFunction) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
      res.status(204).end();
      return;
    }

    const rawUrl = req.query.url as string | undefined;

    if (!rawUrl) {
      res.status(400).json(setPayload(res, { message: "Query parameter 'url' is required." }));
      return;
    }

    // Decode URL jika masih encoded
    let targetUrl: string;
    try {
      targetUrl = decodeURIComponent(rawUrl);
    } catch {
      res.status(400).json(setPayload(res, { message: "Invalid URL encoding." }));
      return;
    }

    // Validasi URL dan whitelist domain
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      res.status(400).json(setPayload(res, { message: "URL tidak valid." }));
      return;
    }

    const allowedDomains = ["googlevideo.com", "archive.org", "blogger.com"];
    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      res.status(403).json(
        setPayload(res, {
          message: `Domain tidak diizinkan. Hanya domain berikut yang diperbolehkan: ${allowedDomains.join(", ")}`,
        })
      );
      return;
    }

    // Helper untuk melakukan fetch dengan follow redirect manual
    const doFetch = (
      url: string,
      rangeHeader: string | undefined,
      redirectCount = 0
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
          reject(new Error("Terlalu banyak redirect."));
          return;
        }

        const parsedTarget = new URL(url);
        const lib = parsedTarget.protocol === "https:" ? https : http;

        const reqHeaders: Record<string, string> = {
          Referer: "https://otakudesu.blog/",
          Origin: "https://otakudesu.blog",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
        };

        const upstreamReq = lib.request(options, (upstreamRes) => {
          const statusCode = upstreamRes.statusCode ?? 500;

          // Handle redirect manual
          if (
            (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) &&
            upstreamRes.headers.location
          ) {
            const redirectUrl = new URL(upstreamRes.headers.location, url).toString();
            upstreamRes.resume(); // buang body redirect
            resolve(doFetch(redirectUrl, rangeHeader, redirectCount + 1));
            return;
          }

          // Set CORS headers
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Headers", "Range");
          res.setHeader(
            "Access-Control-Expose-Headers",
            "Content-Range, Content-Length, Accept-Ranges"
          );

          // Forward headers yang diperlukan dari upstream
          const forwardHeaders = [
            "content-type",
            "content-range",
            "accept-ranges",
            "content-length",
          ];
          for (const header of forwardHeaders) {
            const value = upstreamRes.headers[header];
            if (value) {
              res.setHeader(header, value);
            }
          }

          // Jangan forward header berikut
          // content-security-policy, x-frame-options — tidak di-forward

          res.status(statusCode);
          upstreamRes.pipe(res);

          upstreamRes.on("end", resolve);
          upstreamRes.on("error", reject);
        });

        upstreamReq.on("error", reject);
        upstreamReq.end();
      });
    };

    try {
      const rangeHeader = req.headers["range"] as string | undefined;
      await doFetch(targetUrl, rangeHeader);
    } catch (error) {
      next(error);
    }
  },
};

export default otakudesuController;
