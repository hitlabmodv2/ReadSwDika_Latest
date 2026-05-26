#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const __1 = __importDefault(require(".."));
const cookieManager_1 = require("../services/cookieManager");
const logger_1 = require("../lib/logger");
const chalk_1 = __importDefault(require("chalk"));
const downloadManager_1 = require("../services/downloadManager");
const api_1 = require("../constants/api");
const urlExtractors_1 = require("../utils/urlExtractors");
const TIKTOK_URL_REGEX = {
    playlist: /https:\/\/(?:www|m)\.tiktok\.com\/@[\w.-]+\/playlist\/[\w-]+-(\d+)/,
    collection: /https:\/\/(?:www|m)\.tiktok\.com\/@[\w.-]+\/collection\/[\w-]+-(\d+)/,
    video: /https:\/\/(?:www|m)\.tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    photo: /https:\/\/(?:www|m)\.tiktok\.com\/@[\w.-]+\/photo\/(\d+)/,
    shortLink: /https:\/\/(vm|vt|lite)\.tiktok\.com\/[\w\d]+\/?/,
    music: /https:\/\/(?:www|m)\.tiktok\.com\/music\/[\w%-]+-(\d+)/
};
const cookieManager = new cookieManager_1.CookieManager();
commander_1.program
    .name("tiktokdl")
    .description("TikTok downloader and search CLI tool")
    .version("1.0.0");
commander_1.program
    .command("download")
    .description("Download TikTok Video / Slide / Music / Playlist / Collection")
    .argument("<urls...>", "TikTok URLs (Video / Slide / Music / Playlist / Collection)")
    .option("-o, --output <path>", "Output directory path")
    .option("-v, --version <version>", "Downloader version (v1/v2/v3)", "v1")
    .option("-p, --proxy <proxy>", "Proxy URL (http/https/socks)")
    .option("-c, --count <number>", "Number of items to fetch for playlist/collection (default: 20)", (val) => parseInt(val), 20)
    .action(async (urls, options) => {
    const outputPath = options.output || (0, downloadManager_1.getDefaultDownloadPath)();
    const version = options.version.toLowerCase();
    const count = options.count || 20;
    if (!Array.isArray(urls))
        urls = [urls];
    for (const url of urls) {
        try {
            if (!["v1", "v2", "v3"].includes(version)) {
                throw new Error("Invalid version. Use v1, v2 or v3");
            }
            if (TIKTOK_URL_REGEX.playlist.test(url)) {
                logger_1.Logger.info(`Fetching playlist items from: ${url}`);
                const match = url.match(TIKTOK_URL_REGEX.playlist);
                const results = await __1.default.Playlist(match[1], {
                    page: 1,
                    proxy: options.proxy,
                    count: count
                });
                if (results.status === "success" && results.result) {
                    const { itemList } = results.result;
                    logger_1.Logger.info(`Found ${itemList.length} items in playlist. Starting download...`);
                    for (const [index, item] of itemList.entries()) {
                        logger_1.Logger.info(`Downloading [${index + 1}/${itemList.length}]: ${item.id}`);
                        const videoUrl = `https://www.tiktok.com/@${item.author?.uniqueId || "unknown"}/video/${item.id}`;
                        try {
                            const data = await __1.default.Downloader(videoUrl, {
                                version: version,
                                proxy: options.proxy
                            });
                            await (0, downloadManager_1.handleMediaDownload)(data, outputPath, version);
                            logger_1.Logger.success(`Downloaded: ${videoUrl}`);
                        }
                        catch (err) {
                            logger_1.Logger.error(`Failed to download ${videoUrl}: ${err.message}`);
                        }
                    }
                    logger_1.Logger.info("All downloads finished.");
                }
                else {
                    logger_1.Logger.error(`Error: ${results.message}`);
                }
            }
            else if (TIKTOK_URL_REGEX.collection.test(url)) {
                logger_1.Logger.info(`Fetching collection items from: ${url}`);
                const match = url.match(TIKTOK_URL_REGEX.collection);
                const results = await __1.default.Collection(match[1], {
                    page: 1,
                    proxy: options.proxy,
                    count: count
                });
                if (results.status === "success" && results.result) {
                    const { itemList } = results.result;
                    logger_1.Logger.info(`Found ${itemList.length} items in collection. Starting download...`);
                    for (const [index, item] of itemList.entries()) {
                        logger_1.Logger.info(`Downloading [${index + 1}/${itemList.length}]: ${item.id}`);
                        const videoUrl = `https://www.tiktok.com/@${item.author?.uniqueId || "unknown"}/video/${item.id}`;
                        try {
                            const data = await __1.default.Downloader(videoUrl, {
                                version: version,
                                proxy: options.proxy
                            });
                            await (0, downloadManager_1.handleMediaDownload)(data, outputPath, version);
                            logger_1.Logger.success(`Downloaded: ${videoUrl}`);
                        }
                        catch (err) {
                            logger_1.Logger.error(`Failed to download ${videoUrl}: ${err.message}`);
                        }
                    }
                    logger_1.Logger.info("All downloads finished.");
                }
                else {
                    logger_1.Logger.error(`Error: ${results.message}`);
                }
            }
            else if (TIKTOK_URL_REGEX.video.test(url) ||
                TIKTOK_URL_REGEX.shortLink.test(url) ||
                TIKTOK_URL_REGEX.photo.test(url)) {
                logger_1.Logger.info("Fetching media information...");
                const data = await __1.default.Downloader(url, {
                    version: version,
                    proxy: options.proxy
                });
                await (0, downloadManager_1.handleMediaDownload)(data, outputPath, version);
            }
            else {
                logger_1.Logger.error("URL tidak valid atau tidak dikenali: " + url);
            }
        }
        catch (error) {
            logger_1.Logger.error(`Error: ${error.message}`);
        }
    }
});
const cookieCommand = commander_1.program.command("cookie").description("Cookie Manager");
cookieCommand
    .command("set <value>")
    .description("Set a cookie")
    .action((value) => {
    cookieManager.setCookie(value);
    logger_1.Logger.success("Cookie set successfully.");
});
cookieCommand
    .command("get")
    .description("Get cookie value")
    .action(() => {
    const cookie = cookieManager.getCookie();
    if (cookie) {
        logger_1.Logger.info(`Cookie: ${cookie}`);
    }
    else {
        logger_1.Logger.warning("No cookie found.");
    }
});
cookieCommand
    .command("delete")
    .description("Delete cookie")
    .action(() => {
    cookieManager.deleteCookie();
    logger_1.Logger.success("Cookie deleted successfully.");
});
const searchCommand = commander_1.program
    .command("search")
    .description("Search TikTok users or live streams or videos");
