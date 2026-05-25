"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiktokService = void 0;
const jsdom_1 = require("jsdom");
const params_1 = require("../constants/params");
const xbogus_1 = __importDefault(require("../../helper/xbogus"));
const headers_1 = require("../constants/headers");
const fs_1 = __importDefault(require("fs"));
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
class TiktokService {
    constructor() {
        this.signaturejs = fs_1.default.readFileSync(path_1.default.join(TiktokService.FILE_PATH, "signature.js"), "utf-8");
        this.webmssdk = fs_1.default.readFileSync(path_1.default.join(TiktokService.FILE_PATH, "webmssdk.js"), "utf-8");
        this.resourceLoader = new jsdom_1.ResourceLoader({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35"
        });
    }
    generateSignature(url) {
        const stringUrl = url.toString();
        const jsdomOptions = this.getJsdomOptions();
        const { window } = new jsdom_1.JSDOM(``, jsdomOptions);
        let _window = window;
        _window.eval(this.signaturejs.toString());
        _window.byted_acrawler.init({
            aid: 24,
            dfp: true
        });
        _window.eval(this.webmssdk);
        const signature = _window.byted_acrawler.sign({ url: stringUrl });
        return signature;
    }
    generateXBogus(url, signature) {
        const jsdomOptions = this.getJsdomOptions();
        const { window } = new jsdom_1.JSDOM(``, jsdomOptions);
        let _window = window;
        _window.eval(this.signaturejs.toString());
        _window.byted_acrawler.init({
            aid: 24,
            dfp: true
        });
        _window.eval(this.webmssdk);
        if (signature) {
            url.searchParams.append("_signature", signature);
        }
        const xbogus = _window._0x32d649(url.searchParams.toString());
        return xbogus;
    }
    generateXTTParams(params) {
        const cipher = (0, crypto_1.createCipheriv)("aes-128-cbc", TiktokService.AES_KEY, TiktokService.AES_IV);
        return Buffer.concat([cipher.update(params), cipher.final()]).toString("base64");
    }
    generateURLXbogus(username, page) {
        const baseUrl = `${TiktokService.BASE_URL}api/search/user/full/?`;
        const queryParams = (0, params_1._userSearchParams)(username, page);
        const xbogusParams = (0, xbogus_1.default)(`${baseUrl}${queryParams}`, headers_1.userAgent);
        return `${baseUrl}${(0, params_1._userSearchParams)(username, page, xbogusParams)}`;
    }
    getJsdomOptions() {
        return {
            url: TiktokService.BASE_URL,
            referrer: TiktokService.BASE_URL,
            contentType: "text/html",
            includeNodeLocations: false,
            runScripts: "outside-only",
            pretendToBeVisual: true,
            resources: new jsdom_1.ResourceLoader({ userAgent: headers_1.webUserAgent })
        };
    }
}
exports.TiktokService = TiktokService;
TiktokService.FILE_PATH = path_1.default.join(__dirname, "../../helper");
TiktokService.BASE_URL = "https://www.tiktok.com/";
TiktokService.AES_KEY = "webapp1.0+202106";
TiktokService.AES_IV = "webapp1.0+202106";
