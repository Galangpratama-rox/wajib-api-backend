import kuramanimeConfig from "@configs/kuramanime.config.js";
import getHTML from "@helpers/getHTML.js";
import { parse, type HTMLElement } from "node-html-parser";
import puppeteer from "puppeteer-core";

const { baseUrl } = kuramanimeConfig;

// Chromium executable path
// Docker/Linux Alpine: set via CHROME_PATH env or default to chromium-browser
// Windows local: Chrome default install path
const CHROME_PATH =
  process.env.CHROME_PATH ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/chromium-browser");

export interface IEpisodeBrowserResult {
  server: { qualityList: { title: string; urlList: { title: string; url: string }[] }[] };
  download: { qualityList: { title: string; size: string; urlList: { title: string; url: string }[] }[] };
  prevEpisodeHref: string | null;
  nextEpisodeHref: string | null;
}

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

    const browser = await puppeteer.launch({
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
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
      );

      try {
        await page.goto(episodeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      } catch (_) {
        // domcontentloaded timeout is OK, JS still runs
      }

      // Wait for player JS to execute
      await new Promise((r) => setTimeout(r, 12000));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: IEpisodeBrowserResult = await (page.evaluate as any)((): IEpisodeBrowserResult => {
        // Extract streaming sources
        const qualityList: { title: string; urlList: { title: string; url: string }[] }[] = [];
        // @ts-ignore - runs in browser context
        document.querySelectorAll("#player source").forEach((s: any) => {
          const src: string = s.getAttribute("src") || "";
          const size: string = s.getAttribute("size") || "";
          if (src && size) {
            qualityList.push({ title: size, urlList: [{ title: "kuramadrive", url: src }] });
          }
        });

        // Extract download links
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

        // Extract prev/next navigation
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
      await browser.close();
    }
  },
};

export default kuramanimeScraper;
