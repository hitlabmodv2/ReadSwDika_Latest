import { TiktokUserPostsResponse } from "../../types/get/getUserPosts";
export declare const getUserPosts: (username: string, proxy?: string, postLimit?: number) => Promise<TiktokUserPostsResponse>;
