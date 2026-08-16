/**
 * apiProvider — abstraksi untuk semua direct REST API call.
 *
 * Modul ini tidak melakukan caching sendiri — caching dihandle oleh dataService.
 * Tugasnya hanya: fetch JSON dari REST API, handle HTTP errors, retry 1x pada 429.
 *
 * Timeout diatur via env API_TIMEOUT_MS (default 10s) dan dikirim sebagai
 * AbortSignal.timeout() di setiap fetch call.
 */

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
    return (await res.json()) as T;
  } catch (err) {
    throw new Error(`[apiProvider] Failed to parse JSON from ${url}: ${(err as Error).message}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
