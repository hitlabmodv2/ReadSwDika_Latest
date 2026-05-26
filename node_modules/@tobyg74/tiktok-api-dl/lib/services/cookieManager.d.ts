export declare class CookieManager {
    private cookieFile;
    private cookieData;
    constructor();
    private loadCookies;
    private saveCookies;
    setCookie(value: string): void;
    getCookie(): string | null;
    deleteCookie(): void;
}
