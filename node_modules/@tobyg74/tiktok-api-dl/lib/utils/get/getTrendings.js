"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrendingCreators = exports.getTrendings = void 0;
const axios_1 = __importDefault(require("axios"));
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const getTrendings = (proxy) => new Promise(async (resolve) => {
    try {
        const params = (0, params_1._getTrendingsParams)();
        const url = (0, api_1._tiktokTrendings)(params);
        const response = await axios_1.default.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
                Accept: "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                Connection: "keep-alive",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin"
            },
            httpsAgent: (proxy &&
                (proxy.startsWith("http") || proxy.startsWith("https")
                    ? new https_proxy_agent_1.HttpsProxyAgent(proxy)
                    : proxy.startsWith("socks")
                        ? new socks_proxy_agent_1.SocksProxyAgent(proxy)
                        : undefined)) ||
                undefined
        });
        if (response.status !== 200) {
            return resolve({
                status: "error",
                message: "Failed to fetch trending data"
            });
        }
        const data = response.data;
        if (!data || !data.body || data.statusCode !== 0) {
            return resolve({
                status: "error",
                message: "Invalid response from TikTok API"
            });
        }
        const trendingData = parseTrendingData(data.body);
        resolve({
            status: "success",
            result: trendingData
        });
    }
    catch (error) {
        resolve({
            status: "error",
            message: error.message || "Unknown error occurred"
        });
    }
});
exports.getTrendings = getTrendings;
const parseTrendingData = (body) => {
    const trendingData = [];
    body.forEach((section) => {
        if (section.exploreList && Array.isArray(section.exploreList)) {
            trendingData.push({
                exploreList: section.exploreList,
                pageState: section.pageState || {}
            });
        }
    });
    return trendingData;
};
const getTrendingCreators = async (proxy) => {
    try {
        const trendingResponse = await (0, exports.getTrendings)(proxy);
        if (trendingResponse.status === "error") {
            return {
                status: "error",
                message: trendingResponse.message
            };
        }
        const creators = [];
        trendingResponse.result?.forEach((data) => {
            data.exploreList.forEach((item) => {
                if (item.cardItem && item.cardItem.type === 2) {
                    const cardItem = item.cardItem;
                    const creator = {
                        id: cardItem.id,
                        username: cardItem.subTitle.replace("@", ""),
                        nickname: cardItem.title,
                        avatarThumb: cardItem.cover,
                        description: cardItem.description,
                        verified: cardItem.extraInfo?.verified || false,
                        followerCount: cardItem.extraInfo?.fans || 0,
                        likeCount: cardItem.extraInfo?.likes || 0,
                        videoCount: cardItem.extraInfo?.video || 0,
                        followingCount: cardItem.extraInfo?.following || 0,
                        heartCount: cardItem.extraInfo?.heart || 0,
                        diggCount: cardItem.extraInfo?.digg || 0,
                        secUid: cardItem.extraInfo?.secUid || "",
                        link: cardItem.link
                    };
                    creators.push(creator);
                }
            });
        });
        return {
            status: "success",
            result: creators
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error.message || "Unknown error occurred"
        };
    }
};
exports.getTrendingCreators = getTrendingCreators;
