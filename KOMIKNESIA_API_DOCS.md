# Komiknesia API Documentation

Base URL: `http://localhost:3001/komiknesia`

Semua response menggunakan envelope berikut:
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

## Daftar Endpoint

| Method | Path | Keterangan |
|--------|------|------------|
| GET | `/komiknesia` | Info route |
| GET | `/komiknesia/home` | Data halaman beranda |
| GET | `/komiknesia/komik` | Daftar komik + filter + search |
| GET | `/komiknesia/komik/:komikSlug` | Detail komik |
| GET | `/komiknesia/chapter/:komikSlug/:chapterSlug` | Baca chapter (gambar) |
| GET | `/komiknesia/genre` | Daftar semua genre |
| GET | `/komiknesia/genre/:genreId` | Komik berdasarkan genre |

---

## GET `/komiknesia/home`

Data untuk halaman beranda. Mengambil 5 kategori sekaligus secara paralel.

**Response `data`:**
```json
{
  "popularToday":  [ ...IKomikCard ],
  "latestUpdate":  [ ...IKomikCard ],
  "topManga":      [ ...IKomikCard ],
  "topManhwa":     [ ...IKomikCard ],
  "topManhua":     [ ...IKomikCard ]
}
```

**IKomikCard:**
```ts
{
  id:               number
  title:            string
  alternativeTitle: string
  slug:             string        // dipakai sebagai :komikSlug
  cover:            string        // URL gambar cover
  type:             "manga" | "manhwa" | "manhua"
  status:           "ongoing" | "completed"
  rating:           number
  totalViews:       number
  isProject:        boolean
  author:           string
  genreList: [
    { id: number, name: string, slug: string }
  ]
  latestChapters: [
    { number: string, title: string, slug: string, updatedAt: number }
  ]
}
```

---

## GET `/komiknesia/komik`

Daftar komik dengan dukungan search, filter tipe, urutan, dan paginasi.

### Query Parameters

| Parameter | Tipe | Default | Keterangan |
|-----------|------|---------|------------|
| `search` | string | - | Kata kunci pencarian judul |
| `type` | `manga` \| `manhwa` \| `manhua` | - | Filter berdasarkan tipe komik |
| `genre` | string | - | Slug genre (didapat dari `/genre`) |
| `order` | `latest` \| `popular` \| `a-z` \| `z-a` | `latest` | Urutan hasil |
| `page` | string (angka) | `1` | Halaman |

> ⚠️ Filter `status` (ongoing/completed) **tidak didukung** oleh sumber data.

### Contoh Request

```
# Pencarian
GET /komiknesia/komik?search=one+piece

# Filter tipe + urutan
GET /komiknesia/komik?type=manhwa&order=popular

# Search + filter tipe
GET /komiknesia/komik?search=naruto&type=manga

# Filter genre
GET /komiknesia/komik?genre=fantasy&order=latest&page=2

# Paginasi
GET /komiknesia/komik?page=3
```

### Response

```json
{
  "statusCode": 200,
  "data": {
    "komikList": [ ...IKomikCard ]
  },
  "pagination": {
    "currentPage": 1,
    "prevPage": null,
    "hasPrevPage": false,
    "nextPage": 2,
    "hasNextPage": true,
    "totalPages": 621
  }
}
```

---

## GET `/komiknesia/komik/:komikSlug`

Detail lengkap satu komik beserta daftar semua chapter-nya.

### Path Parameter

| Parameter | Keterangan |
|-----------|------------|
| `komikSlug` | Slug komik — ambil dari field `slug` di IKomikCard |

### Contoh Request

```
GET /komiknesia/komik/one-piece
GET /komiknesia/komik/lookism
```

### Response `data.details` — IKomikDetails

```ts
{
  id:               number
  title:            string
  alternativeTitle: string
  slug:             string
  cover:            string        // URL gambar cover
  synopsis:         string
  type:             "manga" | "manhwa" | "manhua"
  status:           "ongoing" | "completed"
  author:           string
  artist:           string
  rating:           number
  totalViews:       number
  bookmarkCount:    number
  country:          string | null
  isProject:        boolean
  genreList: [
    { id: number, name: string, slug: string }
  ]
  chapterList: [
    {
      number:    string   // e.g. "11"
      title:     string   // e.g. "Chapter 11"
      slug:      string   // dipakai sebagai :chapterSlug
      updatedAt: number   // Unix timestamp
    }
  ]
}
```

