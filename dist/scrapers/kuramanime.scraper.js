import kuramanimeConfig from "../configs/kuramanime.config.js";
import getHTML from "../helpers/getHTML.js";
import { fetchViaProxyRendered, hasProxyKeys } from "../helpers/scraperApiProxy.js";
import { parse } from "node-html-parser";
import puppeteer, {} from "puppeteer-core";
const { baseUrl } = kuramanimeConfig;
// Chromium executable path
// Docker/Linux Alpine: set via CHROME_PATH env or default to chromium-browser
// Windows local: Chrome default install path
const CHROME_PATH = process.env.CHROME_PATH ||
    (process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : "/usr/bin/chromium-browser");
// ─── Persistent browser instance (reuse across requests) ───────────────────
let browserInstance = null;
let browserLaunchPromise = null;
async function getBrowser() {
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
    async scrapeDOM(pathname, ref, sanitize = false) {
        const html = await getHTML(baseUrl, pathname, ref, sanitize);
        const document = parse(html, {
            parseNoneClosedTags: true,
        });
        return document;
    },
    async scrapeSecret(ref) {
        const text = await getHTML(baseUrl, "/assets/Ks6sqSgloPTlHMl.txt", ref);
        return text;
    },
    async scrapeEpisodeWithBrowser(animeId, animeSlug, episodeId) {
        const episodeUrl = `${baseUrl}anime/${animeId}/${animeSlug}/episode/${episodeId}`;
        // If proxy keys are available, use ScraperAPI render instead of Puppeteer
        // This avoids Puppeteer IP block issues on cloud deployments
        if (hasProxyKeys()) {
            try {
                console.info(`[scrapeEpisode] using ScraperAPI rendered for ${episodeUrl}`);
                const html = await fetchViaProxyRendered(episodeUrl);
                return kuramanimeScraper._parseEpisodeFromHTML(html, animeId, animeSlug);
            }
            catch (err) {
                console.warn(`[scrapeEpisode] ScraperAPI render failed, falling back to Puppeteer:`, err);
            }
        }
        // Fallback: Puppeteer (works on local / non-blocked IPs)
        return kuramanimeScraper._scrapeEpisodeWithPuppeteer(animeId, animeSlug, episodeId);
    },
    _parseEpisodeFromHTML(html, animeId, animeSlug) {
        const doc = parse(html, { parseNoneClosedTags: true });
        // Parse streaming quality from #player source elements
        const qualityList = [];
        doc.querySelectorAll("#player source").forEach((s) => {
            const src = s.getAttribute("src") || "";
            const size = s.getAttribute("size") || "";
            if (src && size) {
                qualityList.push({ title: size, urlList: [{ title: "kuramadrive", url: src }] });
            }
        });
        // Parse download links from #animeDownloadLink
        const downloadQualityList = [];
        let currentQuality = null;
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
            }
            else if (el.tagName === "A" && currentQuality) {
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
    async _scrapeEpisodeWithPuppeteer(animeId, animeSlug, episodeId) {
        const episodeUrl = `${baseUrl}anime/${animeId}/${animeSlug}/episode/${episodeId}`;
        // Reuse persistent browser — no cold start after first request
        const browser = await getBrowser();
        const page = await browser.newPage();
        try {
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36");
            // Block unnecessary resources to speed up page load
            await page.setRequestInterception(true);
            page.on("request", (req) => {
                const type = req.resourceType();
                const url = req.url();
                const isBlocked = BLOCKED_RESOURCES.has(type) ||
                    BLOCKED_DOMAINS.some((d) => url.includes(d));
                if (isBlocked) {
                    req.abort();
                }
                else {
                    req.continue();
                }
            });
            try {
                await page.goto(episodeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            }
            catch (_) {
                // timeout OK, JS still executes
            }
            // Wait for #player source to appear — much faster than fixed 12s timeout
            // Falls back to 15s max if player never loads
            try {
                await page.waitForFunction(
                // Pass as string to avoid TypeScript DOM type errors
                "document.querySelectorAll('#player source').length > 0", { timeout: 15000, polling: 300 });
            }
            catch (_) {
                // Player did not load in time — return what we have
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await page.evaluate(() => {
                const qualityList = [];
                // @ts-ignore - runs in browser context
                document.querySelectorAll("#player source").forEach((s) => {
                    const src = s.getAttribute("src") || "";
                    const size = s.getAttribute("size") || "";
                    if (src && size) {
                        qualityList.push({ title: size, urlList: [{ title: "kuramadrive", url: src }] });
                    }
                });
                const downloadQualityList = [];
                let currentQuality = null;
                // @ts-ignore - runs in browser context
                document.querySelectorAll("#animeDownloadLink h6, #animeDownloadLink a").forEach((el) => {
                    if (el.tagName === "H6") {
                        const text = el.textContent?.trim() || "";
                        const parts = text.split("—");
                        currentQuality = {
                            title: parts[0]?.trim() || "",
                            size: parts[1]?.trim().replace(/[()]/g, "") || "",
                            urlList: [],
                        };
                        downloadQualityList.push(currentQuality);
                    }
                    else if (el.tagName === "A" && currentQuality) {
                        currentQuality.urlList.push({
                            title: el.textContent?.trim() || "",
                            url: el.href || "",
                        });
                    }
                });
                // @ts-ignore - runs in browser context
                const prevEl = document.querySelector(".episode__navigations .before__nav");
                // @ts-ignore - runs in browser context
                const nextEl = document.querySelector(".episode__navigations .after__nav");
                return {
                    server: { qualityList },
                    download: { qualityList: downloadQualityList },
                    prevEpisodeHref: prevEl?.getAttribute("href") || null,
                    nextEpisodeHref: nextEl?.getAttribute("href") || null,
                };
            });
            return result;
        }
        finally {
            // Close page only, keep browser alive for next request
            await page.close();
        }
    },
};
export default kuramanimeScraper;
