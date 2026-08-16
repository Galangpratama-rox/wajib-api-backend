import komiknesiaConfig, { komiknesiaOrigin } from "../configs/komiknesia.config.js";
import { userAgent } from "../helpers/getHTML.js";
const { baseUrl } = komiknesiaConfig;
const BASE_HEADERS = {
    "User-Agent": userAgent,
    "Origin": komiknesiaOrigin,
    "Referer": `${komiknesiaOrigin}/`,
    "Accept": "application/json",
};
// Timeout untuk semua request ke API Komiknesia
const FETCH_TIMEOUT_MS = 15_000;
const komiknesiaScraper = {
    async fetchJSON(pathname) {
        const url = new URL(pathname, baseUrl);
        const res = await fetch(url, {
            headers: BASE_HEADERS,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
            throw new Error(`Komiknesia API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
    },
};
export default komiknesiaScraper;
