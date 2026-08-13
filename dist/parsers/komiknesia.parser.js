const komiknesiaParser = {
    /**
     * Normalize raw IKomiknesiaContent → IKomikCard
     */
    parseKomikCard(raw) {
        return {
            id: raw.id,
            title: raw.title,
            alternativeTitle: raw.alternative_name || "",
            slug: raw.slug,
            cover: raw.thumbnail || raw.cover || "",
            type: raw.content_type || "",
            status: raw.status || "",
            rating: raw.rating ?? 0,
            totalViews: raw.total_views ?? 0,
            isProject: raw.is_project ?? false,
            author: raw.author || "",
            genreList: Array.isArray(raw.genres) ? raw.genres.map((g) => ({
                id: g.id,
                name: g.name,
                slug: g.slug,
            })) : [],
            latestChapters: Array.isArray(raw.lastChapters) ? raw.lastChapters.map((c) => ({
                number: c.number,
                title: c.title,
                slug: c.slug,
                updatedAt: c.updated_at?.time ?? 0,
            })) : [],
        };
    },
    parseKomikList(raw) {
        return {
            komikList: (raw.data || []).map((item) => this.parseKomikCard(item)),
            pagination: {
                currentPage: raw.meta?.page ?? 1,
                prevPage: (raw.meta?.page ?? 1) > 1 ? (raw.meta.page - 1) : null,
                hasPrevPage: (raw.meta?.page ?? 1) > 1,
                nextPage: (raw.meta?.page ?? 1) < (raw.meta?.total_pages ?? 1) ? (raw.meta.page + 1) : null,
                hasNextPage: (raw.meta?.page ?? 1) < (raw.meta?.total_pages ?? 1),
                totalPages: raw.meta?.total_pages ?? null,
            },
        };
    },
    /**
     * Parse detail komik dari endpoint GET /api/comic/:slug
     */
    parseKomikDetails(raw) {
        return {
            id: raw.id,
            title: raw.title,
            alternativeTitle: raw.alternative_name || "",
            slug: raw.slug,
            cover: raw.thumbnail || raw.cover || "",
            synopsis: raw.sinopsis || "",
            type: raw.content_type || "",
            status: raw.status || "",
            author: raw.author || "",
            artist: raw.artist || "",
            rating: raw.rating ?? 0,
            totalViews: raw.total_views ?? 0,
            bookmarkCount: raw.bookmark_count ?? 0,
            country: raw.country_id || null,
            isProject: raw.is_project ?? false,
            genreList: Array.isArray(raw.genres) ? raw.genres.map((g) => ({
                id: g.id,
                name: g.name,
                slug: g.slug,
            })) : [],
            chapterList: Array.isArray(raw.chapters) ? raw.chapters.map((c) => ({
                number: c.number,
                title: c.title,
                slug: c.slug,
                updatedAt: c.updated_at?.time ?? 0,
            })) : [],
        };
    },
    /**
     * Parse data baca chapter dari endpoint GET /api/chapters/slug/:slug
     * Struktur real API: { images: string[], number: string, content: {...}, chapters: [...] }
     */
    parseChapterDetails(raw, komikSlug) {
        return {
            number: raw.number || "",
            komikSlug,
            komikTitle: raw.content?.title || "",
            komikCover: raw.content?.cover || "",
            komikType: raw.content?.content_type || "",
            komikStatus: raw.content?.status || "",
            genreList: Array.isArray(raw.content?.genres)
                ? raw.content.genres.map((g) => ({
                    id: g.id,
                    name: g.name,
                    slug: g.slug,
                }))
                : [],
            imageList: Array.isArray(raw.images) ? raw.images.filter(Boolean) : [],
            chapterList: Array.isArray(raw.chapters)
                ? raw.chapters.map((c) => ({
                    id: c.id ?? 0,
                    number: c.number || "",
                    title: c.title || "",
                    slug: c.slug || "",
                    createdAt: c.created_at?.time ?? 0,
                }))
                : [],
        };
    },
};
export default komiknesiaParser;
