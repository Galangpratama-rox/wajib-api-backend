import * as v from "valibot";
const page = v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(6), v.regex(/^([1-9]\d*)$/, "invalid page")));
const komiknesiaSchema = {
    query: {
        komiks: v.object({
            search: v.optional(v.string()),
            genre: v.optional(v.string()),
            type: v.optional(v.union([
                v.literal("manga"),
                v.literal("manhwa"),
                v.literal("manhua"),
            ])),
            order: v.optional(v.union([
                v.literal("latest"),
                v.literal("popular"),
                v.literal("a-z"),
                v.literal("z-a"),
            ])),
            page,
        }),
    },
    param: {
        komikDetails: v.object({
            komikSlug: v.string(),
        }),
        chapterDetails: v.object({
            komikSlug: v.string(),
            chapterSlug: v.string(),
        }),
        genreKomiks: v.object({
            genreId: v.string(),
        }),
    },
};
export default komiknesiaSchema;
