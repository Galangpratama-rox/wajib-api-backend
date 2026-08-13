import * as T from "../interfaces/kuramanime.interface.js";
import * as v from "valibot";
import { parse } from "node-html-parser";
import mainParser from "./main/main.parser.js";
import kuramanimeExtraParser from "./extra/kuramanime.extra.parser.js";
import errorinCuy from "../helpers/errorinCuy.js";
import kuramanimeSchema from "../schemas/kuramanime.schema.js";
import kuramanimeConfig from "../configs/kuramanime.config.js";
import { isBlockedContent, shouldBlock } from "../helpers/contentFilter.js";
const { Text, Attr, Id, Num, Src, AnimeSrc } = mainParser;
const { baseUrl } = kuramanimeConfig;
const kuramanimeParser = {
    parseHome(document) {
        const home = {
            ongoing: {
                kuramanimeUrl: "",
                episodeList: [],
            },
            completed: {
                kuramanimeUrl: "",
                animeList: [],
            },
            movie: {
                kuramanimeUrl: "",
                animeList: [],
            },
        };
        const homeElems = document.querySelectorAll(".product.spad .trending__product");
        homeElems.forEach((homeEl, index) => {
            const kuramanimeUrl = AnimeSrc(homeEl.querySelector(".btn__all a"));
            const animeElems = homeEl.querySelectorAll(".row .product__item");
            const animeList = animeElems.map((animeEl) => {
                const animeCard = kuramanimeExtraParser.parseAnimeCard(animeEl);
                return animeCard;
            });
            const episodeList = animeElems.map((animeEl) => {
                const episodeCard = kuramanimeExtraParser.parseEpisodeCard(animeEl);
                return episodeCard;
            });
            const key = index === 0 ? "ongoing" : index === 1 ? "completed" : "movie";
            home[key].kuramanimeUrl = kuramanimeUrl;
            home[index === 1 ? "completed" : "movie"].animeList = animeList;
            if (index === 0) {
                home.ongoing.episodeList = episodeList;
            }
        });
        return home;
    },
    parseAnimes(document) {
        const animeElems = document.querySelectorAll("#animeList .product__item");
        const animeList = animeElems
            .map((animeEl) => kuramanimeExtraParser.parseAnimeCard(animeEl))
            .filter((a) => !shouldBlock(a.title, a.animeSlug, a.kuramanimeUrl));
        if (animeList.length === 0) {
            throw errorinCuy(404);
        }
        return animeList;
    },
    parseScheduledAnimes(document, throwOnEmpty = true) {
        const animeElems = document.querySelectorAll("#animeList .product__item");
        const animeList = animeElems
            .map((animeEl) => kuramanimeExtraParser.parseScheduledAnimeCard(animeEl))
            .filter((a) => !shouldBlock(a.title, a.animeSlug, a.kuramanimeUrl));
        if (animeList.length === 0 && throwOnEmpty) {
            throw errorinCuy(404);
        }
        return animeList;
    },
    parseEpisodes(document) {
        const episodeElems = document.querySelectorAll("#animeList .product__item");
        const episodeList = episodeElems
            .map((animeEl) => kuramanimeExtraParser.parseEpisodeCard(animeEl))
            .filter((a) => !shouldBlock(a.title, a.animeSlug, a.kuramanimeUrl));
        if (episodeList.length === 0) {
            throw errorinCuy(404);
        }
        return episodeList;
    },
    parseProperties(document) {
        const propertyElems = document.querySelectorAll("#animeList ul li a");
        const propertyList = propertyElems.map((propertyEl) => {
            const { id, title, kuramanimeUrl } = kuramanimeExtraParser.parseTextCard(propertyEl);
            return { title, propertyId: id, kuramanimeUrl };
        });
        if (propertyList.length === 0) {
            throw errorinCuy(404);
        }
        return propertyList;
    },
    parseAnimeDetails(document, { animeId, animeSlug }) {
        const title = Text(document.querySelector(".anime__details__title h3"));
        const alternativeTitle = Text(document.querySelector(".anime__details__title h3")?.nextElementSibling);
        const poster = Attr(document.querySelector(".anime__details__pic"), "data-setbg");
        const synopsis = {
            paragraphList: document
                .querySelectorAll("#synopsisField br")
                .map((pEl) => {
                const paragraph = pEl.previousSibling?.text.trim();
                if (paragraph && paragraph !== "\n") {
                    return paragraph;
                }
                return "";
            })
                .filter((p) => p !== ""),
        };
        synopsis.paragraphList.push(Text(document.querySelector("#synopsisField i")));
        const episodeListEl = parse(Attr(document.querySelector("#episodeLists"), "data-content").trim());
        let firstEpisode = null;
        let lastEpisode = null;
        let firstEpisodeByIndex = null;
        let lastEpisodeByIndex = null;
        const episodeElems = episodeListEl.querySelectorAll("a");
        const episodeList = [];
        episodeElems.forEach((episodeEl, index) => {
            const text = Text(episodeEl);
            const match = text.match(/\b(\d+)\b/);
            const episode = match ? Number(match[1]) : null;
            const rawId = Id(episodeEl);
            const isValidEpisode = /^\d+$/.test(rawId);
            if (text.includes("Terlama")) {
                firstEpisode = episode;
            }
            else if (text.includes("Terbaru")) {
                lastEpisode = episode;
            }
            else if (isValidEpisode) {
                if (firstEpisodeByIndex === null) {
                    firstEpisodeByIndex = episode;
                }
                lastEpisodeByIndex = episode;
                episodeList.push({
                    title: text,
                    episodeId: rawId,
                    animeId,
                    animeSlug,
                    kuramanimeUrl: AnimeSrc(episodeEl),
                });
            }
        });
        // Cek apakah ada next page di episode list
        const episodeNextPageEl = episodeListEl.querySelector("a[href*='page=']");
        const episodeNextPage = episodeNextPageEl
            ? episodeNextPageEl.getAttribute("href")?.match(/page=(\d+)/)?.[1]
            : null;
        const infoElems = document.querySelectorAll(".anime__details__widget ul li .col-9");
        const getInfo = kuramanimeExtraParser.parseInfo(infoElems);
        const getInfoProperty = kuramanimeExtraParser.parseInfoProperty(infoElems);
        const getInfoProperties = kuramanimeExtraParser.parseInfoProperties(infoElems);
        const batchElems = parse(Attr(document.querySelector("#episodeBatchLists"), "data-content").trim()).querySelectorAll("a");
        const batchList = batchElems.map((batchEl) => {
            return {
                title: Text(batchEl),
                batchId: Id(batchEl),
                animeId,
                animeSlug,
                kuramanimeUrl: AnimeSrc(batchEl),
            };
        });
        const similarAnimeElems = document.querySelectorAll(".breadcrumb__links__v2 a");
        const similarAnimeList = similarAnimeElems.map((animeEl) => {
            return {
                title: Text(animeEl).replace("- ", ""),
                animeId: kuramanimeExtraParser.parseAnimeId(animeEl),
                animeSlug: Id(animeEl),
                kuramanimeUrl: AnimeSrc(animeEl),
            };
        });
        const explicitValue = getInfo(10);
        const genreListValue = getInfoProperties(9);
        // Block hentai/explicit content at detail level
        if (isBlockedContent({ explicit: explicitValue, genreList: genreListValue })) {
            throw errorinCuy(403);
        }
        return {
            title,
            alternativeTitle,
            animeId,
            animeSlug,
            poster,
            synopsis,
            episode: {
                first: firstEpisode || firstEpisodeByIndex,
                last: lastEpisode || lastEpisodeByIndex || firstEpisodeByIndex,
            },
            episodeList,
            episodeNextPage: episodeNextPage ? Number(episodeNextPage) : null,
            episodes: getInfo(1),
            aired: getInfo(3).replace(/\s+/g, " ").trim(),
            duration: getInfo(5),
            explicit: explicitValue,
            score: getInfo(14),
            fans: getInfo(15),
            rating: getInfo(16),
            credit: getInfo(17),
            type: getInfoProperty(0),
            status: getInfoProperty(2),
            season: getInfoProperty(4),
            quality: getInfoProperty(6),
            country: getInfoProperty(7),
            source: getInfoProperty(8),
            genreList: genreListValue,
            themeList: getInfoProperties(12),
            demographicList: getInfoProperties(11),
            studioList: getInfoProperties(13),
            batchList,
            similarAnimeList: similarAnimeList.filter((a) => !shouldBlock(a.title, a.animeSlug, a.kuramanimeUrl)),
        };
    },
    parseBatchDetails(document, { animeId, animeSlug }) {
        const batchTitleEl = document.querySelector(".breadcrumb__links #episodeTitle");
        const downloadQualityElems = document.querySelectorAll("#animeDownloadLink h6");
        const download = {
            qualityList: downloadQualityElems.map((downloadQualityEl) => {
                const title = Text(downloadQualityEl);
                const urlList = [];
                let urlEl = downloadQualityEl;
                while (urlEl) {
                    if (urlEl.tagName === "A") {
                        urlList.push({
                            title: Text(urlEl),
                            url: Attr(urlEl, "href"),
                        });
                    }
                    else if (urlEl.tagName === "BR") {
                        break;
                    }
                    urlEl = urlEl?.nextElementSibling;
                }
                return {
                    title: title.split("—")[0]?.trim() || "",
                    size: title.split("—")[1]?.trim().replace(/\(|\)/g, "") || "",
                    urlList,
                };
            }),
        };
        return {
            title: Text(batchTitleEl?.previousElementSibling),
            batchTitle: Text(batchTitleEl),
            animeId,
            animeSlug,
            download,
        };
    },
    parseEpisodeDetails(document, { animeId, animeSlug }, browserResult) {
        const episodeTitleEl = document.querySelector(".breadcrumb__links #episodeTitle");
        // Use prev/next from Puppeteer result if available (more reliable)
        let prevEpisode = null;
        let nextEpisode = null;
        if (browserResult?.prevEpisodeHref) {
            const href = browserResult.prevEpisodeHref;
            const epId = href.split("/").pop() || "";
            prevEpisode = {
                title: "Prev episode",
                episodeId: epId,
                animeId,
                animeSlug,
                kuramanimeUrl: `${baseUrl}${href.startsWith("/") ? href.slice(1) : href}`,
            };
        }
        if (browserResult?.nextEpisodeHref) {
            const href = browserResult.nextEpisodeHref;
            const epId = href.split("/").pop() || "";
            nextEpisode = {
                title: "Next episode",
                episodeId: epId,
                animeId,
                animeSlug,
                kuramanimeUrl: `${baseUrl}${href.startsWith("/") ? href.slice(1) : href}`,
            };
        }
        // Use server/download from Puppeteer result if available, else empty
        const server = browserResult?.server ?? { qualityList: [] };
        const download = browserResult?.download ?? { qualityList: [] };
        return {
            title: Text(episodeTitleEl?.previousElementSibling),
            episodeTitle: Text(episodeTitleEl),
            animeId,
            animeSlug,
            lastUpdated: Text(document.querySelector(".breadcrumb__links__v2 span:last-child"))
                .replace(/\s+/g, " ")
                .trim(),
            prevEpisode,
            hasPrevEpisode: prevEpisode ? true : false,
            nextEpisode,
            hasNextEpisode: nextEpisode ? true : false,
            episode: {
                first: 1,
                last: 1,
            },
            server,
            download,
        };
    },
    // Parse hanya episode list dari satu halaman (untuk parallel fetch)
    parseEpisodeListFromPage(document, { animeId, animeSlug }) {
        const episodeListEl = parse(Attr(document.querySelector("#episodeLists"), "data-content").trim());
        const episodeElems = episodeListEl.querySelectorAll("a");
        const episodeList = [];
        episodeElems.forEach((episodeEl) => {
            const text = Text(episodeEl);
            const rawId = Id(episodeEl);
            const isValidEpisode = /^\d+$/.test(rawId);
            if (!text.includes("Terlama") && !text.includes("Terbaru") && isValidEpisode) {
                episodeList.push({
                    title: text,
                    episodeId: rawId,
                    animeId,
                    animeSlug,
                    kuramanimeUrl: AnimeSrc(episodeEl),
                });
            }
        });
        return episodeList;
    },
    parsePagination(document) {
        const paginationEl = document.querySelector(".product__pagination");
        if (paginationEl) {
            const pagination = {
                currentPage: null,
                prevPage: null,
                hasPrevPage: false,
                nextPage: null,
                hasNextPage: false,
                totalPages: null,
            };
            const currentPageEl = paginationEl.querySelector(".current-page");
            const prevPageEl = paginationEl.querySelector(".page__link:first-child");
            const prevPageVal = prevPageEl?.getAttribute("href")?.match(/(?:\?|&)page=(\d+)/)?.[1];
            const nextPageEl = paginationEl.querySelector(".page__link:last-child");
            const nextPageVal = nextPageEl?.getAttribute("href")?.match(/(?:\?|&)page=(\d+)/)?.[1];
            const totalPagesEl = paginationEl.querySelector("a:last-child")?.previousElementSibling;
            pagination.currentPage = Number(Text(currentPageEl)) || null;
            pagination.prevPage =
                pagination.currentPage && Number(prevPageVal) < pagination.currentPage
                    ? Number(prevPageVal) || null
                    : null;
            pagination.hasPrevPage = pagination.prevPage ? true : false;
            pagination.nextPage =
                pagination.currentPage && Number(nextPageVal) > pagination.currentPage
                    ? Number(nextPageVal) || null
                    : null;
            pagination.hasNextPage = pagination.nextPage ? true : false;
            pagination.totalPages = Number(Text(totalPagesEl)) || null;
            return pagination;
        }
        return undefined;
    },
};
export default kuramanimeParser;
