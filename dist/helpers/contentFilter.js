/**
 * Content filter — block hentai and explicit content
 * Applied at backend level so all clients are covered
 */
const BLOCKED_GENRES = new Set([
    "hentai",
    "ecchi",
    "adult",
    "18+",
    "r-18",
    "r18",
    "ero",
    "eroge",
    "erotis",
    "explicit",
    "harem",
    "ahegao",
    "doujin",
    "doujinshi",
]);
// Keywords in slug/title that indicate hentai content
const BLOCKED_SLUG_KEYWORDS = [
    "hentai",
    "-h-",
    "18plus",
    "r18",
    "r-18",
    "ero-",
    "-ero",
    "ecchi",
    "doujin",
];
/**
 * Returns true if the anime should be blocked
 */
export function isBlockedContent(opts) {
    const { title = "", slug = "", url = "", genreList = [], explicit = "" } = opts;
    // Check explicit field (from anime details)
    // Only block if value is clearly explicit (not empty, "none", or unknown "?")
    if (explicit && explicit.toLowerCase() !== "none" && explicit !== "" && explicit !== "?") {
        return true;
    }
    // Check genre list
    if (genreList.length > 0) {
        const hasBlockedGenre = genreList.some((g) => {
            const genreTitle = (g.title || "").toLowerCase();
            const genreId = (g.propertyId || "").toLowerCase();
            return BLOCKED_GENRES.has(genreTitle) || BLOCKED_GENRES.has(genreId);
        });
        if (hasBlockedGenre)
            return true;
    }
    // Check slug/url keywords
    const checkStr = `${slug} ${url} ${title}`.toLowerCase();
    if (BLOCKED_SLUG_KEYWORDS.some((kw) => checkStr.includes(kw))) {
        return true;
    }
    return false;
}
/**
 * Filter an array of anime cards, removing blocked content.
 * Uses a type predicate approach compatible with exactOptionalPropertyTypes.
 */
export function filterAnimeList(list) {
    return list.filter((anime) => {
        return !isBlockedContent({
            title: anime.title,
            slug: anime.animeSlug !== undefined ? anime.animeSlug : "",
            url: anime.kuramanimeUrl !== undefined ? anime.kuramanimeUrl : "",
        });
    });
}
/**
 * Check if a single item should be blocked based on slug/url/title only.
 * Use this when you have a single item with optional fields.
 */
export function shouldBlock(title, slug, url) {
    return isBlockedContent({
        title,
        slug: slug !== undefined ? slug : "",
        url: url !== undefined ? url : "",
    });
}
