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

import getHTML from "@helpers/getHTML.js";
import { parse, type HTMLElement } from "node-html-parser";

// ─── Type helper ─────────────────────────────────────────────────────────────
export type HtmlParser<T> = (document: HTMLElement) => T;
export type HtmlParserAsync<T> = (document: HTMLElement) => Promise<T>;

// ─── Generic scrape function ─────────────────────────────────────────────────

/**
 * Fetch HTML dari baseUrl+pathname, parse dengan node-html-parser,
 * jalankan parser, return hasilnya.
 */
export async function scrapeAndParse<T>(
  baseUrl: string,
  pathname: string,
  parser: HtmlParser<T> | HtmlParserAsync<T>,
  options?: { ref?: string; sanitize?: boolean }
): Promise<T> {
  const html = await getHTML(baseUrl, pathname, options?.ref, options?.sanitize ?? false);
  const document = parse(html, { parseNoneClosedTags: true });
  return parser(document);
}