searchCommand
    .command("user")
    .description("Search TikTok users")
    .argument("<keyword>", "Search keyword")
    .option("-p, --page <number>", "Page number", "1")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .action(async (keyword, options) => {
    try {
        const page = parseInt(options.page);
        const results = await __1.default.Search(keyword, {
            type: "user",
            cookie: cookieManager.getCookie(),
            page: page,
            proxy: options.proxy
        });
        if (results.status === "success") {
            const data = results.result;
            for (const [index, item] of data.entries()) {
                if (item.type === "user") {
                    logger_1.Logger.info(`---- USER ${index + 1} ----`);
                    logger_1.Logger.result(`Username: ${item.username}`, chalk_1.default.green);
                    logger_1.Logger.result(`Nickname: ${item.nickname}`, chalk_1.default.green);
                    logger_1.Logger.result(`Bio: ${item.signature}`, chalk_1.default.green);
                    logger_1.Logger.result(`Followers: ${item.followerCount}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Verified: ${item.isVerified ? "Yes" : "No"}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Profile URL: ${item.url}`, chalk_1.default.yellow);
                }
            }
            logger_1.Logger.info(`Total users: ${data.length}`);
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
searchCommand
    .command("live")
    .description("Search TikTok live streams")
    .argument("<keyword>", "Search keyword")
    .option("-p, --page <number>", "Page number", "1")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .action(async (keyword, options) => {
    try {
        const page = parseInt(options.page);
        const results = await __1.default.Search(keyword, {
            type: "live",
            cookie: cookieManager.getCookie(),
            page: page,
            proxy: options.proxy
        });
        if (results.status === "success") {
            const data = results.result;
            for (const [index, item] of data.entries()) {
                if (item.type === "live") {
                    logger_1.Logger.info(`---- LIVE ${index + 1} ----`);
                    logger_1.Logger.result(`Title: ${item.liveInfo.title}`, chalk_1.default.green);
                    logger_1.Logger.result(`Nickname: ${item.liveInfo.owner.nickname}`, chalk_1.default.green);
                    logger_1.Logger.result(`Username: ${item.liveInfo.owner.username}`, chalk_1.default.green);
                    logger_1.Logger.result(`Verified: ${item.liveInfo.owner.isVerified ? "Yes" : "No"}`, chalk_1.default.green);
                    logger_1.Logger.result(`Type Third Party: ${item.liveInfo.liveTypeThirdParty ? "Yes" : "No"}`, chalk_1.default.green);
                    logger_1.Logger.result(`Hashtag: ${item.liveInfo.hashtag}`, chalk_1.default.green);
                    logger_1.Logger.info(`---- STATISTICS ----`);
                    logger_1.Logger.result(`Likes: ${item.liveInfo.stats.likeCount}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Views: ${item.liveInfo.stats.viewerCount}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Users: ${item.liveInfo.stats.totalUser}`, chalk_1.default.yellow);
                }
            }
            logger_1.Logger.info(`Total live streams: ${data.length}`);
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
searchCommand
    .command("video")
    .description("Search TikTok videos")
    .argument("<keyword>", "Search keyword")
    .option("-p, --page <number>", "Page number", "1")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .action(async (keyword, options) => {
    try {
        const page = parseInt(options.page);
        const results = await __1.default.Search(keyword, {
            type: "video",
            cookie: cookieManager.getCookie(),
            page: page,
            proxy: options.proxy
        });
        if (results.status === "success") {
            const data = results.result;
            for (const [index, item] of data.entries()) {
                if (item.type === "video") {
                    logger_1.Logger.info(`---- VIDEO ${index + 1} ----`);
                    logger_1.Logger.result(`Video ID: ${item.id}`, chalk_1.default.green);
                    logger_1.Logger.result(`Description: ${item.desc}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Author: ${item.author.nickname}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Video URL: ${api_1._tiktokDesktopUrl}/@${item.author.uniqueId}/video/${item.id}`, chalk_1.default.yellow);
                    logger_1.Logger.info(`---- STATISTICS ----`);
                    logger_1.Logger.result(`Likes: ${item.stats.likeCount}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Favorites: ${item.stats.collectCount}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Views: ${item.stats.playCount}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Shares: ${item.stats.shareCount}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Comments: ${item.stats.commentCount}`, chalk_1.default.yellow);
                }
            }
            logger_1.Logger.info(`Total videos: ${data.length}`);
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("getvideocomments")
    .description("Get comments from a TikTok video")
    .argument("<url>", "TikTok video URL")
    .option("-l, --limit <number>", "Limit of comments", "10")
    .option("-p, --proxy <proxy>", "Proxy URL (http/https/socks)")
    .action(async (url, options) => {
    try {
        const limit = parseInt(options.limit);
        const comments = await __1.default.GetVideoComments(url, {
            commentLimit: limit,
            proxy: options.proxy
        });
        if (comments.status === "success") {
            const data = comments.result;
            for (const [index, comment] of data.entries()) {
                logger_1.Logger.info(`---- COMMENT ${index + 1} ----`);
                logger_1.Logger.result(`Username: ${comment.user.username}`, chalk_1.default.green);
                logger_1.Logger.result(`Text: ${comment.text}`, chalk_1.default.green);
                logger_1.Logger.result(`Likes: ${comment.likeCount}`, chalk_1.default.yellow);
            }
            logger_1.Logger.info(`Total comments: ${data.length}`);
        }
        else {
            logger_1.Logger.error(`Error: ${comments.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("getuserposts")
    .description("Get posts from a TikTok user")
    .argument("<username>", "TikTok username")
    .option("-l, --limit <number>", "Limit of posts", "5")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .action(async (username, options) => {
    try {
        const postLimit = parseInt(options.limit);
        const results = await __1.default.GetUserPosts(username, {
            postLimit: postLimit,
            proxy: options.proxy
        });
        if (results.status === "success") {
            const data = results.result;
            for (const [index, post] of data.entries()) {
                logger_1.Logger.info(`---- POST ${index + 1} ----`);
                logger_1.Logger.result(`Video ID: ${post.id}`, chalk_1.default.green);
                logger_1.Logger.result(`Description: ${post.desc}`, chalk_1.default.yellow);
                logger_1.Logger.info(`---- STATISTICS ----`);
                logger_1.Logger.result(`Likes: ${post.stats.likeCount}`, chalk_1.default.yellow);
                logger_1.Logger.result(`Favorites: ${post.stats.collectCount}`, chalk_1.default.yellow);
                logger_1.Logger.result(`Views: ${post.stats.playCount}`, chalk_1.default.yellow);
                logger_1.Logger.result(`Shares: ${post.stats.shareCount}`, chalk_1.default.yellow);
                logger_1.Logger.result(`Comments: ${post.stats.commentCount}`, chalk_1.default.yellow);
            }
            logger_1.Logger.info(`Total posts: ${data.length}`);
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("getuserreposts")
    .description("Get reposts from a TikTok user")
    .argument("<username>", "TikTok username")
    .option("-l, --limit <number>", "Limit of reposts", "5")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .action(async (username, options) => {
    try {
        const postLimit = parseInt(options.limit);
        const results = await __1.default.GetUserReposts(username, {
            postLimit: postLimit,
            proxy: options.proxy
        });
        if (results.status === "success") {
            const data = results.result;
            for (const [index, repost] of data.entries()) {
                logger_1.Logger.info(`---- REPOST ${index + 1} ----`);
                logger_1.Logger.result(`Video ID: ${repost.id}`, chalk_1.default.green);
                logger_1.Logger.result(`Description: ${repost.desc}`, chalk_1.default.yellow);
                logger_1.Logger.info(`---- STATISTICS ----`);
                logger_1.Logger.result(`Shares: ${repost.stats.shareCount}`, chalk_1.default.yellow);
                if (repost.stats.likeCount) {
                    logger_1.Logger.result(`Likes: ${repost.stats.likeCount}`, chalk_1.default.yellow);
                }
                if (repost.stats.collectCount) {
                    logger_1.Logger.result(`Favorites: ${repost.stats.collectCount}`, chalk_1.default.yellow);
                }
                if (repost.stats.playCount) {
                    logger_1.Logger.result(`Views: ${repost.stats.playCount}`, chalk_1.default.yellow);
                }
                if (repost.stats.commentCount) {
                    logger_1.Logger.result(`Comments: ${repost.stats.commentCount}`, chalk_1.default.yellow);
                }
            }
            logger_1.Logger.info(`Total reposts: ${data.length}`);
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("stalk")
    .description("Stalk a TikTok user")
    .argument("<username>", "TikTok username")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .action(async (username, options) => {
    try {
        const results = await __1.default.StalkUser(username, {
            proxy: options.proxy
        });
        if (results.status === "success") {
            const data = results.result;
            logger_1.Logger.info("---- TIKTOK STALKER ----");
            logger_1.Logger.result(`Username:${data.user.username}`, chalk_1.default.green);
            logger_1.Logger.result(`Nickname:${data.user.nickname}`, chalk_1.default.green);
            logger_1.Logger.result(`Bio:${data.user.signature}`, chalk_1.default.green);
            logger_1.Logger.result(`Verified:${data.user.verified ? "Yes" : "No"}`, chalk_1.default.green);
            logger_1.Logger.result(`Commerce User:${data.user.commerceUser ? "Yes" : "No"}`, chalk_1.default.green);
            logger_1.Logger.result(`Private Account:${data.user.privateAccount ? "Yes" : "No"}`, chalk_1.default.green);
            logger_1.Logger.result(`Region:${data.user.region}`, chalk_1.default.green);
            logger_1.Logger.info("---- STATISTICS ----");
            logger_1.Logger.result(`Followers:${data.stats.followerCount}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Following:${data.stats.followingCount}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Hearts:${data.stats.heartCount}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Videos:${data.stats.videoCount}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Likes:${data.stats.likeCount}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Friends:${data.stats.friendCount}`, chalk_1.default.yellow);
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("collection")
    .description("Get videos from a TikTok collection (supports collection ID or URL)")
    .argument("<collectionIdOrUrl>", "Collection ID or URL (e.g. 7507916135931218695 or https://www.tiktok.com/@username/collection/name-id)")
    .option("-p, --page <number>", "Page number", "1")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .option("-n, --count <number>", "Number of items to fetch", (val) => parseInt(val), 5)
    .action(async (collectionIdOrUrl, options) => {
    try {
        logger_1.Logger.info(`Fetching page ${options.page} with ${options.count} items per page from collection...`);
        const results = await __1.default.Collection(collectionIdOrUrl, {
            page: options.page,
            proxy: options.proxy,
            count: options.count
        });
        if (results.status === "success" && results.result) {
            const { itemList, hasMore } = results.result;
            logger_1.Logger.info(`Found ${itemList.length} videos in collection`);
            logger_1.Logger.info(`Has more videos: ${hasMore}`);
            for (const [index, video] of itemList.entries()) {
                logger_1.Logger.info(`---- VIDEO ${index + 1} ----`);
                logger_1.Logger.result(`Video ID: ${video.id}`, chalk_1.default.green);
                logger_1.Logger.result(`Description: ${video.desc}`, chalk_1.default.yellow);
                logger_1.Logger.result(`Author: ${video.author?.nickname || "Unknown"}`, chalk_1.default.yellow);
                logger_1.Logger.result(`Created: ${new Date(video.createTime * 1000).toLocaleString()}`, chalk_1.default.yellow);
                if (video.statistics) {
                    logger_1.Logger.info(`---- STATISTICS ----`);
                    logger_1.Logger.result(`Likes: ${video.statistics.likeCount || 0}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Comments: ${video.statistics.commentCount || 0}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Shares: ${video.statistics.shareCount || 0}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Plays: ${video.statistics.playCount || 0}`, chalk_1.default.yellow);
                }
                if (video.video) {
                    logger_1.Logger.info(`---- VIDEO URLs ----`);
                    const videoUrl = `${api_1._tiktokDesktopUrl}/@${video.author?.uniqueId || "unknown"}/video/${video.id}`;
                    logger_1.Logger.result(`Video URL: ${videoUrl}`, chalk_1.default.blue);
                }
                if (video.textExtra?.length > 0) {
                    logger_1.Logger.info(`---- HASHTAGS ----`);
                    video.textExtra.forEach((tag) => {
                        if (tag.hashtagName) {
                            logger_1.Logger.result(`#${tag.hashtagName}`, chalk_1.default.cyan);
                        }
                    });
                }
            }
            if (hasMore) {
                logger_1.Logger.info("\nTo fetch more videos, use:");
                logger_1.Logger.info(`tiktokdl collection ${collectionIdOrUrl} -p ${parseInt(options.page) + 1}`);
            }
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("playlist")
    .description("Get videos from a TikTok playlist")
    .argument("<PlaylistIdOrUrl>", "Collection URL (e.g. https://www.tiktok.com/@username/playlist/name-id)")
    .option("-p, --page <number>", "Page number", "1")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .option("-c, --count <number>", "Number of items to fetch (max: 20)", (val) => parseInt(val), 5)
    .option("-r, --raw", "Show raw response", false)
    .action(async (url, options) => {
    try {
        logger_1.Logger.info(`Fetching page ${options.page} with ${options.count} items per page from playlist...`);
        const results = await __1.default.Playlist(url, {
            page: options.page,
            proxy: options.proxy,
            count: options.count
        });
        const contentType = (content) => {
            if (content?.imagePost) {
                return "photo";
            }
            else {
                return "video";
            }
        };
        if (results.status === "success" && results.result) {
            if (options.raw) {
                console.log(JSON.stringify(results.result, null, 2));
                return;
            }
            const { itemList, hasMore } = results.result;
            logger_1.Logger.info(`Found ${itemList.length} items in playlist`);
            logger_1.Logger.info(`Has more items: ${hasMore}`);
            for (const [index, item] of itemList.entries()) {
                logger_1.Logger.info(`---- ITEM ${index + 1} ----`);
                logger_1.Logger.result(`Item ID: ${item.id}`, chalk_1.default.green);
                logger_1.Logger.result(`Description: ${item.desc}`, chalk_1.default.yellow);
                logger_1.Logger.result(`Author: ${item.author?.nickname || "Unknown"}`, chalk_1.default.yellow);
                logger_1.Logger.result(`Created: ${new Date(item.createTime * 1000).toLocaleString()}`, chalk_1.default.yellow);
                if (item.stats) {
                    logger_1.Logger.info(`---- STATISTICS ----`);
                    logger_1.Logger.result(`Comments: ${item.stats.commentCount || 0}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Shares: ${item.stats.shareCount || 0}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Plays: ${item.stats.playCount || 0}`, chalk_1.default.yellow);
                }
                if (item.video) {
                    logger_1.Logger.info(`---- VIDEO URLs ----`);
                    const videoUrl = `${api_1._tiktokDesktopUrl}/@${item.author?.uniqueId || "unknown"}/${contentType(item)}/${item.id}`;
                    logger_1.Logger.result(`Video URL: ${videoUrl}`, chalk_1.default.blue);
                }
            }
            if (hasMore) {
                logger_1.Logger.info("\nTo fetch more videos, use:");
                logger_1.Logger.info(`tiktokdl playlist ${url} -p ${parseInt(options.page) + 1}`);
            }
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("trending")
    .description("Get TikTok trending content and creators")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .option("-c, --creators", "Show only trending creators", false)
    .option("-r, --raw", "Show raw response", false)
    .action(async (options) => {
    try {
        if (options.creators) {
            logger_1.Logger.info("Fetching trending creators...");
            const results = await __1.default.TrendingCreators({
                proxy: options.proxy
            });
            if (results.status === "success" && results.result) {
                if (options.raw) {
                    console.log(JSON.stringify(results.result, null, 2));
                    return;
                }
                logger_1.Logger.info(`Found ${results.result.length} trending creators`);
                results.result.slice(0, 20).forEach((creator, index) => {
                    logger_1.Logger.info(`---- CREATOR ${index + 1} ----`);
                    logger_1.Logger.result(`Username: @${creator.username}`, chalk_1.default.green);
                    logger_1.Logger.result(`Nickname: ${creator.nickname}`, chalk_1.default.green);
                    logger_1.Logger.result(`Verified: ${creator.verified ? "Yes" : "No"}`, chalk_1.default.green);
                    logger_1.Logger.result(`Followers: ${creator.followerCount.toLocaleString()}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Total Likes: ${creator.likeCount.toLocaleString()}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Videos: ${creator.videoCount.toLocaleString()}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Following: ${creator.followingCount.toLocaleString()}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Description: ${creator.description.substring(0, 100)}${creator.description.length > 100 ? "..." : ""}`, chalk_1.default.blue);
                    logger_1.Logger.result(`Profile: https://www.tiktok.com${creator.link}`, chalk_1.default.blue);
                });
                if (results.result.length > 20) {
                    logger_1.Logger.info(`\nShowing first 20 of ${results.result.length} trending creators`);
                }
                const verifiedCount = results.result.filter((c) => c.verified).length;
                const totalFollowers = results.result.reduce((sum, c) => sum + c.followerCount, 0);
                const avgFollowers = Math.round(totalFollowers / results.result.length);
                logger_1.Logger.info(`\n---- STATISTICS ----`);
                logger_1.Logger.result(`Verified creators: ${verifiedCount}/${results.result.length}`, chalk_1.default.cyan);
                logger_1.Logger.result(`Average followers: ${avgFollowers.toLocaleString()}`, chalk_1.default.cyan);
                logger_1.Logger.result(`Total combined followers: ${totalFollowers.toLocaleString()}`, chalk_1.default.cyan);
            }
            else {
                logger_1.Logger.error(`Error: ${results.message}`);
            }
        }
        else {
            logger_1.Logger.info("Fetching trending content...");
            const results = await __1.default.Trending({
                proxy: options.proxy
            });
            if (results.status === "success" && results.result) {
                if (options.raw) {
                    console.log(JSON.stringify(results.result, null, 2));
                    return;
                }
                logger_1.Logger.info(`Found ${results.result.length} trending sections`);
                results.result.forEach((section, sectionIndex) => {
                    logger_1.Logger.info(`\n---- SECTION ${sectionIndex + 1} ----`);
                    logger_1.Logger.result(`Items in section: ${section.exploreList.length}`, chalk_1.default.green);
                    if (section.pageState) {
                        logger_1.Logger.result(`Region: ${section.pageState.region}`, chalk_1.default.yellow);
                        logger_1.Logger.result(`OS: ${section.pageState.os}`, chalk_1.default.yellow);
                    }
                    section.exploreList.slice(0, 5).forEach((item, index) => {
                        const cardItem = item.cardItem;
                        logger_1.Logger.info(`\n  Item ${index + 1}:`);
                        logger_1.Logger.result(`  Title: ${cardItem.title}`, chalk_1.default.green);
                        logger_1.Logger.result(`  Subtitle: ${cardItem.subTitle}`, chalk_1.default.green);
                        logger_1.Logger.result(`  Type: ${cardItem.type}`, chalk_1.default.yellow);
                        logger_1.Logger.result(`  Description: ${cardItem.description.substring(0, 80)}${cardItem.description.length > 80 ? "..." : ""}`, chalk_1.default.blue);
                        if (cardItem.extraInfo) {
                            logger_1.Logger.result(`  Verified: ${cardItem.extraInfo.verified ? "Yes" : "No"}`, chalk_1.default.cyan);
                            logger_1.Logger.result(`  Fans: ${cardItem.extraInfo.fans?.toLocaleString() || "N/A"}`, chalk_1.default.cyan);
                            logger_1.Logger.result(`  Likes: ${cardItem.extraInfo.likes?.toLocaleString() || "N/A"}`, chalk_1.default.cyan);
                            logger_1.Logger.result(`  Videos: ${cardItem.extraInfo.video || "N/A"}`, chalk_1.default.cyan);
                        }
                        logger_1.Logger.result(`  Profile: https://www.tiktok.com${cardItem.link}`, chalk_1.default.blue);
                    });
                    if (section.exploreList.length > 5) {
                        logger_1.Logger.info(`  ... and ${section.exploreList.length - 5} more items`);
                    }
                });
                logger_1.Logger.info("\nTip: Use --creators flag to see only trending creators");
                logger_1.Logger.info("Tip: Use --raw flag to see the complete JSON response");
            }
            else {
                logger_1.Logger.error(`Error: ${results.message}`);
            }
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("getmusicvideos")
    .description("Get videos by music ID or URL")
    .argument("<musicIdOrUrl>", "Music ID or URL (e.g., 6771810675950880769 or https://www.tiktok.com/music/QKThr-6771810675950880769)")
    .option("-p, --page <number>", "Page number", "1")
    .option("-c, --count <number>", "Number of videos per page", "30")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .option("-r, --raw", "Show raw response", false)
    .action(async (musicIdOrUrl, options) => {
    try {
        const page = parseInt(options.page);
        const count = parseInt(options.count);
        logger_1.Logger.info(`Fetching videos for music: ${musicIdOrUrl} (page ${page}, ${count} per page)...`);
        const results = await __1.default.GetVideosByMusicId(musicIdOrUrl, {
            page,
            count,
            proxy: options.proxy
        });
        if (results.status === "success" && results.result) {
            if (options.raw) {
                console.log(JSON.stringify(results.result, null, 2));
                return;
            }
            const { music, videos, totalVideos } = results.result;
            if (music) {
                logger_1.Logger.info("\n---- MUSIC INFO ----");
                logger_1.Logger.result(`Music ID: ${music.id}`, chalk_1.default.green);
                logger_1.Logger.result(`Title: ${music.title}`, chalk_1.default.green);
                logger_1.Logger.result(`Author: ${music.authorName}`, chalk_1.default.green);
                logger_1.Logger.result(`Duration: ${music.duration || "N/A"} seconds`, chalk_1.default.yellow);
                logger_1.Logger.result(`Original: ${music.original ? "Yes" : "No"}`, chalk_1.default.yellow);
            }
            if (videos && videos.length > 0) {
                logger_1.Logger.info(`\nFound ${videos.length} videos`);
                if (totalVideos) {
                    logger_1.Logger.info(`Total videos using this music: ${totalVideos}`);
                }
                videos.slice(0, 10).forEach((video, index) => {
                    logger_1.Logger.info(`\n---- VIDEO ${index + 1} ----`);
                    logger_1.Logger.result(`Video ID: ${video.id}`, chalk_1.default.green);
                    logger_1.Logger.result(`Description: ${video.desc || "N/A"}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Author: ${video.author?.nickname || "Unknown"}`, chalk_1.default.yellow);
                    logger_1.Logger.result(`Username: @${video.author?.uniqueId || "unknown"}`, chalk_1.default.yellow);
                    if (video.stats) {
                        logger_1.Logger.info("---- STATISTICS ----");
                        logger_1.Logger.result(`Likes: ${video.stats.diggCount?.toLocaleString() || 0}`, chalk_1.default.yellow);
                        logger_1.Logger.result(`Comments: ${video.stats.commentCount?.toLocaleString() || 0}`, chalk_1.default.yellow);
                        logger_1.Logger.result(`Shares: ${video.stats.shareCount?.toLocaleString() || 0}`, chalk_1.default.yellow);
                        logger_1.Logger.result(`Plays: ${video.stats.playCount?.toLocaleString() || 0}`, chalk_1.default.yellow);
                    }
                    const videoUrl = `${api_1._tiktokDesktopUrl}/@${video.author?.uniqueId || "unknown"}/video/${video.id}`;
                    logger_1.Logger.result(`Video URL: ${videoUrl}`, chalk_1.default.blue);
                });
                if (videos.length > 10) {
                    logger_1.Logger.info(`\n... and ${videos.length - 10} more videos`);
                }
            }
            else {
                logger_1.Logger.warning("No videos found for this music");
            }
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("getmusicdetail")
    .description("Get detailed information about a music/audio track by music ID or URL")
    .argument("<musicIdOrUrl>", "Music ID or URL (e.g., 6771810675950880769 or https://www.tiktok.com/music/QKThr-6771810675950880769)")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .option("-r, --raw", "Show raw response", false)
    .action(async (musicIdOrUrl, options) => {
    try {
        const cookie = cookieManager.getCookie();
        if (!cookie) {
            logger_1.Logger.error("Cookie is required for this command. Set cookie using: tiktokdl cookie set <value>");
            return;
        }
        logger_1.Logger.info(`Fetching music detail for: ${musicIdOrUrl}...`);
        const results = await __1.default.GetMusicDetail(musicIdOrUrl, {
            cookie,
            proxy: options.proxy
        });
        if (results.status === "success" && results.result) {
            if (options.raw) {
                console.log(JSON.stringify(results.result, null, 2));
                return;
            }
            const { musicInfo, shareMeta } = results.result;
            logger_1.Logger.info("\n==== MUSIC INFORMATION ====");
            logger_1.Logger.result(`Music ID: ${musicInfo.music.id}`, chalk_1.default.green);
            logger_1.Logger.result(`Title: ${musicInfo.music.title}`, chalk_1.default.green);
            logger_1.Logger.result(`Author: ${musicInfo.music.authorName}`, chalk_1.default.green);
            logger_1.Logger.result(`Duration: ${musicInfo.music.duration} seconds`, chalk_1.default.yellow);
            logger_1.Logger.result(`Original: ${musicInfo.music.original ? "Yes" : "No"}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Copyrighted: ${musicInfo.music.isCopyrighted ? "Yes" : "No"}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Private: ${musicInfo.music.private ? "Yes" : "No"}`, chalk_1.default.yellow);
            logger_1.Logger.info("\n==== AUTHOR INFORMATION ====");
            logger_1.Logger.result(`Author ID: ${musicInfo.author.id}`, chalk_1.default.green);
            logger_1.Logger.result(`Nickname: ${musicInfo.author.nickname}`, chalk_1.default.green);
            logger_1.Logger.result(`Username: @${musicInfo.author.uniqueId}`, chalk_1.default.green);
            logger_1.Logger.result(`Signature: ${musicInfo.author.signature || "N/A"}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Verified: ${musicInfo.author.ftc ? "Yes" : "No"}`, chalk_1.default.yellow);
            logger_1.Logger.result(`Private Account: ${musicInfo.author.privateAccount ? "Yes" : "No"}`, chalk_1.default.yellow);
            logger_1.Logger.info("\n==== STATISTICS ====");
            logger_1.Logger.result(`Videos using this music: ${musicInfo.stats.videoCount.toLocaleString()}`, chalk_1.default.cyan);
            logger_1.Logger.info("\n==== URLs ====");
            logger_1.Logger.result(`Play URL: ${musicInfo.music.playUrl}`, chalk_1.default.blue);
            logger_1.Logger.result(`Cover Thumbnail: ${musicInfo.music.coverThumb}`, chalk_1.default.blue);
            logger_1.Logger.result(`Cover Medium: ${musicInfo.music.coverMedium}`, chalk_1.default.blue);
            logger_1.Logger.result(`Cover Large: ${musicInfo.music.coverLarge}`, chalk_1.default.blue);
            if (shareMeta) {
                logger_1.Logger.info("\n==== SHARE META ====");
                logger_1.Logger.result(`Title: ${shareMeta.title}`, chalk_1.default.magenta);
                logger_1.Logger.result(`Description: ${shareMeta.desc}`, chalk_1.default.magenta);
            }
            logger_1.Logger.info("\n✨ Tip: Use the music ID with 'getmusicvideos' command to see videos using this music");
        }
        else {
            logger_1.Logger.error(`Error: ${results.message}`);
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
    }
});
commander_1.program
    .command("downloadmusic")
    .description("Download music/audio from TikTok by music ID or URL (requires cookie)")
    .argument("<musicIdOrUrl>", "Music ID or TikTok music URL (e.g. 7562597337407785760 or https://www.tiktok.com/music/QKThr-6771810675950880769)")
    .option("-o, --output <path>", "Output directory path")
    .option("--proxy <proxy>", "Proxy URL (http/https/socks)")
    .action(async (musicIdOrUrl, options) => {
    try {
        const cookie = cookieManager.getCookie();
        if (!cookie) {
            logger_1.Logger.error("Cookie is required for downloading music. Set cookie using: tiktokdl cookie set <value>");
            logger_1.Logger.info("\n💡 How to get cookie: Open TikTok in your browser, login, open DevTools (F12), go to Application/Storage > Cookies, and copy the cookie value");
            return;
        }
        const outputPath = options.output || (0, downloadManager_1.getDefaultDownloadPath)();
        const musicId = (0, urlExtractors_1.extractMusicId)(musicIdOrUrl);
        if (!musicId) {
            logger_1.Logger.error("Invalid input. Please provide either a music ID (numbers only) or a valid TikTok music URL");
            logger_1.Logger.info("Example URL: https://www.tiktok.com/music/QKThr-6771810675950880769");
            logger_1.Logger.info("Example ID: 7562597337407785760");
            return;
        }
        logger_1.Logger.info(`Starting music download for music ID: ${musicId}`);
        logger_1.Logger.info(`Output directory: ${outputPath}`);
        await (0, downloadManager_1.downloadMusicFromDetail)(musicIdOrUrl, cookie, outputPath, options.proxy);
        logger_1.Logger.success("\n✅ Music download completed!");
        logger_1.Logger.info("\n💡 Tip: Use 'tiktokdl getmusicdetail' to view detailed information about this music");
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
        logger_1.Logger.info("\nPossible issues:\n- Invalid or expired cookie\n- Invalid music ID\n- Network/connection problem\n- Music might be region-restricted");
    }
});
commander_1.program.parse();
