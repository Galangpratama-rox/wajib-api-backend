import errorinCuy from "./errorinCuy.js";
import sanitizeHtml from "sanitize-html";

export const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0";

export default async function getHTML(
  baseUrl: string,
  pathname: string,
  ref?: string,
  sanitize = false
): Promise<string> {
  const url = new URL(pathname, baseUrl);
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Ch-Ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };

  if (ref) {
    headers["Referer"] = ref.startsWith("http") ? ref : new URL(ref, baseUrl).toString();
    headers["Sec-Fetch-Site"] = "same-origin";
  }

  const response = await fetch(url, { headers, redirect: "manual" });

  if (!response.ok) {
    response.status > 399 ? errorinCuy(response.status) : errorinCuy(404);
  }

  const html = await response.text();

  if (!html.trim()) errorinCuy(404);

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

  return html as string;
}
