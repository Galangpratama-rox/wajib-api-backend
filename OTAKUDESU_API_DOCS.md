# Otakudesu API Documentation

Base URL: `http://localhost:3001/otakudesu`

Semua response menggunakan format berikut:

```json
{
  "statusCode": 200,
  "statusMessage": "OK",
  "message": "",
  "data": { ... },
  "pagination": null
}
```

---

## Alur Lengkap Streaming Video

Untuk mendapatkan URL video yang bisa langsung diputar di `<video>`, ikuti alur ini:

```
1. GET /otakudesu/ongoing          → dapat animeId
2. GET /otakudesu/anime/:animeId   → dapat episodeId
3. GET /otakudesu/episode/:episodeId → dapat serverId (dari server.qualityList)
4. GET /otakudesu/server/:serverId   → dapat videoUrl (direct mp4)
```

---

## Endpoints

### 1. GET `/otakudesu/home`

Halaman utama — daftar anime ongoing dan completed terbaru.

**Response `data`:**
```json
{
  "ongoing": {
    "otakudesuUrl": "https://otakudesu.blog/ongoing-anime/",
    "animeList": [
      {
        "title": "string",
        "animeId": "string",
        "poster": "string",
        "episodes": "string",
        "releaseDay": "string",
        "latestReleaseDate": "string",
        "otakudesuUrl": "string"
      }
    ]
  },
  "completed": {
    "otakudesuUrl": "https://otakudesu.blog/complete-anime/",
    "animeList": [
      {
        "title": "string",
        "animeId": "string",
        "poster": "string",
        "episodes": "string",
        "score": "string",
        "lastReleaseDate": "string",
        "otakudesuUrl": "string"
      }
    ]
  }
}
```

---

### 2. GET `/otakudesu/ongoing`

Daftar anime sedang tayang dengan pagination.

**Query Params:**

| Key    | Type     | Default | Keterangan |
|--------|----------|---------|------------|
| `page` | `string` | `"1"`   | Halaman    |

**Response `data`:**
```json
{
  "animeList": [
    {
      "title": "string",
      "animeId": "string",
      "poster": "string",
      "episodes": "string",
      "releaseDay": "string",
      "latestReleaseDate": "string",
      "otakudesuUrl": "string"
    }
  ]
}
```

**Response `pagination`:**
```json
{
  "currentPage": 1,
  "prevPage": null,
  "hasPrevPage": false,
  "nextPage": 2,
  "hasNextPage": true,
  "totalPages": 5
}
```

---

### 3. GET `/otakudesu/completed`

Daftar anime yang sudah selesai tayang dengan pagination.

**Query Params:** sama seperti `/ongoing`

**Response `data`:**
```json
{
  "animeList": [
    {
      "title": "string",
      "animeId": "string",
      "poster": "string",
      "episodes": "string",
      "score": "string",
      "lastReleaseDate": "string",
      "otakudesuUrl": "string"
    }
  ]
}
```

---

### 4. GET `/otakudesu/search`

Cari anime berdasarkan kata kunci.

**Query Params:**

| Key | Type     | Default | Keterangan              |
|-----|----------|---------|-------------------------|
| `q` | `string` | -       | Kata kunci (**required**) |

**Contoh:** `/otakudesu/search?q=naruto`

**Response `data`:**
```json
{
  "animeList": [
    {
      "title": "string",
      "animeId": "string",
      "poster": "string",
      "status": "string",
      "score": "string",
      "genreList": [
        { "title": "string", "genreId": "string", "otakudesuUrl": "string" }
      ],
      "otakudesuUrl": "string"
    }
  ]
}
```

---

### 5. GET `/otakudesu/schedule`

Jadwal rilis anime per hari.

**Response `data`:**
```json
{
  "scheduleList": [
    {
      "title": "Senin",
      "animeList": [
        { "title": "string", "animeId": "string", "otakudesuUrl": "string" }
      ]
    }
  ]
}
```

---

### 6. GET `/otakudesu/anime`

Daftar semua anime (A-Z).

**Response `data`:**
```json
{
  "list": [
    {
      "startWith": "A",
      "animeList": [
        { "title": "string", "animeId": "string", "otakudesuUrl": "string" }
      ]
    }
  ]
}
```

---

### 7. GET `/otakudesu/genre`

Daftar semua genre.

**Response `data`:**
```json
{
  "genreList": [
    { "title": "Action", "genreId": "action", "otakudesuUrl": "string" }
  ]
}
```

---

### 8. GET `/otakudesu/genre/:genreId`

Daftar anime berdasarkan genre.

**Path Params:**

| Key       | Contoh     |
|-----------|------------|
| `genreId` | `action`   |

