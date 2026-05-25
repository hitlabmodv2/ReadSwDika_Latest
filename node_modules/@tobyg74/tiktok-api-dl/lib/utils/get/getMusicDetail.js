"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMusicDetail = void 0;
const axios_1 = __importDefault(require("axios"));
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const tiktokService_1 = require("../../services/tiktokService");
const headers_1 = require("../../constants/headers");
const urlExtractors_1 = require("../urlExtractors");
const getMusicDetail = (musicIdOrUrl, cookie, proxy) => new Promise(async (resolve) => {
    try {
        const musicId = (0, urlExtractors_1.extractMusicId)(musicIdOrUrl);
        if (!musicId) {
            return resolve({
                status: "error",
                message: "Invalid music ID or URL format"
            });
        }
        const Tiktok = new tiktokService_1.TiktokService();
        const params = (0, params_1._getMusicDetailParams)(musicId);
        const xttparams = Tiktok.generateXTTParams(params);
        const url = new URL((0, api_1._tiktokGetMusicDetail)());
        url.search = params;
        const config = {
            headers: {
                "User-Agent": headers_1.webUserAgent,
                Cookie: Array.isArray(cookie) ? cookie.join("; ") : cookie,
                "x-tt-params": xttparams
            }
        };
        if (proxy) {
            if (proxy.startsWith("http://") || proxy.startsWith("https://")) {
                config.httpsAgent = new https_proxy_agent_1.HttpsProxyAgent(proxy);
            }
            else if (proxy.startsWith("socks://")) {
                config.httpsAgent = new socks_proxy_agent_1.SocksProxyAgent(proxy);
            }
        }
        const response = await axios_1.default.get(url.toString(), config);
        if (response.data.statusCode === 0 && response.data.musicInfo) {
            resolve({
                status: "success",
                result: {
                    musicInfo: response.data.musicInfo,
                    shareMeta: response.data.shareMeta
                }
            });
        }
        else {
            resolve({
                status: "error",
                message: response.data.status_msg || "Music not found or invalid response"
            });
        }
    }
    catch (err) {
        resolve({
            status: "error",
            message: err.message || "Failed to fetch music detail"
        });
    }
});
exports.getMusicDetail = getMusicDetail;
