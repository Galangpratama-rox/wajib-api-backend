# Kuramanime API Documentation

Base URL: `https://your-railway-domain.up.railway.app/kuramanime`

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

## 1. GET `/kuramanime/home`

Halaman utama — daftar anime ongoing, completed, dan movie.

**Response `data`:**
```json
{
  "ongoing": {
    "kuramanimeUrl": "string",
    "episodeList": [
      {
        "title": "string",
        "animeId": "string",
        "animeSlug": "string",
        "episodeId": "string",
        "poster": "string",
        "quality": "string",
        "type": "string",
        "episodes": "string",
        "totalEpisodes": "string",
        "kuramanimeUrl": "string"
      }
    ]
  },
  "completed": {
    "kuramanimeUrl": "string",
    "animeList": [ { "...IAnimeCard" } ]
  },
  "movie": {
    "kuramanimeUrl": "string",
    "animeList": [ { "...IAnimeCard" } ]
  }
}
```

---

## 2. GET `/kuramanime/anime`

Daftar anime dengan filter dan pencarian.

**Query Params:**

| Key | Type | Default | Keterangan |
|-----|------|---------|------------|
| `search` | `string` | - | Kata kunci pencarian |
| `status` | `"ongoing" \| "completed" \| "upcoming" \| "movie"` | - | Filter status |
| `sort` | `"a-z" \| "z-a" \| "oldest" \| "latest" \| "popular" \| "most_viewed" \| "updated"` | `"latest"` / `"updated"` | Urutan |
| `page` | `string` | `"1"` | Halaman |

**Response `data`:**
```json
{
  "animeList": [
    {
      "title": "string",
      "animeId": "string",
      "animeSlug": "string",
      "poster": "string",
      "type": "string",
      "quality": "string",
      "highlight": "string",
      "kuramanimeUrl": "string"
    }
  ],
  "episodeList": null
}
```
> Catatan: Jika `status=ongoing`, yang diisi adalah `episodeList`, bukan `animeList`.

**Response `pagination`:**
```json
{
  "currentPage": 1,
  "prevPage": null,
  "hasPrevPage": false,
  "nextPage": 2,
  "hasNextPage": true,
  "totalPages": 10
}
```

---

## 3. GET `/kuramanime/schedule`

Jadwal rilis anime.

**Query Params:**

| Key | Type | Default | Keterangan |
|-----|------|---------|------------|
| `day` | `"all" \| "monday" \| "tuesday" \| "wednesday" \| "thursday" \| "friday" \| "saturday" \| "sunday" \| "random"` | `"all"` | Filter hari |
| `page` | `string` | `"1"` | Halaman |

**Response `data`:**
```json
{
  "animeList": [
    {
      "title": "string",
      "animeId": "string",
      "animeSlug": "string",
      "poster": "string",
      "type": "string",
      "quality": "string",
      "day": "string",
      "releaseTime": "string",
      "kuramanimeUrl": "string"
    }
  ]
}
```

---

## 4. GET `/kuramanime/properties/:propertyType`

Daftar properti (genre, season, studio, dll).

**Path Params:**

| Key | Value |
|-----|-------|
| `propertyType` | `"genre" \| "season" \| "studio" \| "type" \| "quality" \| "source" \| "country"` |

**Response `data`:**
```json
{
  "propertyType": "genre",
  "propertyList": [
    {
      "title": "Action",
      "propertyId": "action",
      "kuramanimeUrl": "string"
    }
  ]
}
```

---

## 5. GET `/kuramanime/properties/:propertyType/:propertyId`

Daftar anime berdasarkan properti.

**Path Params:**

| Key | Value |
|-----|-------|
| `propertyType` | `"genre" \| "season" \| "studio" \| "type" \| "quality" \| "source" \| "country"` |
| `propertyId` | `string` — ID properti dari endpoint #4 |

