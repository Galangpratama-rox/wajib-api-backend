// ─── Raw API response types ───────────────────────────────────────────────────

export interface IKomiknesiaGenre {
  id: number;
  name: string;
  slug: string;
}

export interface IKomiknesiaChapterItem {
  number: string;
  title: string;
  slug: string;
  created_at: { time: number };
  updated_at: { time: number };
}

// Raw response dari GET /api/comic/:slug
export interface IKomiknesiaComicDetailRaw {
  id: number;
  title: string;
  slug: string;
  alternative_name: string;
  author: string;
  artist?: string;
  sinopsis: string;
  cover: string;
  thumbnail: string;
  content_type: string;
  country_id: string | null;
  color: boolean;
  hot: boolean;
  is_project: boolean;
  is_safe: boolean;
  rating: number;
  bookmark_count: number;
  total_views: number;
  release: string | null;
  status: string;
  genres: IKomiknesiaGenre[];
  chapters?: IKomiknesiaChapterItem[];
  lastChapters?: IKomiknesiaChapterItem[];
}

// Raw response dari GET /api/chapters/slug/:slug
export interface IKomiknesiaChapterReadRaw {
  images: string[];
  number: string;
  content?: {
    id?: number;
    title?: string;
    slug?: string;
    alternative_name?: string | null;
    author?: string;
    sinopsis?: string;
    cover?: string;
    content_type?: string;
    status?: string;
    genres?: IKomiknesiaGenre[];
  };
  chapters?: {
    id?: number;
    number?: string;
    title?: string;
    slug?: string;
    views?: number;
    created_at?: { time: number; formatted: string };
  }[];
}

export interface IKomiknesiaContent {
  id: number;
  title: string;
  slug: string;
  alternative_name: string;
  author: string;
  sinopsis: string;
  cover: string;
  thumbnail: string;
  content_type: string;    // "manga" | "manhwa" | "manhua"
  country_id: string | null;
  color: boolean;
  hot: boolean;
  is_project: boolean;
  is_safe: boolean;
  rating: number;
  bookmark_count: number;
  total_views: number;
  release: string | null;
  status: string;          // "ongoing" | "completed"
  genres: IKomiknesiaGenre[];
  lastChapters: IKomiknesiaChapterItem[];
}

export interface IKomiknesiaListResponse {
  status: boolean;
  data: IKomiknesiaContent[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// ─── Normalized response types (dikembalikan ke frontend) ─────────────────────

export interface IKomikCard {
  id: number;
  title: string;
  alternativeTitle: string;
  slug: string;
  cover: string;
  type: string;
  status: string;
  rating: number;
  totalViews: number;
  isProject: boolean;
  author: string;
  genreList: { id: number; name: string; slug: string }[];
  latestChapters: {
    number: string;
    title: string;
    slug: string;
    updatedAt: number;
  }[];
}

export interface IChapterPage {
  id: number;
  order: number;
  image_url: string;
  width: number | null;
  height: number | null;
}

export interface IChapterDetails {
  number: string;
  komikSlug: string;
  komikTitle: string;
  komikCover: string;
  komikType: string;
  komikStatus: string;
  genreList: { id: number; name: string; slug: string }[];
  imageList: string[];
  chapterList: {
    id: number;
    number: string;
    title: string;
    slug: string;
    createdAt: number;
  }[];
}

export interface IKomikDetails {
  id: number;
  title: string;
  alternativeTitle: string;
  slug: string;
  cover: string;
  synopsis: string;
  type: string;
  status: string;
  author: string;
  artist: string;
  rating: number;
  totalViews: number;
  bookmarkCount: number;
  country: string | null;
  isProject: boolean;
  genreList: { id: number; name: string; slug: string }[];
  chapterList: {
    number: string;
    title: string;
    slug: string;
    updatedAt: number;
  }[];
}
