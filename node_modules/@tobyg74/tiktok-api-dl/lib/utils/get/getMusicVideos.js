"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMusicVideos = void 0;
const axios_1 = __importDefault(require("axios"));
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const tiktokService_1 = require("../../services/tiktokService");
const async_retry_1 = __importDefault(require("async-retry"));
const urlExtractors_1 = require("../urlExtractors");
const getMusicVideos = (musicIdOrUrl, proxy, page, count) => new Promise(async (resolve) => {
    try {
        const musicId = (0, urlExtractors_1.extractMusicId)(musicIdOrUrl);
        if (!musicId) {
            return resolve({
                status: "error",
                message: "Invalid music ID or URL format"
            });
        }
        const data = await parseMusicVideos(musicId, page || 1, count || 30, proxy);
        if (!data.videos || data.videos.length === 0) {
            return resolve({
                status: "error",
                message: "No videos found for this music ID!"
            });
        }
        resolve({
            status: "success",
            result: data
        });
    }
    catch (err) {
        if (err.status === 400 ||
            (err.response?.data && err.response.data.statusCode === 10201)) {
            return resolve({
                status: "error",
                message: "Music not found!"
            });
        }
        return resolve({
            status: "error",
            message: err.message || "Failed to fetch music videos"
        });
    }
});
exports.getMusicVideos = getMusicVideos;
const parseMusicVideos = async (musicId, page, count, proxy) => {
    let cursor = 0;
    if (page > 1) {
        cursor = (page - 1) * count;
    }
    const videos = [];
    let musicInfo;
    const Tiktok = new tiktokService_1.TiktokService();
    const params = (0, params_1._getMusicVideosParams)(musicId, cursor, count);
    const xttParams = Tiktok.generateXTTParams(params);
    const result = await requestMusicVideos(proxy, xttParams);
    if (!result) {
        return {
            music: undefined,
            videos: [],
            hasMore: false,
            cursor: 0,
            totalVideos: 0
        };
    }
    if (result.musicInfo || result.music) {
        musicInfo = extractMusicInfo(result.musicInfo || result.music);
    }
    else if (result.itemList?.length > 0 && result.itemList[0].music) {
        musicInfo = extractMusicInfoFromVideo(result.itemList[0].music);
    }
    if (result.itemList && result.itemList.length > 0) {
        result.itemList.forEach((item) => {
            const video = extractVideoData(item);
            if (video) {
                videos.push(video);
            }
        });
    }
    const hasMore = result.hasMore || false;
    const nextCursor = result.cursor || cursor + videos.length;
    return {
        music: musicInfo,
        videos,
        hasMore,
        cursor: nextCursor,
        totalVideos: videos.length
    };
};
const extractMusicInfo = (musicData) => {
    return {
        id: musicData.id || musicData.musicId,
        title: musicData.title || "Unknown",
        authorName: musicData.authorName || musicData.author || "Unknown",
        author: musicData.author,
        duration: musicData.duration,
        original: musicData.original,
        playUrl: musicData.playUrl,
        coverThumb: musicData.coverThumb,
        coverLarge: musicData.coverLarge,
        coverMedium: musicData.coverMedium
    };
};
const extractMusicInfoFromVideo = (musicData) => {
    return {
        id: musicData.id,
        title: musicData.title,
        authorName: musicData.authorName,
        duration: musicData.duration,
        original: musicData.original,
        playUrl: musicData.playUrl,
        coverThumb: musicData.coverThumb,
        coverLarge: musicData.coverLarge,
        coverMedium: musicData.coverMedium
    };
};
const extractVideoData = (item) => {
    if (!item || !item.id) {
        return null;
    }
    const author = {
        id: item.author?.id || "",
        uniqueId: item.author?.uniqueId || "",
        nickname: item.author?.nickname || "",
        avatarLarger: item.author?.avatarLarger,
        avatarThumb: item.author?.avatarThumb,
        avatarMedium: item.author?.avatarMedium,
        signature: item.author?.signature,
        verified: item.author?.verified || false,
        openFavorite: item.author?.openFavorite,
        privateAccount: item.author?.privateAccount,
        isADVirtual: item.author?.isADVirtual,
        isEmbedBanned: item.author?.isEmbedBanned
    };
    const stats = {
        collectCount: item.stats?.collectCount,
        commentCount: item.stats?.commentCount || 0,
        diggCount: item.stats?.diggCount || item.stats?.likeCount || 0,
        playCount: item.stats?.playCount || 0,
        shareCount: item.stats?.shareCount || 0
    };
    const music = {
        id: item.music?.id || "",
        title: item.music?.title || "",
        authorName: item.music?.authorName || "",
        duration: item.music?.duration || 0,
        playUrl: item.music?.playUrl,
        coverLarge: item.music?.coverLarge,
        coverMedium: item.music?.coverMedium,
        coverThumb: item.music?.coverThumb,
        original: item.music?.original
    };
    const video = {
        id: item.id,
        desc: item.desc,
        createTime: item.createTime,
        digged: item.digged,
        duetEnabled: item.duetEnabled,
        forFriend: item.forFriend,
        officalItem: item.officalItem,
        originalItem: item.originalItem,
        privateItem: item.privateItem,
        shareEnabled: item.shareEnabled,
        stitchEnabled: item.stitchEnabled,
        stats,
        author,
        music
    };
    if (item.video) {
        const videoDetails = {
            id: item.video.id,
            duration: item.video.duration,
            ratio: item.video.ratio,
            cover: item.video.cover,
            originCover: item.video.originCover,
            dynamicCover: item.video.dynamicCover,
            playAddr: item.video.playAddr,
            downloadAddr: item.video.downloadAddr,
            format: item.video.format,
            bitrate: item.video.bitrate
        };
        video.video = videoDetails;
    }
    if (item.imagePost?.images) {
        video.imagePost = item.imagePost.images.map((img) => img.imageURL?.urlList?.[0] || img.imageURL);
    }
    if (item.effectStickers && Array.isArray(item.effectStickers)) {
        video.effectStickers = item.effectStickers.map((effect) => ({
            id: effect.id || "",
            name: effect.name || "",
            type: effect.type
        }));
    }
    return video;
};
const requestMusicVideos = async (proxy, xttParams = "") => {
    return (0, async_retry_1.default)(async (bail, attempt) => {
        try {
            const params = (0, params_1._getMusicVideosParams)("", 0, 30);
            const { data } = await axios_1.default.get(`${(0, api_1._tiktokGetMusic)(params)}`, {
                headers: {
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36 Edg/101.0.1210.53",
                    "x-tt-params": xttParams,
                    referer: "https://www.tiktok.com/",
                    accept: "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "no-cache",
                    pragma: "no-cache",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin"
                },
                httpsAgent: (proxy &&
                    (proxy.startsWith("http") || proxy.startsWith("https")
                        ? new https_proxy_agent_1.HttpsProxyAgent(proxy)
                        : proxy.startsWith("socks")
                            ? new socks_proxy_agent_1.SocksProxyAgent(proxy)
                            : undefined)) ||
                    undefined
            });
            if (data === "" || !data) {
                throw new Error("Empty response");
            }
            return data;
        }
        catch (error) {
            if (error.response?.status === 400 ||
                error.response?.status === 404 ||
                error.response?.data?.statusCode === 10201) {
                bail(new Error("Music not found or access forbidden!"));
                return;
            }
            throw error;
        }
    }, {
        retries: 10,
        minTimeout: 1000,
        maxTimeout: 5000,
        factor: 2,
        onRetry: (error, attempt) => {
            console.log(`Retry attempt ${attempt} due to: ${error}`);
        }
    });
};
