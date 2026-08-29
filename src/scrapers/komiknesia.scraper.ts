import { createDecipheriv } from "node:crypto";
import komiknesiaConfig, { komiknesiaOrigin } from "@configs/komiknesia.config.js";
import { userAgent } from "@helpers/getHTML.js";

const { baseUrl } = komiknesiaConfig;

const BASE_HEADERS = {
  "User-Agent": userAgent,
  "Origin": komiknesiaOrigin,
  "Referer": `${komiknesiaOrigin}/`,
  "Accept": "application/json",
  "X-Device-Id": generateDeviceId(),
};

// Timeout untuk semua request ke API Komiknesia
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Generate device ID yang konsisten per proses (mirip browser localStorage)
 */
function generateDeviceId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36).slice(-6);
  return `dv_${rand}${ts}`;
}

/**
 * Derive AES-256 key dari field `time` di response terenkripsi.
 *
 * Algoritma dari bundle.js (class GN):
 *   1. Bagi nilai time sebanyak 5x dengan 2 → time / 32
 *   2. toFixed(8) → string dengan 8 desimal
 *   3. Pad ke 32 karakter dengan "0", atau truncate ke 32 karakter
 */
function deriveKey(time: number): Buffer {
  let r = Number(time);
  for (let i = 0; i < 5; i++) r = r / 2; // = time / 32
  let keyStr = r.toFixed(8);
  if (keyStr.length < 32) {
    keyStr = keyStr.padEnd(32, "0");
  } else if (keyStr.length > 32) {
    keyStr = keyStr.substring(0, 32);
  }
  return Buffer.from(keyStr, "utf8"); // 32 bytes → AES-256
}

/**
 * Decrypt response terenkripsi dari API Komiknesia.
 *
 * Format data (base64):
 *   [bytes 0-15]  = IV (16 bytes)
 *   [bytes 16+]   = ciphertext AES-256-CBC
 */
function decryptResponse(encryptedBase64: string, time: number): unknown {
  const raw = Buffer.from(encryptedBase64, "base64");
  const iv = raw.subarray(0, 16);
  const ciphertext = raw.subarray(16);
  const key = deriveKey(time);

  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

const komiknesiaScraper = {
  async fetchJSON<T = unknown>(pathname: string): Promise<T> {
    const url = new URL(pathname, baseUrl);
    const res = await fetch(url, {
      headers: BASE_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Komiknesia API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as Record<string, unknown>;

    // Response terenkripsi: { encrypted: true, data: string, time: number }
    if (json && typeof json === "object" && json.encrypted === true && json.data && json.time) {
      try {
        return decryptResponse(json.data as string, json.time as number) as T;
      } catch (err) {
        console.error("[komiknesiaScraper] Decryption failed:", err);
        throw err;
      }
    }

    return json as T;
  },
};

export default komiknesiaScraper;
