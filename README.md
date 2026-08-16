# wajik-anime-api

REST API streaming dan download Anime subtitle Indonesia dari berbagai sumber

## Arsitektur Caching

Aplikasi menggunakan **two-layer caching** untuk meminimalisir hit ke sumber eksternal dan mencegah crash akibat ETIMEDOUT/ECONNRESET di Railway:

```
Request
  │
  ▼
[L1] LRU Cache (in-memory, per-instance)   ← serverCache middleware, TTL 10-30 menit
  │ miss
  ▼
[L2] Redis Cache (persistent, cross-restart) ← dataService, TTL configurable via env
  │ miss
  ▼
[Singleflight] In-flight deduplication     ← cegah N request paralel untuk key yang sama
  │
  ▼
[Concurrency Limiter] p-limit              ← batasi request paralel per tipe source
  │
  ▼
Provider (HTML Scraper atau REST API)
  │ error + ada stale copy di Redis
  ▼
[Stale Fallback] Return data lama          ← untuk endpoint metadata saja
```

### Dua Tipe Provider

**HTML Scraper** (`services/htmlScraperProvider.ts`) — Otakudesu & Kuramanime
- Fetch HTML → parse DOM dengan `node-html-parser` → return JSON
- Concurrency limit: `SCRAPE_CONCURRENCY` (default 3)
- Timeout: `SCRAPE_TIMEOUT_MS` (default 20s)
- TTL Redis: `CACHE_TTL_SCRAPE` (default 600s / 10 menit)
- Stale fallback: aktif untuk metadata, nonaktif untuk episode/server (URL streaming berumur pendek)

**REST API** (`services/apiProvider.ts`) — Komiknesia
- Fetch JSON langsung dari REST API target
- Concurrency limit: `API_CONCURRENCY` (default 8)
- Timeout: `API_TIMEOUT_MS` (default 10s)
- TTL Redis: `CACHE_TTL_API` (default 300s / 5 menit)
- Retry 1x pada 429 Too Many Requests

### Stale Fallback

Untuk endpoint metadata (home, list, detail anime/komik), kalau provider gagal total tapi ada data lama di Redis (sudah expired), endpoint akan mengembalikan data lama dengan header `X-Cache-Stale: true` daripada error 500. Ini **tidak** berlaku untuk episode dan chapter karena URL streaming/gambar berumur sangat pendek.

### Setup Redis di Railway

1. Tambahkan Redis plugin di Railway dashboard
2. `REDIS_URL` akan otomatis tersedia sebagai environment variable
3. Aplikasi tetap berjalan tanpa Redis (fallback ke LRU in-memory saja)

# Sumber:

API ini unofficial jadi ga ada kaitan dengan sumber yang tersedia...

1. otakudesu: https://otakudesu.best
2. kuramanime: https://v8.kuramanime.tel

- domain sering berubah jangan lupa pantau terus untuk edit url ada di di "src/configs/{source}.config.ts"

# Installasi App

- install NodeJS 20 || >=22
- Jalankan perintah di terminal

```sh
# clone repo
git clone https://github.com/wajik45/wajik-anime-api.git

# masuk repo
cd wajik-anime-api

# install dependensi
npm install

# menjalankan server mode development
npm run dev
```

# Build App

```sh
# build
npm run build

# menjalankan server
npm start
```

- Server akan berjalan di http://localhost:3001

# Routes

| Endpoint  | Description                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------ |
| /{sumber} | Deskripsi ada di response sesuai dengan sumber, gunakan ext JSON Parser jika menggunakan browser |

### Contoh request

```js
(async () => {
  const response = await fetch("http://localhost:3001/otakudesu/ongoing?page=1");
  const result = await response.json();

  console.log(result);
})();
```

### Contoh response

```json
{
  "statusCode": 200,
  "statusMessage": "OK",
  "message": "",
  "data": {
    "animeList": [
      {
        "title": "Dr. Stone Season 3 Part 2",
        "poster": "https://otakudesu.cloud/wp-content/uploads/2024/01/Dr.-Stone-Season-3-Part-2-Sub-Indo.jpg",
        "episodes": "11",
        "animeId": "drstn-s3-p2-sub-indo",
        "latestReleaseDate": "05 Jan",
        "releaseDay": "Jum'at",
        "otakudesuUrl": "https://otakudesu.cloud/anime/drstn-s3-p2-sub-indo/"
      },
      {"..."}
    ]
  },
  "pagination": {
    "currentPage": 1,
    "prevPage": null,
    "hasPrevPage": false,
    "nextPage": 2,
    "hasNextPage": true,
    "totalPages": 4
  },
}
```
