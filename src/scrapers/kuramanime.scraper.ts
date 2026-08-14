import kuramanimeConfig from "@configs/kuramanime.config.js";
import getHTML from "@helpers/getHTML.js";
import { fetchViaProxyRendered, hasProxyKeys } from "@helpers/scraperApiProxy.js";
import { parse, type HTMLElement } from "node-html-parser";
import puppeteer, { type Browser } from "puppeteer-core";

const { baseUrl } = kuramanimeConfig;

// Chromium executable path
// Docker/Linux Alpine: set via CHROME_PATH env or default to chromium-browser
// Windows local: Chrome default install path
const CHROME_PATH =
  process.env.CHROME_PATH ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/chromium-browser");

// Mirror USE_PROXY dari scraperApiProxy — scraper pakai ini untuk pilih path
// Puppeteer vs ScraperAPI secara eksplisit tanpa import silang.
const USE_PROXY = process.env.USE_PROXY?.toLowerCase() === "true";

export interface IEpisodeBrowserResult {
  server: { qualityList: { title: string; urlList: { title: string; url: string }[] }[] };
  download: { qualityList: { title: string; size: string; urlList: { title: string; url: string }[] }[] };
  prevEpisodeHref: string | null;
  nextEpisodeHref: string | null;
}

// ─── In-flight deduplication map ───────────────────────────────────────────
// Kalau ada 5 request untuk episode yang sama masuk bersamaan,
// hanya 1 yang benar-benar scrape — sisanya nunggu promise yang sama.
// Map dihapus begitu promise selesai (resolve/reject).
const inFlightEpisode = new Map<string, Promise<IEpisodeBrowserResult>>();

// ─── Persistent browser instance (reuse across requests) ───────────────────
let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  // If already have a live instance, return it
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  // If launch is in progress, wait for it
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--hide-scrollbars",
      "--metrics-recording-only",
      "--mute-audio",
      "--safebrowsing-disable-auto-update",
    ],
  }).then((b) => {
    browserInstance = b;
    browserLaunchPromise = null;

    // Reset instance if browser crashes
    b.on("disconnected", () => {
      browserInstance = null;
    });

    return b;
  });

  return browserLaunchPromise;
}

// Resource types to block — tidak perlu untuk mendapatkan player
const BLOCKED_RESOURCES = new Set([
  "image", "stylesheet", "font", "media",
  "ping", "manifest", "other",
]);

// Domains to block — analytics, ads, chat widget
const BLOCKED_DOMAINS = [
  "googletagmanager.com", "google-analytics.com",
  "googlesyndication.com", "kuramachat.com",
  "telegram.org", "onesignal.com",
  "aniview.com", "arc-cdn.net",
];

