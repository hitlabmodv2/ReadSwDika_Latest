import { TiktokAPIResponse } from "../../types/downloader/tiktokApiDownloader";
export declare const handleRedirect: (url: string, proxy?: string) => Promise<string>;
export declare const TiktokAPI: (url: string, proxy?: string, showOriginalResponse?: boolean) => Promise<TiktokAPIResponse>;
