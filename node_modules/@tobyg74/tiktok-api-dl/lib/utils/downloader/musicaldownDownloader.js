"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusicalDown = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const api_1 = require("../../constants/api");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const constants_1 = require("../../constants");
const TIKTOK_URL_REGEX = /https:\/\/(?:m|t|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";
const createProxyAgent = (proxy) => {
    if (!proxy)
        return {};
    const isHttpProxy = proxy.startsWith("http") || proxy.startsWith("https");
    const isSocksProxy = proxy.startsWith("socks");
    if (!isHttpProxy && !isSocksProxy)
        return {};
    return {
        httpsAgent: isHttpProxy
            ? new https_proxy_agent_1.HttpsProxyAgent(proxy)
            : new socks_proxy_agent_1.SocksProxyAgent(proxy)
    };
};
const validateTikTokUrl = (url) => {
    return TIKTOK_URL_REGEX.test(url);
};
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
};
const extractRequestForm = ($, url) => {
    const input = $("div > input").map((_, el) => $(el));
    return {
        [input.get(0).attr("name") || ""]: input.get(0).attr("value") || url,
        [input.get(1).attr("name") || ""]: input.get(1).attr("value") || "",
        [input.get(2).attr("name") || ""]: input.get(2).attr("value") || ""
    };
};
const parseImages = ($) => {
    const images = [];
    $("div.row > div[class='col s12 m3']").each((_, v) => {
        const src = $(v).find("img").attr("src");
        if (src)
            images.push(src);
    });
    return images;
};
const parseVideos = ($) => {
    const videos = {};
    const videoContainer = $("div.row > div")
        .map((_, el) => $(el))
        .get(1);
    if (!videoContainer)
        return videos;
    $(videoContainer)
        .find("a")
        .each((_, v) => {
        const href = $(v).attr("href");
        if (!href || href === "#modal2")
            return;
        if (!isValidUrl(href))
            return;
        const dataEvent = $(v).attr("data-event") || "";
        const onclick = $(v).attr("onclick") || "";
        const downloadUrl = href !== undefined ? href : /downloadX\('([^']+)'\)/.exec(onclick)?.[1];
        if (!downloadUrl)
            return;
        if (dataEvent.includes("hd")) {
            videos.videoHD = downloadUrl;
        }
        else if (dataEvent.includes("mp4")) {
            videos.videoSD = downloadUrl;
        }
        else if (dataEvent.includes("watermark")) {
            videos.videoWatermark = downloadUrl;
        }
        else if (href.includes("type=mp3")) {
            videos.music = downloadUrl;
        }
    });
    return videos;
};
const createImageResponse = (images) => ({
    status: "success",
    result: {
        type: "image",
        images
    }
});
const createVideoResponse = ($, videos) => ({
    status: "success",
    result: {
        type: "video",
        author: {
            avatar: $("div.img-area > img").attr("src") || "",
            nickname: $("h2.video-author > b").text()
        },
        desc: $("p.video-desc").text(),
        ...videos
    }
});
const getRequest = async (url, proxy) => {
    try {
        if (!validateTikTokUrl(url)) {
            return {
                status: "error",
                message: constants_1.ERROR_MESSAGES.INVALID_URL
            };
        }
        const { data, headers } = await (0, axios_1.default)(api_1._musicaldownurl, {
            method: "GET",
            headers: {
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Update-Insecure-Requests": "1",
                "User-Agent": USER_AGENT
            },
            ...createProxyAgent(proxy)
        });
        const cookie = headers["set-cookie"]?.[0]?.split(";")[0];
        if (!cookie) {
            return {
                status: "error",
                message: constants_1.ERROR_MESSAGES.NETWORK_ERROR
            };
        }
        const $ = (0, cheerio_1.load)(data);
        const request = extractRequestForm($, url);
        return {
            status: "success",
            request,
            cookie
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
};
const MusicalDown = async (url, proxy) => {
    try {
        const request = await getRequest(url, proxy);
        if (request.status !== "success") {
            return {
                status: "error",
                message: request.message
            };
        }
        const { data } = await (0, axios_1.default)(api_1._musicaldownapi, {
            method: "POST",
            headers: {
                cookie: request.cookie,
                "Content-Type": "application/x-www-form-urlencoded",
                Origin: "https://musidown.com/download",
                Referer: "https://musidown.com/download/en",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": USER_AGENT
            },
            data: new URLSearchParams(Object.entries(request.request)),
            ...createProxyAgent(proxy)
        });
        const $ = (0, cheerio_1.load)(data);
        const images = parseImages($);
        if (images.length > 0) {
            return createImageResponse(images);
        }
        const videos = parseVideos($);
        if (Object.keys(videos).length === 0) {
            return {
                status: "error",
                message: "There is an error. Can't find download link"
            };
        }
        return createVideoResponse($, videos);
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
};
exports.MusicalDown = MusicalDown;