**Query Params:** `page` (default `"1"`)

**Response `data`:**
```json
{
  "animeList": [
    {
      "title": "string",
      "animeId": "string",
      "poster": "string",
      "score": "string",
      "episodes": "string",
      "season": "string",
      "studios": "string",
      "synopsis": { "paragraphList": ["string"] },
      "genreList": [
        { "title": "string", "genreId": "string", "otakudesuUrl": "string" }
      ],
      "otakudesuUrl": "string"
    }
  ]
}
```

---

### 9. GET `/otakudesu/anime/:animeId`

Detail lengkap satu anime beserta daftar episode.

**Path Params:**

| Key       | Contoh                       |
|-----------|------------------------------|
| `animeId` | `re-zero-kara-s4-sub-indo`   |

**Response `data`:**
```json
{
  "details": {
    "title": "string",
    "japanese": "string",
    "score": "string",
    "producers": "string",
    "type": "string",
    "status": "Ongoing | Completed",
    "episodes": "string",
    "duration": "string",
    "aired": "string",
    "studios": "string",
    "poster": "string",
    "synopsis": { "paragraphList": ["string"] },
    "batch": {
      "title": "string",
      "batchId": "string",
      "otakudesuUrl": "string"
    },
    "genreList": [
      { "title": "string", "genreId": "string", "otakudesuUrl": "string" }
    ],
    "episodeList": [
      { "title": "12", "episodeId": "anime-episode-12-sub-indo", "otakudesuUrl": "string" }
    ],
    "recommendedAnimeList": [
      { "title": "string", "animeId": "string", "poster": "string", "otakudesuUrl": "string" }
    ]
  }
}
```

> `episodeList` diurutkan dari episode terbaru ke terlama. Episode pertama ada di index terakhir (`episodeList[episodeList.length - 1]`).

---

### 10. GET `/otakudesu/episode/:episodeId`

Detail episode — berisi daftar server streaming per kualitas.

**Path Params:**

| Key         | Contoh                                   |
|-------------|------------------------------------------|
| `episodeId` | `rezr-isktsu-s4-episode-1-sub-indo`      |

**Response `data`:**
```json
{
  "details": {
    "title": "string",
    "animeId": "string",
    "releaseTime": "string",
    "defaultStreamingUrl": "https://desustream.net/...",
    "hasPrevEpisode": false,
    "prevEpisode": null,
    "hasNextEpisode": true,
    "nextEpisode": {
      "title": "Next",
      "episodeId": "string",
      "otakudesuUrl": "string"
    },
    "server": {
      "title": "Server",
      "qualityList": [
        {
          "title": " Mirror 360p",
          "serverList": [
            { "title": "vidhide", "serverId": "eyJ..." },
            { "title": "filedon", "serverId": "eyJ..." }
          ]
        },
        {
          "title": " Mirror 480p",
          "serverList": [
            { "title": "ondesu3", "serverId": "eyJ..." },
            { "title": "vidhide", "serverId": "eyJ..." }
          ]
        },
        {
          "title": " Mirror 720p",
          "serverList": [
            { "title": "ondesuhd", "serverId": "eyJ..." },
            { "title": "odstream",  "serverId": "eyJ..." },
            { "title": "filedon",   "serverId": "eyJ..." }
          ]
        }
      ]
    },
    "download": {
      "title": "Download",
      "qualityList": [
        {
          "title": "Mp4 720p",
          "size": "69.8 MB",
          "urlList": [
            { "title": "ServerName", "url": "https://..." }
          ]
        }
      ]
    },
    "info": {
      "credit": "string",
      "encoder": "string",
      "duration": "string",
      "type": "string",
      "genreList": [
        { "title": "string", "genreId": "string", "otakudesuUrl": "string" }
      ],
      "episodeList": [
        { "title": "string", "episodeId": "string", "otakudesuUrl": "string" }
      ]
    }
  }
}
```

> `serverId` adalah base64-encoded string. Gunakan langsung sebagai path param ke endpoint `/server/:serverId`.

---

### 11. GET `/otakudesu/server/:serverId`

Resolve `serverId` menjadi URL video yang siap diputar.

**Path Params:**

| Key        | Keterangan                                        |
|------------|---------------------------------------------------|
| `serverId` | Nilai `serverId` dari `server.qualityList[].serverList[]` |

**Response `data`:**
```json
{
  "details": {
    "url": "https://desustream.net/dstream/arcg/?id=...",
    "videoUrl": "https://archive.org/download/.../video.mp4",
    "type": "odstream"
  }
}
```

