"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchVideo = void 0;
const axios_1 = __importDefault(require("axios"));
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const https_proxy_agent_1 = require("https-proxy-agent");
const async_retry_1 = __importDefault(require("async-retry"));
const SearchVideo = async (keyword, cookie, page = 1, proxy) => new Promise(async (resolve) => {
    if (!cookie) {
        return resolve({
            status: "error",
            message: "Cookie is required!"
        });
    }
    try {
        const data = await requestVideoSearch(keyword, page, cookie, proxy);
        if (data.status_code === 2483)
            return resolve({ status: "error", message: "Invalid cookie!" });
        if (data.status_code !== 0)
            return resolve({
                status: "error",
                message: data.status_msg ||
                    "An error occurred! Please report this issue to the developer."
            });
        if (!data.item_list)
            return resolve({ status: "error", message: "Video not found!" });
        const result = [];
        data.item_list.forEach((v) => {
            const video = {
                id: v.video.id,
                ratio: v.video.ratio,
                cover: v.video.cover,
                originCover: v.video.originCover,
                dynamicCover: v.video.dynamicCover,
                playAddr: v.video.playAddr,
                downloadAddr: v.video.downloadAddr,
                format: v.video.format
            };
            const stats = {
                likeCount: v.stats.diggCount,
                shareCount: v.stats.shareCount,
                commentCount: v.stats.commentCount,
                playCount: v.stats.playCount,
                collectCount: v.stats.collectCount
            };
            const author = {
                id: v.author.id,
                uniqueId: v.author.uniqueId,
                nickname: v.author.nickname,
                avatarThumb: v.author.avatarThumb,
                avatarMedium: v.author.avatarMedium,
                avatarLarger: v.author.avatarLarger,
                signature: v.author.signature,
                verified: v.author.verified,
                secUid: v.author.secUid,
                openFavorite: v.author.openFavorite,
                privateAccount: v.author.privateAccount,
                isADVirtual: v.author.isADVirtual,
                tiktokSeller: v.author.ttSeller,
                isEmbedBanned: v.author.isEmbedBanned
            };
            const music = {
                id: v.music.id,
                title: v.music.title,
                playUrl: v.music.playUrl,
                coverThumb: v.music.coverThumb,
                coverMedium: v.music.coverMedium,
                coverLarge: v.music.coverLarge,
                authorName: v.music.authorName,
                original: v.music.original,
                album: v.music.album,
                duration: v.music.duration,
                isCopyrighted: v.music.isCopyrighted
            };
            result.push({
                id: v.id,
                desc: v.desc,
                createTime: v.createTime,
                author,
                stats,
                video,
                music
            });
        });
        if (!result.length)
            return resolve({ status: "error", message: "Video not found!" });
        resolve({
            status: "success",
            result,
            page,
            totalResults: result.length
        });
    }
    catch (e) {
        resolve({ status: "error", message: e.message });
    }
});
exports.SearchVideo = SearchVideo;
const requestVideoSearch = async (keyword, page, cookie, proxy) => {
    return (0, async_retry_1.default)(async (bail, attempt) => {
        try {
            const { data } = await (0, axios_1.default)((0, api_1._tiktokSearchVideoFull)((0, params_1._videoSearchParams)(keyword, page)), {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
                    cookie: typeof cookie === "object"
                        ? cookie.map((v) => `${v.name}=${v.value}`).join("; ")
                        : cookie
                },
                httpsAgent: (proxy &&
                    (proxy.startsWith("http") || proxy.startsWith("https")
                        ? new https_proxy_agent_1.HttpsProxyAgent(proxy)
                        : proxy.startsWith("socks")
                            ? new socks_proxy_agent_1.SocksProxyAgent(proxy)
                            : undefined)) ||
                    undefined
            });
            if (data === "") {
                throw new Error("Empty response");
            }
            return data;
        }
        catch (error) {
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
