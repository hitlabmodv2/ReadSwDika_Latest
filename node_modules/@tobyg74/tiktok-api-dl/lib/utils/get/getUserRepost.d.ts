import { TiktokUserRepostsResponse } from "../../types/get/getUserReposts";
export declare const getUserReposts: (username: string, proxy?: string, postLimit?: number, filterDeletedPost?: boolean) => Promise<TiktokUserRepostsResponse>;
