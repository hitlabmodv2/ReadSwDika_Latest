"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultDownloadPath = getDefaultDownloadPath;
exports.downloadMedia = downloadMedia;
exports.handleMediaDownload = handleMediaDownload;
exports.downloadMusicFromDetail = downloadMusicFromDetail;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const logger_1 = require("../lib/logger");
function getDefaultDownloadPath() {
    const platform = os.platform();
    const homeDir = os.homedir();
    switch (platform) {
        case "win32":
            return path.join(homeDir, "Downloads");
        case "darwin":
            return path.join(homeDir, "Downloads");
        case "linux":
            if (process.env.PREFIX && process.env.PREFIX.includes("com.termux")) {
                return path.join(homeDir, "storage", "downloads");
            }
            return path.join(homeDir, "Downloads");
        case "android":
            if (process.env.EXTERNAL_STORAGE) {
                return path.join(process.env.EXTERNAL_STORAGE, "Download");
            }
            return path.join(homeDir, "Download");
        default:
            const possiblePaths = [
                path.join(homeDir, "Downloads"),
                path.join(homeDir, "Download"),
                path.join(homeDir, "downloads"),
                homeDir
            ];
            for (const downloadPath of possiblePaths) {
                if (fs.existsSync(downloadPath)) {
                    return downloadPath;
                }
            }
            return path.join(homeDir, "Downloads");
    }
}
async function downloadMedia(url, outputPath, filename, cookie) {
    try {
        const headers = {};
        if (cookie) {
            headers.Cookie = Array.isArray(cookie) ? cookie.join("; ") : cookie;
            headers["User-Agent"] =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
            headers.Referer = "https://www.tiktok.com/";
        }
        const response = await (0, axios_1.default)({
            method: "GET",
            url: url,
            responseType: "stream",
            headers: headers
        });
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        const writer = fs.createWriteStream(path.join(outputPath, filename));
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
    }
    catch (error) {
        throw new Error(`Failed to download media: ${error.message}`);
    }
}
async function handleMediaDownload(data, outputPath, version) {
    if (data.status !== "success") {
        throw new Error(data.message);
    }
    const { result } = data;
    const author = result.author;
    const username = version === "v1" ? author.username : author?.nickname || "";
    logger_1.Logger.success(`${result.type.charAt(0).toUpperCase() + result.type.slice(1)} Successfully Fetched!`);
    logger_1.Logger.info(`Media Type: ${result.type}`);
    switch (result.type) {
        case "video": {
            const videoUrl = version === "v1"
                ? result.video.playAddr[0]
                : version === "v2"
                    ? result.video.playAddr[0]
                    : result.videoHD;
            const videoName = `ttdl_${username}_${Date.now()}.mp4`;
            logger_1.Logger.info("Downloading video...");
            await downloadMedia(videoUrl, outputPath, videoName);
            logger_1.Logger.success(`Video downloaded successfully to: ${path.join(outputPath, videoName)}`);
            break;
        }
        case "image": {
            const userOutputPath = path.join(outputPath, `${username}_${Date.now()}`);
            const images = result.images;
            for (let i = 0; i < images.length; i++) {
                const imageName = `ttdl_${username}_${Date.now()}_${i + 1}.png`;
                logger_1.Logger.info(`Downloading image ${i + 1}/${images.length}...`);
                await downloadMedia(images[i], userOutputPath, imageName);
                logger_1.Logger.success(`Image downloaded successfully to: ${path.join(userOutputPath, imageName)}`);
            }
            break;
        }
        case "music": {
            const musicName = `ttdl_${username}_${Date.now()}.mp3`;
            logger_1.Logger.info("Downloading music...");
            await downloadMedia(result.music, outputPath, musicName);
            logger_1.Logger.success(`Music downloaded successfully to: ${path.join(outputPath, musicName)}`);
            break;
        }
        default:
            throw new Error(`Unsupported media type: ${result.type}`);
    }
}
async function downloadMusicFromDetail(musicIdOrUrl, cookie, outputPath, proxy) {
    try {
        logger_1.Logger.info(`Fetching music detail for: ${musicIdOrUrl}`);
        const { getMusicDetail } = await import("../utils/get/getMusicDetail.js");
        const result = await getMusicDetail(musicIdOrUrl, cookie, proxy);
        if (result.status !== "success" || !result.result) {
            throw new Error(result.message || "Failed to fetch music detail");
        }
        const { musicInfo } = result.result;
        const music = musicInfo.music;
        const author = musicInfo.artist || musicInfo.author;
        logger_1.Logger.success("Music detail fetched successfully!");
        logger_1.Logger.info(`Title: ${music.title}`);
        logger_1.Logger.info(`Author: ${music.authorName}`);
        logger_1.Logger.info(`Duration: ${music.duration} seconds`);
        const safeTitle = music.title.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
        const safeAuthor = (author?.nickname || music.authorName || "Unknown")
            .replace(/[^a-z0-9]/gi, "_")
            .substring(0, 30);
        const musicName = `ttdl_music_${safeAuthor}_${safeTitle}_${Date.now()}.mp3`;
        logger_1.Logger.info("Downloading music...");
        const cookieString = Array.isArray(cookie) ? cookie.join("; ") : cookie;
        await downloadMedia(music.playUrl, outputPath, musicName, cookieString);
        logger_1.Logger.success(`Music downloaded successfully to: ${path.join(outputPath, musicName)}`);
        logger_1.Logger.info("\n==== MUSIC INFO ====");
        logger_1.Logger.info(`Title: ${music.title}`);
        logger_1.Logger.info(`Author: @${author?.uniqueId || "Unknown"} (${author?.nickname || music.authorName})`);
        logger_1.Logger.info(`Duration: ${music.duration} seconds`);
        logger_1.Logger.info(`Original: ${music.original ? "Yes" : "No"}`);
        logger_1.Logger.info(`Videos using this music: ${musicInfo.stats.videoCount}`);
    }
    catch (error) {
        throw new Error(`Failed to download music: ${error.message}`);
    }
}
