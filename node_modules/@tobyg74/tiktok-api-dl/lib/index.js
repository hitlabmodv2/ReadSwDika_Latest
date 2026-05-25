"use strict";
const tiktokAPIDownloader_1 = require("./utils/downloader/tiktokAPIDownloader");
const ssstikDownloader_1 = require("./utils/downloader/ssstikDownloader");
const musicaldownDownloader_1 = require("./utils/downloader/musicaldownDownloader");
const getProfile_1 = require("./utils/get/getProfile");
const userSearch_1 = require("./utils/search/userSearch");
const liveSearch_1 = require("./utils/search/liveSearch");
const getComments_1 = require("./utils/get/getComments");
const getUserPosts_1 = require("./utils/get/getUserPosts");
const getUserRepost_1 = require("./utils/get/getUserRepost");
const getUserLiked_1 = require("./utils/get/getUserLiked");
const videoSearch_1 = require("./utils/search/videoSearch");
const getCollection_1 = require("./utils/get/getCollection");
const getTrendings_1 = require("./utils/get/getTrendings");
const getMusicVideos_1 = require("./utils/get/getMusicVideos");
const getMusicDetail_1 = require("./utils/get/getMusicDetail");
const constants_1 = require("./constants");
const constants_2 = require("./constants");
const validator_1 = require("./utils/validator");
const getPlaylist_1 = require("./utils/get/getPlaylist");
const urlExtractors_1 = require("./utils/urlExtractors");
const handleError = (message) => {
    return {
        status: "error",
        message
    };
};
module.exports = {
    Downloader: async (url, options) => {
        const version = options?.version?.toLowerCase();
        switch (version) {
            case constants_1.DOWNLOADER_VERSIONS.V1:
                return (await (0, tiktokAPIDownloader_1.TiktokAPI)(url, options?.proxy, options?.showOriginalResponse));
            case constants_1.DOWNLOADER_VERSIONS.V2:
                return (await (0, ssstikDownloader_1.SSSTik)(url, options?.proxy));
            case constants_1.DOWNLOADER_VERSIONS.V3:
                return (await (0, musicaldownDownloader_1.MusicalDown)(url, options?.proxy));
            default:
                return (await (0, tiktokAPIDownloader_1.TiktokAPI)(url, options?.proxy, options?.showOriginalResponse));
        }
    },
    Search: async (keyword, options) => {
        try {
            const type = options?.type?.toLowerCase();
            if (!type || !Object.values(constants_1.SEARCH_TYPES).includes(type)) {
                throw new Error(constants_2.ERROR_MESSAGES.INVALID_SEARCH_TYPE);
            }
            switch (type) {
                case constants_1.SEARCH_TYPES.USER:
                    const userResults = await (0, userSearch_1.SearchUser)(keyword, options.cookie, options?.page, options?.proxy);
                    return {
                        ...userResults,
                        result: userResults.result?.map((user) => ({
                            type: "user",
                            ...user
                        }))
                    };
                case constants_1.SEARCH_TYPES.LIVE:
                    const liveResults = await (0, liveSearch_1.SearchLive)(keyword, options.cookie, options?.page, options?.proxy);
                    return {
                        ...liveResults,
                        result: liveResults.result?.map((live) => ({
                            type: "live",
                            ...live
                        }))
                    };
                case constants_1.SEARCH_TYPES.VIDEO:
                    const videoResults = await (0, videoSearch_1.SearchVideo)(keyword, options.cookie, options?.page, options?.proxy);
                    return {
                        ...videoResults,
                        result: videoResults.result?.map((video) => ({
                            type: "video",
                            ...video
                        }))
                    };
                default:
                    throw new Error(constants_2.ERROR_MESSAGES.INVALID_SEARCH_TYPE);
            }
        }
        catch (error) {
            return {
                status: "error",
                message: error.message
            };
        }
    },
    StalkUser: async (username, options) => {
        return await (0, getProfile_1.StalkUser)(username, options?.proxy);
    },
    GetVideoComments: async (url, options) => {
        return await (0, getComments_1.getComments)(url, options?.proxy, options?.commentLimit);
    },
    GetUserPosts: async (username, options) => {
        return await (0, getUserPosts_1.getUserPosts)(username, options?.proxy, options?.postLimit);
    },
    GetUserLiked: async (username, options) => {
        if (!(0, validator_1.validateCookie)(options?.cookie)) {
            return handleError(constants_2.ERROR_MESSAGES.COOKIE_REQUIRED);
        }
        return await (0, getUserLiked_1.getUserLiked)(username, options.cookie, options?.proxy, options?.postLimit);
    },
    GetUserReposts: async (username, options) => {
        return await (0, getUserRepost_1.getUserReposts)(username, options?.proxy, options?.postLimit, options?.filterDeletedPost);
    },
    Collection: async (collectionIdOrUrl, options) => {
        const collectionId = (0, urlExtractors_1.extractCollectionId)(collectionIdOrUrl);
        if (!collectionId) {
            return {
                status: "error",
                message: "Invalid collection ID or URL format"
            };
        }
        return await (0, getCollection_1.getCollection)(collectionId, options?.proxy, options?.page, options?.count);
    },
    Playlist: async (playlistIdOrUrl, options) => {
        const playlistId = (0, urlExtractors_1.extractPlaylistId)(playlistIdOrUrl);
        if (!playlistId) {
            return {
                status: "error",
                message: "Invalid playlist ID or URL format"
            };
        }
        return await (0, getPlaylist_1.getPlaylist)(playlistId, options?.proxy, options?.page, options?.count);
    },
    Trending: async (options) => {
        return await (0, getTrendings_1.getTrendings)(options?.proxy);
    },
    GetVideosByMusicId: async (musicIdOrUrl, options) => {
        return await (0, getMusicVideos_1.getMusicVideos)(musicIdOrUrl, options?.proxy, options?.page, options?.count);
    },
    GetMusicDetail: async (musicIdOrUrl, options) => {
        return await (0, getMusicDetail_1.getMusicDetail)(musicIdOrUrl, options.cookie, options?.proxy);
    },
    TrendingCreators: async (options) => {
        return await (0, getTrendings_1.getTrendingCreators)(options?.proxy);
    }
};
