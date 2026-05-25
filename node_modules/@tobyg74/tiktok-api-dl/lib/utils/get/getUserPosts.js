"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserPosts = void 0;
const axios_1 = __importDefault(require("axios"));
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const tiktokService_1 = require("../../services/tiktokService");
const getProfile_1 = require("../get/getProfile");
const async_retry_1 = __importDefault(require("async-retry"));
const getUserPosts = (username, proxy, postLimit) => new Promise((resolve) => {
    try {
        (0, getProfile_1.StalkUser)(username).then(async (res) => {
            if (res.status === "error") {
                return resolve({
                    status: "error",
                    message: res.message
                });
            }
            const secUid = res.result.user.secUid;
            const data = await parseUserPosts(secUid, postLimit, proxy);
            if (!data.length)
                return resolve({
                    status: "error",
                    message: "User not found!"
                });
            resolve({
                status: "success",
                result: data,
                totalPosts: data.length
            });
        });
    }
    catch (err) {
        if (err.status == 400 ||
            (err.response.data && err.response.data.statusCode == 10201)) {
            return resolve({
                status: "error",
                message: "Video not found!"
            });
        }
    }
});
exports.getUserPosts = getUserPosts;
const parseUserPosts = async (secUid, postLimit, proxy) => {
    let page = 1;
    let hasMore = true;
    let responseCursor = 0;
    const posts = [];
    let counter = 0;
    const Tiktok = new tiktokService_1.TiktokService();
    while (hasMore) {
        let result = null;
        let xttparams = "";
        let urlCursor = 0;
        let urlCount = 0;
        if (page === 1) {
            urlCount = 0;
            urlCursor = 0;
            xttparams = Tiktok.generateXTTParams((0, params_1._xttParams)(secUid, 0, 35));
        }
        else if (page === 2) {
            urlCount = 35;
            urlCursor = 0;
            xttparams = Tiktok.generateXTTParams((0, params_1._xttParams)(secUid, 0, 30));
        }
        else if (page === 3) {
            urlCount = 30;
            urlCursor = 0;
            xttparams = Tiktok.generateXTTParams((0, params_1._xttParams)(secUid, responseCursor, 16));
        }
        else {
            urlCount = 16;
            urlCursor = responseCursor;
            xttparams = Tiktok.generateXTTParams((0, params_1._xttParams)(secUid, responseCursor, 16));
        }
        result = await requestUserPosts(proxy, xttparams);
        result?.itemList?.forEach((v) => {
            const author = {
                id: v.author.id,
                username: v.author.uniqueId,
                nickname: v.author.nickname,
                avatarLarger: v.author.avatarLarger,
                avatarThumb: v.author.avatarThumb,
                avatarMedium: v.author.avatarMedium,
                signature: v.author.signature,
                verified: v.author.verified,
                openFavorite: v.author.openFavorite,
                privateAccount: v.author.privateAccount,
                isADVirtual: v.author.isADVirtual,
                isEmbedBanned: v.author.isEmbedBanned
            };
            if (v.imagePost) {
                const imagePost = v.imagePost.images.map((img) => img.imageURL.urlList[0]);
                posts.push({
                    id: v.id,
                    desc: v.desc,
                    createTime: v.createTime,
                    digged: v.digged,
                    duetEnabled: v.duetEnabled,
                    forFriend: v.forFriend,
                    officalItem: v.officalItem,
                    originalItem: v.originalItem,
                    privateItem: v.privateItem,
                    shareEnabled: v.shareEnabled,
                    stitchEnabled: v.stitchEnabled,
                    stats: v.stats,
                    music: v.music,
                    author,
                    imagePost
                });
            }
            else {
                const video = {
                    id: v.video.id,
                    duration: v.video.duration,
                    format: v.video.format,
                    bitrate: v.video.bitrate,
                    ratio: v.video.ratio,
                    playAddr: v.video.playAddr,
                    cover: v.video.cover,
                    originCover: v.video.originCover,
                    dynamicCover: v.video.dynamicCover,
                    downloadAddr: v.video.downloadAddr
                };
                posts.push({
                    id: v.id,
                    desc: v.desc,
                    createTime: v.createTime,
                    digged: v.digged,
                    duetEnabled: v.duetEnabled,
                    forFriend: v.forFriend,
                    officalItem: v.officalItem,
                    originalItem: v.originalItem,
                    privateItem: v.privateItem,
                    shareEnabled: v.shareEnabled,
                    stitchEnabled: v.stitchEnabled,
                    stats: v.stats,
                    music: v.music,
                    author,
                    video
                });
            }
        });
        hasMore = result.hasMore;
        responseCursor = hasMore ? result.cursor : 0;
        page++;
        counter++;
        if (postLimit && posts.length >= postLimit) {
            hasMore = false;
            break;
        }
    }
    return postLimit ? posts.slice(0, postLimit) : posts;
};
const requestUserPosts = async (proxy, xttparams = "") => {
    return (0, async_retry_1.default)(async (bail, attempt) => {
        try {
            let urlParams = (0, params_1._getUserPostsParams)();
            const { data } = await axios_1.default.get(`${(0, api_1._tiktokGetPosts)(urlParams)}`, {
                headers: {
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35",
                    "x-tt-params": xttparams
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
            if (error.response?.status === 400 ||
                error.response?.data?.statusCode === 10201) {
                bail(new Error("Video not found!"));
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
