export declare class TiktokService {
    generateSignature(url: URL): string;
    generateXBogus(url: URL, signature?: string): string;
    generateXTTParams(params: any): string;
    generateURLXbogus(username: string, page: number): string;
    private getJsdomOptions;
    private static readonly FILE_PATH;
    private static readonly BASE_URL;
    private static readonly AES_KEY;
    private static readonly AES_IV;
    private signaturejs;
    private webmssdk;
    private resourceLoader;
}