**Query Params:** `sort`, `page` (sama seperti endpoint #2)

**Response `data`:**
```json
{
  "animeList": [ { "...IAnimeCard" } ]
}
```

---

## 6. GET `/kuramanime/anime/:animeId/:animeSlug`

Detail lengkap satu anime beserta daftar semua episode.

**Path Params:**

| Key | Contoh |
|-----|--------|
| `animeId` | `185` |
| `animeSlug` | `naruto` |

**Response `data`:**
```json
{
  "details": {
    "title": "string",
    "alternativeTitle": "string",
    "animeId": "string",
    "animeSlug": "string",
    "poster": "string",
    "synopsis": {
      "paragraphList": ["string"]
    },
    "episodes": "220",
    "aired": "string",
    "duration": "string",
    "score": "string",
    "fans": "string",
    "rating": "string",
    "credit": "string",
    "explicit": "string",
    "episode": {
      "first": 1,
      "last": 220
    },
    "episodeList": [
      {
        "title": "Ep 1",
        "episodeId": "1",
        "animeId": "185",
        "animeSlug": "naruto",
        "kuramanimeUrl": "string"
      }
    ],
    "episodeNextPage": null,
    "type": {
      "title": "string",
      "propertyType": "type",
      "propertyId": "string",
      "kuramanimeUrl": "string"
    },
    "status": { "...ITextPropertyTypeCard" },
    "season": { "...ITextPropertyTypeCard" },
    "quality": { "...ITextPropertyTypeCard" },
    "country": { "...ITextPropertyTypeCard" },
    "source": { "...ITextPropertyTypeCard" },
    "genreList": [ { "...ITextPropertyTypeCard" } ],
    "themeList": [ { "...ITextPropertyTypeCard" } ],
    "demographicList": [ { "...ITextPropertyTypeCard" } ],
    "studioList": [ { "...ITextPropertyTypeCard" } ],
    "batchList": [
      {
        "title": "string",
        "batchId": "string",
        "animeId": "string",
        "animeSlug": "string",
        "kuramanimeUrl": "string"
      }
    ],
    "similarAnimeList": [
      {
        "title": "string",
        "animeId": "string",
        "animeSlug": "string",
        "kuramanimeUrl": "string"
      }
    ]
  }
}
```

---

## 7. GET `/kuramanime/episode/:animeId/:animeSlug/:episodeId`

Detail episode beserta streaming URL dan link download.

> ⚠️ **Response time ~12-15 detik** karena menggunakan headless browser (Puppeteer) untuk mendapatkan URL streaming.

**Path Params:**

| Key | Contoh |
|-----|--------|
| `animeId` | `5029` |
| `animeSlug` | `clevatess-ii-majuu-no-ou-to-itsuwari-no-yuusha-denshou` |
| `episodeId` | `6` |

**Response `data`:**
```json
{
  "details": {
    "title": "string",
    "episodeTitle": "string",
    "animeId": "string",
    "animeSlug": "string",
    "lastUpdated": "string",
    "hasPrevEpisode": true,
    "prevEpisode": {
      "title": "Prev episode",
      "episodeId": "5",
      "animeId": "string",
      "animeSlug": "string",
      "kuramanimeUrl": "string"
    },
    "hasNextEpisode": false,
    "nextEpisode": null,
    "episode": {
      "first": 1,
      "last": 1
    },
    "server": {
      "qualityList": [
        {
          "title": "720",
          "urlList": [
            {
              "title": "kuramadrive",
              "url": "https://r2.cloudflarestorage.com/..."
            }
          ]
        },
        {
          "title": "480",
          "urlList": [ { "title": "kuramadrive", "url": "string" } ]
        },
        {
          "title": "360",
          "urlList": [ { "title": "kuramadrive", "url": "string" } ]
        }
      ]
    },
    "download": {
      "qualityList": [
        {
          "title": "MKV 720p (Softsub)",
          "size": "",
          "urlList": [
            { "title": "Extra 1", "url": "https://pixeldrain.com/..." },
            { "title": "Extra 2", "url": "https://mypikpak.com/..." },
            { "title": "Extra 3", "url": "https://www.dropbox.com/..." },
            { "title": "kDrive", "url": "https://v1.kuramadrive.com/kdrive/..." },
            { "title": "kTurbo", "url": "https://v1.kuramadrive.com/kturbo/..." },
            { "title": "MEGA", "url": "https://mega.co.nz/..." }
          ]
        }
      ]
    }
  }
}
```

---

## 8. GET `/kuramanime/batch/:animeId/:animeSlug/:batchId`

Detail batch download (kumpulan semua episode).

**Path Params:**

| Key | Keterangan |
|-----|------------|
| `animeId` | ID anime |
| `animeSlug` | Slug anime |
| `batchId` | ID batch dari `batchList` di detail anime |

**Response `data`:**
```json
{
  "details": {
    "title": "string",
    "batchTitle": "string",
    "animeId": "string",
    "animeSlug": "string",
    "download": {
      "qualityList": [
        {
          "title": "720p",
          "size": "1.2 GB",
          "urlList": [
            { "title": "GDrive", "url": "string" },
            { "title": "Mega", "url": "string" }
          ]
        }
      ]
    }
  }
}
```

---

## Contoh Penggunaan (Frontend)

### Fetch daftar anime (search)
```js
const res = await fetch('/kuramanime/anime?search=naruto&page=1')
const { data, pagination } = await res.json()
// data.animeList = array of anime
```

### Fetch detail anime + episode list
```js
const res = await fetch('/kuramanime/anime/185/naruto')
const { data } = await res.json()
// data.details.episodeList = array semua episode
// data.details.episode.first / .last = range episode
```

### Fetch streaming episode
```js
// ⚠️ Tambahkan loading state karena response ~12-15 detik
const res = await fetch('/kuramanime/episode/185/naruto/1')
const { data } = await res.json()
// data.details.server.qualityList[0].urlList[0].url = URL streaming 720p
// data.details.download.qualityList = link download
```

### Navigasi episode
```js
// Dari response episode, gunakan:
const prev = data.details.prevEpisode?.episodeId  // null jika episode pertama
const next = data.details.nextEpisode?.episodeId  // null jika episode terakhir

if (next) {
  fetch(`/kuramanime/episode/${animeId}/${animeSlug}/${next}`)
}
```