| Field      | Keterangan                                                                 |
|------------|----------------------------------------------------------------------------|
| `url`      | URL iframe desustream original (kena CSP jika dipakai di `<iframe>`)       |
| `videoUrl` | Direct URL video — gunakan ini di `<video src="...">` ✅                   |
| `type`     | `"odstream"` / `"ondesuhd"` / `"unknown"` — menunjukkan sumber video       |

> `videoUrl` bisa `null` jika server tidak berhasil di-resolve. Fallback ke `defaultStreamingUrl` dari response episode.

---

### 12. GET `/otakudesu/batch/:batchId`

Detail batch download (semua episode dalam satu paket).

**Path Params:**

| Key       | Keterangan                                     |
|-----------|------------------------------------------------|
| `batchId` | Nilai `batchId` dari `batch` di detail anime   |

**Response `data`:**
```json
{
  "details": {
    "title": "string",
    "animeId": "string",
    "poster": "string",
    "japanese": "string",
    "type": "string",
    "score": "string",
    "episodes": "string",
    "duration": "string",
    "studios": "string",
    "producers": "string",
    "aired": "string",
    "credit": "string",
    "genreList": [
      { "title": "string", "genreId": "string", "otakudesuUrl": "string" }
    ],
    "download": {
      "formatList": [
        {
          "title": "Mp4",
          "qualityList": [
            {
              "title": "720p",
              "size": "string",
              "urlList": [
                { "title": "GDrive", "url": "string" }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

---

## Contoh Penggunaan Frontend

### Fetch ongoing anime
```js
const res = await fetch('/otakudesu/ongoing?page=1')
const { data, pagination } = await res.json()
// data.animeList → array anime
```

### Fetch episode list dari detail anime
```js
const res = await fetch('/otakudesu/anime/re-zero-kara-s4-sub-indo')
const { data } = await res.json()
const episodes = data.details.episodeList
// episodes[0]           → episode terbaru
// episodes[episodes.length - 1] → episode pertama (ep 1)
```

### Fetch server list dari episode
```js
const res = await fetch('/otakudesu/episode/rezr-isktsu-s4-episode-1-sub-indo')
const { data } = await res.json()
const qualityList = data.details.server.qualityList

// Ambil serverId ondesuhd 720p
const q720 = qualityList.find(q => q.title.includes('720'))
const server = q720?.serverList.find(s => s.title === 'ondesuhd' || s.title === 'odstream')
const serverId = server?.serverId
```

### Resolve videoUrl dari serverId
```js
const res = await fetch(`/otakudesu/server/${serverId}`)
const { data } = await res.json()
const videoUrl = data.details.videoUrl  // direct mp4 URL

if (videoUrl) {
  videoElement.src = videoUrl  // langsung pakai di <video>
} else {
  // fallback: embed defaultStreamingUrl di iframe dengan sandbox
}
```

### Alur lengkap satu fungsi
```js
async function getVideoUrl(animeId, episodeIndex = -1, quality = '720', preferredServer = 'odstream') {
  // 1. Ambil episode list
  const animeRes = await fetch(`/otakudesu/anime/${animeId}`)
  const { data: animeData } = await animeRes.json()
  const episodes = animeData.details.episodeList
  const episode = episodes.at(episodeIndex) // -1 = episode terbaru

  // 2. Ambil server list dari episode
  const epRes = await fetch(`/otakudesu/episode/${episode.episodeId}`)
  const { data: epData } = await epRes.json()
  const q = epData.details.server.qualityList.find(q => q.title.includes(quality))
  const srv = q?.serverList.find(s => s.title === preferredServer) ?? q?.serverList[0]
  if (!srv) return null

  // 3. Resolve videoUrl
  const srvRes = await fetch(`/otakudesu/server/${srv.serverId}`)
  const { data: srvData } = await srvRes.json()
  return srvData.details.videoUrl
}

// Pakai:
const url = await getVideoUrl('re-zero-kara-s4-sub-indo', -1, '720', 'odstream')
// → "https://archive.org/download/.../video.mp4"
```

---

## Catatan Penting

- **`serverId` bersifat sementara** — nonce di dalamnya expire setelah beberapa menit. Jangan cache `serverId`, selalu fetch ulang dari `/episode/:episodeId` setiap sesi streaming.
- **`videoUrl` bisa `null`** jika server tidak support atau sedang down. Selalu handle null dan siapkan fallback.
- **Server priority** untuk kualitas terbaik: `ondesuhd` (720p) → `odstream`/`arcg` (720p) → server lain.
- **CSP issue**: Jangan gunakan `url` (field pertama) di `<iframe>` — akan diblokir browser. Selalu gunakan `videoUrl` di tag `<video>`.
