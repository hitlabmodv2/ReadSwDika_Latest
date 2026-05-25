import { TiktokTrendingResponse, TrendingCreator } from "../../types/get/getTrendings";
export declare const getTrendings: (proxy?: string) => Promise<TiktokTrendingResponse>;
export declare const getTrendingCreators: (proxy?: string) => Promise<{
    status: "success" | "error";
    message?: string;
    result?: TrendingCreator[];
}>;