---

## GET `/komiknesia/chapter/:komikSlug/:chapterSlug`

Mengambil gambar-gambar halaman untuk membaca satu chapter, beserta info navigasi chapter.

### Path Parameters

| Parameter | Keterangan |
|-----------|------------|
| `komikSlug` | Slug komik — ambil dari field `slug` di IKomikCard / IKomikDetails |
| `chapterSlug` | Slug chapter — ambil dari field `slug` di `chapterList` |

### Contoh Request

```
GET /komiknesia/chapter/one-piece/one-piece-chapter-1111-bahasa-indonesia
GET /komiknesia/chapter/lookism/lookism-chapter-500-bahasa-indonesia
```

### Response `data.details` — IChapterDetails

```ts
{
  number:      string        // nomor chapter ini, e.g. "11"
  komikSlug:   string        // slug komik induk
  komikTitle:  string        // judul komik
  komikCover:  string        // URL cover komik
  komikType:   string        // "manga" | "manhwa" | "manhua"
  komikStatus: string        // "ongoing" | "completed"
  genreList: [
    { id: number, name: string, slug: string }
  ]
  imageList:   string[]      // array URL gambar halaman, sudah terurut
  chapterList: [             // semua chapter komik ini (untuk navigasi)
    {
      id:        number
      number:    string      // e.g. "12"
      title:     string      // e.g. "Chapter 12"
      slug:      string      // dipakai untuk berpindah chapter
      createdAt: number      // Unix timestamp
    }
  ]
}
```

> **Cara navigasi chapter:** gunakan `chapterList` untuk prev/next. Cari index chapter saat ini berdasarkan `number`, lalu ambil index sebelum/sesudahnya.

---

## GET `/komiknesia/genre`

Daftar semua genre yang tersedia (90 genre).

### Response `data`

```ts
{
  "genreList": [
    { "id": 1, "name": "Action", "slug": "action" },
    { "id": 2, "name": "Adventure", "slug": "adventure" },
    ...
  ]
}
```

> Gunakan field `slug` untuk filter di endpoint `/komik?genre=<slug>`.

---

## GET `/komiknesia/genre/:genreId`

Daftar komik berdasarkan genre, diurutkan dari update terbaru.

### Path Parameter

| Parameter | Keterangan |
|-----------|------------|
| `genreId` | Slug genre — ambil dari field `slug` di genreList |

### Query Parameters

| Parameter | Tipe | Default | Keterangan |
|-----------|------|---------|------------|
| `page` | string | `1` | Halaman |

### Contoh Request

```
GET /komiknesia/genre/fantasy
GET /komiknesia/genre/romance?page=2
GET /komiknesia/genre/action?page=1
```

### Response

Sama seperti `/komik` — berisi `komikList` dan `pagination`.

---

## Alur Penggunaan Umum

### 1. Halaman Beranda
```
GET /komiknesia/home
→ tampilkan popularToday, latestUpdate, topManga, topManhwa, topManhua
```

### 2. Halaman Daftar / Jelajah
```
# Default (terbaru)
GET /komiknesia/komik

# Filter manhwa populer
GET /komiknesia/komik?type=manhwa&order=popular

# Cari judul
GET /komiknesia/komik?search=tower+of+god
```

### 3. Halaman Detail Komik
```
# Ambil slug dari komikList
GET /komiknesia/komik/tower-of-god

→ tampilkan info + chapterList
→ slug dari chapterList dipakai untuk baca chapter
```

### 4. Halaman Baca Chapter
```
# Ambil slug komik dan slug chapter dari detail
GET /komiknesia/chapter/tower-of-god/tower-of-god-chapter-1-bahasa-indonesia

→ render imageList satu per satu (scroll reader)
→ gunakan chapterList untuk tombol prev/next chapter
```

### 5. Halaman Genre
```
# Ambil daftar genre
GET /komiknesia/genre

# Pilih satu genre
GET /komiknesia/genre/fantasy?page=1
```
