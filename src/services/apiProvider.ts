/**
 * apiProvider — abstraksi untuk semua direct REST API call.
 *
 * Modul ini tidak melakukan caching sendiri — caching dihandle oleh dataService.
 * Tugasnya hanya: fetch JSON dari REST API, handle HTTP errors, retry 1x pada 429.
 *
 * Timeout diatur via env API_TIMEOUT_MS (default 10s) dan dikirim sebagai
 * AbortSignal.timeout() di setiap fetch call.
 *
 * Auto-decrypt response Komiknesia yang terenkripsi AES-256-CBC:
 *   Response format: { encrypted: true, data: string (base64), time: number }
 *   Key derivation : (time / 32).toFixed(8) → padEnd/truncate ke 32 char
 *   IV             : 16 bytes pertama dari base64
 *   Ciphertext     : bytes ke-17 dst dari base64
 */

import { createDecipheriv } from "node:crypto";

const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS) || 10_000;

// Delay sebelum retry setelah 429 Too Many Requests
const RETRY_429_DELAY_MS = 1_000;

interface FetchJsonOptions {
  headers?: Record<string, string>;
  /** Kalau true, retry 1x setelah RETRY_429_DELAY_MS kalau mendapat 429 */
  retry429?: boolean;
}

/**
 * Fetch JSON dari URL dengan timeout, error handling, dan opsional retry 429.
 * Throw Error dengan pesan deskriptif kalau gagal — ditangkap oleh dataService.
 */
export async function fetchJson<T = unknown>(
  url: string | URL,
  options?: FetchJsonOptions
): Promise<T> {
  return _doFetch<T>(url, options, false);
}

async function _doFetch<T>(
  url: string | URL,
  options: FetchJsonOptions | undefined,
  isRetry: boolean
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(url, {
      ...(options?.headers ? { headers: options.headers } : {}),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`[apiProvider] Network error fetching ${url}: ${(err as Error).message}`);
  }

  // 429 Too Many Requests — retry sekali setelah delay
  if (res.status === 429 && !isRetry && (options?.retry429 ?? true)) {
    console.warn(`[apiProvider] 429 on ${url}, retrying after ${RETRY_429_DELAY_MS}ms`);
    await delay(RETRY_429_DELAY_MS);
    return _doFetch<T>(url, options, true);
  }

  if (!res.ok) {
    throw new Error(`[apiProvider] HTTP ${res.status} ${res.statusText} from ${url}`);
  }

  try {
    const json = (await res.json()) as unknown;
    // Auto-decrypt kalau response Komiknesia terenkripsi
    if (isEncryptedResponse(json)) {
      try {
        return decryptKomiknesiaResponse(json) as T;
      } catch (err) {
        throw new Error(`[apiProvider] Decryption failed for ${url}: ${(err as Error).message}`);
      }
    }
    return json as T;
  } catch (err) {
    throw new Error(`[apiProvider] Failed to parse JSON from ${url}: ${(err as Error).message}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Komiknesia AES-256-CBC decrypt ──────────────────────────────────────────

interface EncryptedResponse {
  encrypted: true;
  data: string;
  time: number;
}

function isEncryptedResponse(val: unknown): val is EncryptedResponse {
  return (
    typeof val === "object" &&
    val !== null &&
    (val as Record<string, unknown>).encrypted === true &&
    typeof (val as Record<string, unknown>).data === "string" &&
    typeof (val as Record<string, unknown>).time === "number"
  );
}

/**
 * Derive AES-256 key dari field `time` di response terenkripsi.
 * Replika dari GN.generateKey() di bundle Komiknesia:
 *   time / 2^5 → toFixed(8) → padEnd/truncate ke 32 char
 */
function deriveKey(time: number): Buffer {
  let r = time;
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
 * Layout base64: [0-15] = IV (16 bytes), [16+] = ciphertext AES-256-CBC
 */
function decryptKomiknesiaResponse(encrypted: EncryptedResponse): unknown {
  const raw = Buffer.from(encrypted.data, "base64");
  const iv = raw.subarray(0, 16);
  const ciphertext = raw.subarray(16);
  const key = deriveKey(encrypted.time);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
