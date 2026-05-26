import { TiktokAPIResponse } from "./types/downloader/tiktokApiDownloader";
import { SSSTikResponse } from "./types/downloader/ssstikDownloader";
import { MusicalDownResponse } from "./types/downloader/musicaldownDownloader";
import { UserSearchResult } from "./types/search/userSearch";
import { LiveSearchResult } from "./types/search/liveSearch";
import { VideoSearchResult } from "./types/search/videoSearch";
import { TiktokStalkUserResponse } from "./types/get/getProfile";
import { TiktokVideoCommentsResponse } from "./types/get/getComments";
import { TiktokUserPostsResponse } from "./types/get/getUserPosts";
import { TiktokUserRepostsResponse } from "./types/get/getUserReposts";
import { TiktokUserFavoriteVideosResponse } from "./types/get/getUserLiked";
import { TiktokCollectionResponse } from "./types/get/getCollection";
import { TiktokTrendingResponse, TrendingCreator } from "./types/get/getTrendings";
import { TiktokMusicVideosResponse } from "./types/get/getMusicVideos";
import { TiktokMusicDetailResponse } from "./types/get/getMusicDetail";
import { TiktokPlaylistResponse } from "./types/get/getPlaylist";
type DownloaderVersion = "v1" | "v2" | "v3";
type SearchType = "user" | "live" | "video";
type TiktokDownloaderResponse<T extends DownloaderVersion> = T extends "v1" ? TiktokAPIResponse : T extends "v2" ? SSSTikResponse : T extends "v3" ? MusicalDownResponse : TiktokAPIResponse;
type SearchResult<T extends SearchType> = {
    type: T;
} & (T extends "user" ? UserSearchResult : T extends "live" ? LiveSearchResult : VideoSearchResult);
type TiktokSearchResponse<T extends SearchType> = {
    status: "success" | "error";
    message?: string;
    result?: SearchResult<T>[];
    page?: number;
    totalResults?: number;
};
declare const _default: {
    Downloader: <T extends DownloaderVersion>(url: string, options?: {
        version: T;
        proxy?: string;
        showOriginalResponse?: boolean;
    }) => Promise<TiktokDownloaderResponse<T>>;
    Search: <T extends SearchType>(keyword: string, options?: {
        type?: T;
        cookie: string | any[];
        page?: number;
        proxy?: string;
    }) => Promise<TiktokSearchResponse<T>>;
    StalkUser: (username: string, options?: {
        proxy?: string;
    }) => Promise<TiktokStalkUserResponse>;
    GetVideoComments: (url: string, options?: {
        commentLimit?: number;
        proxy?: string;
    }) => Promise<TiktokVideoCommentsResponse>;
    GetUserPosts: (username: string, options?: {
        postLimit?: number;
        proxy?: string;
    }) => Promise<TiktokUserPostsResponse>;
    GetUserLiked: (username: string, options: {
        cookie: string | any[];
        postLimit?: number;
        proxy?: string;
    }) => Promise<TiktokUserFavoriteVideosResponse>;
    GetUserReposts: (username: string, options?: {
        postLimit?: number;
        proxy?: string;
        filterDeletedPost?: boolean;
    }) => Promise<TiktokUserRepostsResponse>;
    Collection: (collectionIdOrUrl: string, options?: {
        proxy?: string;
        page?: number;
        count?: number;
    }) => Promise<TiktokCollectionResponse>;
    Playlist: (playlistIdOrUrl: string, options?: {
        proxy?: string;
        page?: number;
        count?: number;
    }) => Promise<TiktokPlaylistResponse>;
    Trending: (options?: {
        proxy?: string;
    }) => Promise<TiktokTrendingResponse>;
    GetVideosByMusicId: (musicIdOrUrl: string, options?: {
        proxy?: string;
        page?: number;
        count?: number;
    }) => Promise<TiktokMusicVideosResponse>;
    GetMusicDetail: (musicIdOrUrl: string, options: {
        cookie: string | any[];
        proxy?: string;
    }) => Promise<TiktokMusicDetailResponse>;
    TrendingCreators: (options?: {
        proxy?: string;
    }) => Promise<{
        status: "success" | "error";
        message?: string;
        result?: TrendingCreator[];
    }>;
};
export = _default;
