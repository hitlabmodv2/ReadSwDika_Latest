"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchUser = void 0;
const axios_1 = __importDefault(require("axios"));
const api_1 = require("../../constants/api");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const tiktokService_1 = require("../../services/tiktokService");
const headers_1 = require("../../constants/headers");
const SearchUser = (username, cookie, page = 1, proxy) => new Promise(async (resolve) => {
    if (!cookie) {
        return resolve({
            status: "error",
            message: "Cookie is required!"
        });
    }
    const Tiktok = new tiktokService_1.TiktokService();
    (0, axios_1.default)(Tiktok.generateURLXbogus(username, page), {
        method: "GET",
        headers: {
            "User-Agent": headers_1.webUserAgent,
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
    })
        .then(({ data }) => {
        if (data.status_code === 2483)
            return resolve({ status: "error", message: "Invalid cookie!" });
        if (data.status_code !== 0)
            return resolve({
                status: "error",
                message: data.status_msg ||
                    "An error occurred! Please report this issue to the developer."
            });
        if (!data.user_list)
            return resolve({ status: "error", message: "User not found!" });
        const result = [];
        for (let i = 0; i < data.user_list.length; i++) {
            const user = data.user_list[i];
            result.push({
                uid: user.user_info.uid,
                username: user.user_info.unique_id,
                nickname: user.user_info.nickname,
                signature: user.user_info.signature,
                followerCount: user.user_info.follower_count,
                avatarThumb: user.user_info.avatar_thumb,
                isVerified: user.custom_verify !== "",
                secUid: user.user_info.sec_uid,
                url: `${api_1._tiktokDesktopUrl}/@${user.user_info.unique_id}`
            });
        }
        if (!result.length)
            return resolve({ status: "error", message: "User not found!" });
        resolve({
            status: "success",
            result,
            page,
            totalResults: result.length
        });
    })
        .catch((e) => {
        resolve({ status: "error", message: e.message });
    });
});
exports.SearchUser = SearchUser;
