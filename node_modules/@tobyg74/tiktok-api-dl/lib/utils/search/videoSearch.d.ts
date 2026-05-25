import { TiktokVideoSearchResponse } from "../../types/search/videoSearch";
export declare const SearchVideo: (keyword: string, cookie: string | any[], page?: number, proxy?: string) => Promise<TiktokVideoSearchResponse>;