const kuramanimeScraper = {
  async scrapeDOM(pathname: string, ref?: string, sanitize: boolean = false): Promise<HTMLElement> {
    const html = await getHTML(baseUrl, pathname, ref, sanitize);
    const document = parse(html, {
      parseNoneClosedTags: true,
    });

    return document;
  },

  async scrapeSecret(ref?: string): Promise<string> {
    const text = await getHTML(baseUrl, "/assets/Ks6sqSgloPTlHMl.txt", ref);

    return text;
  },

  async scrapeEpisodeWithBrowser(
    animeId: string,
    animeSlug: string,
    episodeId: string
  ): Promise<IEpisodeBrowserResult> {
    const episodeUrl = `${baseUrl}anime/${animeId}/${animeSlug}/episode/${episodeId}`;
    const dedupeKey = `${animeId}/${animeSlug}/${episodeId}`;

    // ── In-flight deduplication ──────────────────────────────────────────
    // Kalau request untuk episode yang sama sedang berjalan,
    // return promise yang sama — tidak spawn scraping baru.
    const existing = inFlightEpisode.get(dedupeKey);
    if (existing) {
      console.info(`[scrapeEpisode] dedup hit for ${dedupeKey} — waiting for in-flight request`);
      return existing;
    }

    const promise = kuramanimeScraper._doScrapeEpisode(episodeUrl, animeId, animeSlug).finally(() => {
      inFlightEpisode.delete(dedupeKey);
    });

    inFlightEpisode.set(dedupeKey, promise);
    return promise;
  },

  async _doScrapeEpisode(
    episodeUrl: string,
    animeId: string,
    animeSlug: string
  ): Promise<IEpisodeBrowserResult> {
    // Ekstrak episodeId dari URL untuk fallback ke Puppeteer
    const episodeId = episodeUrl.split("/episode/")[1] ?? "";

    const emptyResult: IEpisodeBrowserResult = {
      server: { qualityList: [] },
      download: { qualityList: [] },
      prevEpisodeHref: null,
      nextEpisodeHref: null,
    };

    // USE_PROXY=false → langsung Puppeteer, skip ScraperAPI sama sekali
    if (!USE_PROXY) {
      console.info(`[scrapeEpisode] proxy disabled — using Puppeteer directly for ${episodeUrl}`);
      try {
        return await kuramanimeScraper._scrapeEpisodeWithPuppeteer(animeId, animeSlug, episodeId);
      } catch (err) {
        // Puppeteer tidak tersedia (Railway tanpa Chromium, dll) — return empty, jangan 500
        console.warn(`[scrapeEpisode] Puppeteer failed, returning empty result:`, err);
        return emptyResult;
      }
    }

    // USE_PROXY=true → coba ScraperAPI rendered dulu, fallback ke Puppeteer
    if (hasProxyKeys()) {
      const t0 = Date.now();
      console.info(`[scrapeEpisode] ScraperAPI rendered start — ${episodeUrl}`);

      // Batas waktu ScraperAPI render: 45 detik
      const SCRAPER_TIMEOUT_MS = 45_000;

      try {
        const html = await Promise.race([
          // wait_for_selector: ScraperAPI tunggu sampai #player source muncul di DOM
          fetchViaProxyRendered(episodeUrl, "#player source"),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("ScraperAPI render timeout")), SCRAPER_TIMEOUT_MS)
          ),
        ]);

        console.info(`[scrapeEpisode] ScraperAPI rendered done in ${Date.now() - t0}ms`);
        const result = kuramanimeScraper._parseEpisodeFromHTML(html, animeId, animeSlug);

        if (result.server.qualityList.length === 0) {
          console.warn(`[scrapeEpisode] ScraperAPI rendered returned empty qualityList in ${Date.now() - t0}ms`);
        }

        return result;
      } catch (err) {
        console.warn(`[scrapeEpisode] ScraperAPI render failed after ${Date.now() - t0}ms, falling back to Puppeteer:`, err);
      }
    }

    // Fallback: Puppeteer
    try {
      return await kuramanimeScraper._scrapeEpisodeWithPuppeteer(animeId, animeSlug, episodeId);
    } catch (err) {
      console.warn(`[scrapeEpisode] Puppeteer fallback also failed, returning empty result:`, err);
      return emptyResult;
    }
  },

  _parseEpisodeFromHTML(html: string, animeId: string, animeSlug: string): IEpisodeBrowserResult {
    const doc = parse(html, { parseNoneClosedTags: true });

    // Parse streaming quality from #player source elements
    const qualityList: IEpisodeBrowserResult["server"]["qualityList"] = [];
    doc.querySelectorAll("#player source").forEach((s) => {
      const src = s.getAttribute("src") || "";
      const size = s.getAttribute("size") || "";
      if (src && size) {
        qualityList.push({ title: size, urlList: [{ title: "kuramadrive", url: src }] });
      }
    });

    // Parse download links from #animeDownloadLink
    const downloadQualityList: IEpisodeBrowserResult["download"]["qualityList"] = [];
    let currentQuality: { title: string; size: string; urlList: { title: string; url: string }[] } | null = null;

    doc.querySelectorAll("#animeDownloadLink h6, #animeDownloadLink a").forEach((el) => {
      if (el.tagName === "H6") {
        const text = el.text?.trim() || "";
        const parts = text.split("—");
        currentQuality = {
          title: parts[0]?.trim() || "",
          size: parts[1]?.trim().replace(/[()]/g, "") || "",
          urlList: [],
        };
        downloadQualityList.push(currentQuality);
      } else if (el.tagName === "A" && currentQuality) {
        currentQuality.urlList.push({
          title: el.text?.trim() || "",
          url: el.getAttribute("href") || "",
        });
      }
    });

    // Parse prev/next navigation
    const prevEl = doc.querySelector(".episode__navigations .before__nav");
    const nextEl = doc.querySelector(".episode__navigations .after__nav");

    return {
      server: { qualityList },
      download: { qualityList: downloadQualityList },
      prevEpisodeHref: prevEl?.getAttribute("href") || null,
      nextEpisodeHref: nextEl?.getAttribute("href") || null,
    };
  },

  async _scrapeEpisodeWithPuppeteer(
    animeId: string,
    animeSlug: string,
    episodeId: string
  ): Promise<IEpisodeBrowserResult> {
    const episodeUrl = `${baseUrl}anime/${animeId}/${animeSlug}/episode/${episodeId}`;

    // Reuse persistent browser — no cold start after first request
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
      );

      // Block unnecessary resources to speed up page load
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const type = req.resourceType();
        const url = req.url();

        const isBlocked =
          BLOCKED_RESOURCES.has(type) ||
          BLOCKED_DOMAINS.some((d) => url.includes(d));

        if (isBlocked) {
          req.abort();
        } else {
          req.continue();
        }
      });

      try {
        await page.goto(episodeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      } catch (_) {
        // timeout OK, JS still executes
      }

      // Wait for #player source to appear — much faster than fixed 12s timeout
      // Falls back to 15s max if player never loads
      try {
        await page.waitForFunction(
          // Pass as string to avoid TypeScript DOM type errors
          "document.querySelectorAll('#player source').length > 0",
          { timeout: 15000, polling: 300 }
        );
      } catch (_) {
        // Player did not load in time — return what we have
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: IEpisodeBrowserResult = await (page.evaluate as any)((): IEpisodeBrowserResult => {
        const qualityList: { title: string; urlList: { title: string; url: string }[] }[] = [];
        // @ts-ignore - runs in browser context
        document.querySelectorAll("#player source").forEach((s: any) => {
          const src: string = s.getAttribute("src") || "";
          const size: string = s.getAttribute("size") || "";
          if (src && size) {
            qualityList.push({ title: size, urlList: [{ title: "kuramadrive", url: src }] });
          }
        });

        const downloadQualityList: { title: string; size: string; urlList: { title: string; url: string }[] }[] = [];
        let currentQuality: { title: string; size: string; urlList: { title: string; url: string }[] } | null = null;

        // @ts-ignore - runs in browser context
        document.querySelectorAll("#animeDownloadLink h6, #animeDownloadLink a").forEach((el: any) => {
          if (el.tagName === "H6") {
            const text: string = el.textContent?.trim() || "";
            const parts = text.split("—");
            currentQuality = {
              title: parts[0]?.trim() || "",
              size: parts[1]?.trim().replace(/[()]/g, "") || "",
              urlList: [],
            };
            downloadQualityList.push(currentQuality);
          } else if (el.tagName === "A" && currentQuality) {
            currentQuality.urlList.push({
              title: el.textContent?.trim() || "",
              url: el.href || "",
            });
          }
        });

        // @ts-ignore - runs in browser context
        const prevEl: any = document.querySelector(".episode__navigations .before__nav");
        // @ts-ignore - runs in browser context
        const nextEl: any = document.querySelector(".episode__navigations .after__nav");

        return {
          server: { qualityList },
          download: { qualityList: downloadQualityList },
          prevEpisodeHref: prevEl?.getAttribute("href") || null,
          nextEpisodeHref: nextEl?.getAttribute("href") || null,
        };
      });

      return result;
    } finally {
      // Close page only, keep browser alive for next request
      // Wrap dengan try/catch — kalau browser sudah disconnect saat close,
      // jangan throw dan buang result yang sudah berhasil didapat
      try {
        await page.close();
      } catch (_) {
        // browser sudah disconnect, tidak perlu close manual
      }
    }
  },
};

export default kuramanimeScraper;
