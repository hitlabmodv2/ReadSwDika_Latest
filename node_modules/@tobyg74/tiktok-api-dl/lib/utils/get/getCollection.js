"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = exports.getCollection = void 0;
const axios_1 = __importDefault(require("axios"));
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const constants_1 = require("../../constants");
const async_retry_1 = __importDefault(require("async-retry"));
const tiktokAPIDownloader_1 = require("../downloader/tiktokAPIDownloader");
const urlExtractors_1 = require("../urlExtractors");
const createProxyAgent = (proxy) => {
    if (!proxy)
        return {};
    if (proxy.startsWith("socks")) {
        return {
            httpsAgent: new socks_proxy_agent_1.SocksProxyAgent(proxy)
        };
    }
    return {
        httpsAgent: new https_proxy_agent_1.HttpsProxyAgent(proxy)
    };
};
const getCollection = async (collectionId, proxy, page = 1, count = 5) => {
    try {
        const response = await (0, async_retry_1.default)(async () => {
            const res = await (0, axios_1.default)((0, api_1._tiktokGetCollection)((0, params_1._getCollectionParams)(collectionId, page, count)), {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
                    Accept: "*/*",
                    "Accept-Language": "en-US,en;q=0.7",
                    Referer: "https://www.tiktok.com/",
                    Origin: "https://www.tiktok.com"
                },
                ...createProxyAgent(proxy)
            });
            if (res.data && res.data.statusCode === 0) {
                return res.data;
            }
            throw new Error(constants_1.ERROR_MESSAGES.NETWORK_ERROR);
        }, {
            retries: 20,
            minTimeout: 200,
            maxTimeout: 1000
        });
        return {
            status: "success",
            result: {
                hasMore: response.hasMore,
                itemList: response.itemList || [],
                extra: response.extra
            }
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
};
exports.getCollection = getCollection;
const Collection = async (collectionIdOrUrl, options) => {
    try {
        const processedUrl = collectionIdOrUrl.startsWith("http")
            ? await (0, tiktokAPIDownloader_1.handleRedirect)(collectionIdOrUrl, options?.proxy)
            : collectionIdOrUrl;
        const collectionId = (0, urlExtractors_1.extractCollectionId)(processedUrl);
        if (!collectionId) {
            return {
                status: "error",
                message: "Invalid collection ID or URL format"
            };
        }
        const response = await (0, axios_1.default)((0, api_1._tiktokGetCollection)((0, params_1._getCollectionParams)(collectionId, options.page, options.count)), {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
                Accept: "*/*",
                "Accept-Language": "en-US,en;q=0.7",
                Referer: "https://www.tiktok.com/",
                Origin: "https://www.tiktok.com"
            },
            ...createProxyAgent(options?.proxy)
        });
        if (response.data && response.data.status_code === 0) {
            const data = response.data;
            return {
                status: "success",
                result: {
                    itemList: data.itemList || [],
                    hasMore: data.hasMore
                }
            };
        }
        return {
            status: "error",
            message: constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
};
exports.Collection = Collection;
