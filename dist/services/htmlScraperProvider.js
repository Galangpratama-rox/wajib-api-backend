/**
 * htmlScraperProvider — abstraksi untuk semua operasi HTML scraping.
 *
 * Modul ini tidak melakukan caching sendiri — caching dihandle oleh dataService.
 * Tugasnya hanya: fetch HTML → parse → return typed data.
 *
 * Usage:
 *   const data = await fetchWithCache(
 *     cacheKey,
 *     () => htmlScraperProvider.scrape(pathname, parser),
 *     { type: "scrape", allowStale: true }
 *   );
 */
import getHTML from "../helpers/getHTML.js";
import { parse } from "node-html-parser";
// ─── Generic scrape function ─────────────────────────────────────────────────
/**
 * Fetch HTML dari baseUrl+pathname, parse dengan node-html-parser,
 * jalankan parser, return hasilnya.
 */
export async function scrapeAndParse(baseUrl, pathname, parser, options) {
    const html = await getHTML(baseUrl, pathname, options?.ref, options?.sanitize ?? false);
    const document = parse(html, { parseNoneClosedTags: true });
    return parser(document);
}
