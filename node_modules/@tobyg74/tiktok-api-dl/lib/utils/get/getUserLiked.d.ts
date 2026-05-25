import { TiktokUserFavoriteVideosResponse } from "../../types/get/getUserLiked";
export declare const getUserLiked: (username: string, cookie: string | any[], proxy?: string, postLimit?: number) => Promise<TiktokUserFavoriteVideosResponse>;
