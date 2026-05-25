import { TiktokMusicVideosResponse } from "../../types/get/getMusicVideos";
export declare const getMusicVideos: (musicIdOrUrl: string, proxy?: string, page?: number, count?: number) => Promise<TiktokMusicVideosResponse>;
