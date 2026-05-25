"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StalkUser = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const api_1 = require("../../constants/api");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const StalkUser = (username, proxy) => new Promise(async (resolve) => {
    username = username.replace("@", "");
    (0, axios_1.default)(`${api_1._tiktokDesktopUrl}/@${username}`, {
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36"
        },
        httpsAgent: (proxy &&
            (proxy.startsWith("http") || proxy.startsWith("https")
                ? new https_proxy_agent_1.HttpsProxyAgent(proxy)
                : proxy.startsWith("socks")
                    ? new socks_proxy_agent_1.SocksProxyAgent(proxy)
                    : undefined)) ||
            undefined
    })
        .then(async ({ data }) => {
        const $ = (0, cheerio_1.load)(data);
        const result = JSON.parse($("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text());
        if (!result["__DEFAULT_SCOPE__"] &&
            !result["__DEFAULT_SCOPE__"]["webapp.user-detail"]) {
            return resolve({
                status: "error",
                message: "User not found!"
            });
        }
        const dataUser = result["__DEFAULT_SCOPE__"]["webapp.user-detail"]["userInfo"];
        if (!dataUser) {
            return resolve({
                status: "error",
                message: "User not found!"
            });
        }
        const { user, stats, statsV2 } = parseDataUser(dataUser);
        let response = {
            status: "success",
            result: {
                user,
                stats,
                statsV2
            }
        };
        resolve(response);
    })
        .catch((e) => resolve({ status: "error", message: e.message }));
});
exports.StalkUser = StalkUser;
const parseDataUser = (dataUser) => {
    const user = {
        uid: dataUser.user.id,
        username: dataUser.user.uniqueId,
        nickname: dataUser.user.nickname,
        avatarLarger: dataUser.user.avatarLarger,
        avatarThumb: dataUser.user.avatarThumb,
        avatarMedium: dataUser.user.avatarMedium,
        signature: dataUser.user.signature,
        verified: dataUser.user.verified,
        privateAccount: dataUser.user.privateAccount,
        region: dataUser.user.region,
        commerceUser: dataUser.user.commerceUserInfo.commerceUser,
        usernameModifyTime: dataUser.user.uniqueIdModifyTime,
        nicknameModifyTime: dataUser.user.nickNameModifyTime,
        secUid: dataUser.user.secUid
    };
    const stats = {
        followerCount: dataUser.stats.followerCount,
        followingCount: dataUser.stats.followingCount,
        heartCount: dataUser.stats.heartCount,
        videoCount: dataUser.stats.videoCount,
        likeCount: dataUser.stats.diggCount,
        friendCount: dataUser.stats.friendCount
    };
    const statsV2 = {
        followerCount: dataUser.statsV2.followerCount,
        followingCount: dataUser.statsV2.followingCount,
        heartCount: dataUser.statsV2.heartCount,
        videoCount: dataUser.statsV2.videoCount,
        likeCount: dataUser.statsV2.diggCount,
        friendCount: dataUser.statsV2.friendCount
    };
    return { user, stats, statsV2 };
};
