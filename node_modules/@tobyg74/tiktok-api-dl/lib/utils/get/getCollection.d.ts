import { TiktokCollectionResponse } from "../../types/get/getCollection";
export declare const getCollection: (collectionId: string, proxy?: string, page?: number, count?: number) => Promise<TiktokCollectionResponse>;
export declare const Collection: (collectionIdOrUrl: string, options?: {
    page?: number;
    proxy?: string;
    count?: number;
}) => Promise<TiktokCollectionResponse>;
