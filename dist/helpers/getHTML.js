import errorinCuy from "./errorinCuy.js";
import sanitizeHtml from "sanitize-html";
import { fetchViaProxy, hasProxyKeys } from "./scraperApiProxy.js";
export const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0";
export default async function getHTML(baseUrl, pathname, ref, sanitize = false) {
    const url = new URL(pathname, baseUrl);
    const headers = {
        "User-Agent": userAgent,
    };
    if (ref) {
        headers["Referer"] = ref.startsWith("http") ? ref : new URL(ref, baseUrl).toString();
    }
    let html = null;
    const response = await fetch(url, { headers, redirect: "manual" });
    // redirect (3xx) atau 403 → coba proxy
    const shouldTryProxy = (response.status === 403 || (response.status >= 301 && response.status <= 308)) &&
        hasProxyKeys();
    // On 403 or redirect — try ScraperAPI proxy if keys are available
    if (shouldTryProxy) {
        console.warn(`[getHTML] ${response.status} on ${url.toString()} — retrying via ScraperAPI proxy`);
        try {
            html = await fetchViaProxy(url.toString());
        }
        catch (proxyErr) {
            console.error("[getHTML] ScraperAPI fallback failed:", proxyErr);
            errorinCuy(403);
        }
    }
    else if (!response.ok) {
        response.status > 399 ? errorinCuy(response.status) : errorinCuy(404);
    }
    else {
        html = await response.text();
    }
    if (!html || !html.trim())
        errorinCuy(404);
    if (sanitize) {
        return sanitizeHtml(html, {
            allowedTags: [
                "address",
                "article",
                "aside",
                "footer",
                "header",
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "main",
                "nav",
                "section",
                "blockquote",
                "div",
                "dl",
                "figcaption",
                "figure",
                "hr",
                "li",
                "main",
                "ol",
                "p",
                "pre",
                "ul",
                "a",
                "abbr",
                "b",
                "br",
                "code",
                "data",
                "em",
                "i",
                "mark",
                "span",
                "strong",
                "sub",
                "sup",
                "time",
                "u",
                "img",
            ],
            allowedAttributes: {
                a: ["href", "name", "target"],
                img: ["src"],
                "*": ["class", "id"],
            },
        });
    }
    return html;
}
