import komiknesiaConfig, { komiknesiaOrigin } from "@configs/komiknesia.config.js";
import { userAgent } from "@helpers/getHTML.js";

const { baseUrl } = komiknesiaConfig;

const BASE_HEADERS = {
  "User-Agent": userAgent,
  "Origin": komiknesiaOrigin,
  "Referer": `${komiknesiaOrigin}/`,
  "Accept": "application/json",
};

const komiknesiaScraper = {
  async fetchJSON<T = unknown>(pathname: string): Promise<T> {
    const url = new URL(pathname, baseUrl);
    const res = await fetch(url, { headers: BASE_HEADERS });

    if (!res.ok) {
      throw new Error(`Komiknesia API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  },
};

export default komiknesiaScraper;
