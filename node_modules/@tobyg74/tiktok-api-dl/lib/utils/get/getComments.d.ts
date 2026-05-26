import { TiktokVideoCommentsResponse } from "../../types/get/getComments";
export declare const getComments: (url: string, proxy?: string, commentLimit?: number) => Promise<TiktokVideoCommentsResponse>;
