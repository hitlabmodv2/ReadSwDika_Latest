/**
 * ───────────────────────────────
 *  Base Script : Bang Dika Ardnt
 *  Recode By   : Bang Wilykun
 *  WhatsApp    : 6289688206739
 *  Telegram    : @Wilykun1994
 * ───────────────────────────────
 *  Script ini khusus donasi/VIP
 *  Support dari kalian bikin saya
 *  makin semangat update fitur,
 *  fix bug, dan rawat script ini.
 *
 *  Dilarang menjual ulang script ini
 *  Tanpa izin resmi dari developer.
 *  Jika ketahuan = NO UPDATE / NO FIX
 *
 *  Hargai karya, gunakan dengan bijak.
 *  Terima kasih sudah support.
 * ───────────────────────────────
 */
import axios from 'axios';
import https from 'https';
import path from 'path';
import { kvGet, kvSet, kvMigrateFromJSON, kvMigrateKey } from '../db/datadb.js';

kvMigrateFromJSON('ai/gemini_tokens', path.join(process.cwd(), 'data', 'gemini_tokens.json'));
kvMigrateKey('gemini_tokens', 'ai/gemini_tokens');

const GEMINI_VERBOSE_LOGS = process.env.WILY_VERBOSE_LOGS === 'true' || process.env.BOT_DEBUG_LOG === 'true';
const GEMINI_TIMING_LOGS = process.env.GEMINI_TIMING_LOGS !== 'false';
const geminiLog = (...args) => { if (GEMINI_VERBOSE_LOGS) console.log(...args); };
const geminiError = (...args) => { if (GEMINI_VERBOSE_LOGS) console.error(...args); };
const geminiTiming = (...args) => { if (GEMINI_TIMING_LOGS) console.log(...args); };

const KEEPALIVE_AGENT = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
});

const SIGNUP_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyAxof8_SbpDcww38NEQRhNh0Pzvbphh-IQ';
const CHAT_URL = 'https://asia-northeast3-gemmy-ai-bdc03.cloudfunctions.net/gemini';

const SIGNUP_HEADERS = {
    'accept-encoding': 'gzip',
    'accept-language': 'in-ID, en-US',
    'connection': 'Keep-Alive',
    'content-type': 'application/json',
    'user-agent': 'Dalvik/2.1.0 (Linux; U; Android 10; SM-J700F Build/QQ3A.200805.001)',
    'x-android-cert': '037CD2976D308B4EFD63EC63C48DC6E7AB7E5AF2',
    'x-android-package': 'com.jetkite.gemmy',
    'x-client-version': 'Android/Fallback/X24000001/FirebaseCore-Android',
    'x-firebase-appcheck': 'eyJlcnJvciI6IlVOS05PV05fRVJST1IifQ==',
    'x-firebase-client': 'H4sIAAAAAAAAAKtWykhNLCpJSk0sKVayio7VUSpLLSrOzM9TslIyUqoFAFyivEQfAAAA',
    'x-firebase-gmpid': '1:652803432695:android:c4341db6033e62814f33f2',
};

const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-pro-latest'];
const MAX_TOKEN_ROTATIONS = 2;
const POOL_SIZE = 3;
const REQUEST_TIMEOUT_MS = 25000;

class Gemini {
    constructor() {
        this.tokenPool = [];
        this.poolIndex = 0;
        this._loadTokenCache();
    }

    _loadTokenCache() {
        try {
            const raw = kvGet('ai/gemini_tokens', null);
            if (!raw) return;
            const now = Date.now();
            this.tokenPool = (raw.pool || []).filter(t => t && t.token && t.expiry && now < t.expiry - 300000);
            if (this.tokenPool.length > 0) {
                geminiLog(`\x1b[32m[Gemini]\x1b[0m ♻️ Loaded ${this.tokenPool.length} cached token(s) from DB`);
            }
        } catch (_) {}
    }

    _saveTokenCache() {
        try {
            kvSet('ai/gemini_tokens', { pool: this.tokenPool, savedAt: Date.now() });
        } catch (_) {}
    }

    async _signup() {
        try {
            const { data } = await axios.post(
                SIGNUP_URL,
                { clientType: 'CLIENT_TYPE_ANDROID' },
                { headers: SIGNUP_HEADERS, timeout: 12000, httpsAgent: KEEPALIVE_AGENT }
            );
            if (!data.idToken) throw new Error('Failed to get Gemini auth token (no idToken).');
            return { token: data.idToken, expiry: Date.now() + 3600 * 1000 };
        } catch (err) {
            const body = err.response?.data;
            const detail = body ? (typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)) : err.message;
            geminiError(`\x1b[31m[Gemini-Signup]\x1b[0m FAIL: ${detail}`);
            throw new Error(`Signup failed: ${detail}`);
        }
    }

    async _ensurePool() {
        const now = Date.now();
        const before = this.tokenPool.length;
        this.tokenPool = this.tokenPool.filter(t => t && now < t.expiry - 300000);
        if (this.tokenPool.length !== before) this._saveTokenCache();
        while (this.tokenPool.length < POOL_SIZE) {
            try {
                const t = await this._signup();
                this.tokenPool.push(t);
                this._saveTokenCache();
                geminiLog(`\x1b[36m[Gemini]\x1b[0m 🔑 Token pool +1 (size=${this.tokenPool.length})`);
            } catch (e) {
                if (this.tokenPool.length === 0) throw new Error('Auth error: ' + e.message);
                break;
            }
        }
    }

    async _getToken({ forceFresh = false } = {}) {
        if (forceFresh) {
            const fresh = await this._signup();
            this.tokenPool.push(fresh);
            this._saveTokenCache();
            this.poolIndex = this.tokenPool.length - 1;
            geminiLog(`\x1b[33m[Gemini]\x1b[0m ♻️  Forced fresh token (pool=${this.tokenPool.length})`);
            return fresh.token;
        }
        await this._ensurePool();
        this.poolIndex = (this.poolIndex + 1) % this.tokenPool.length;
        return this.tokenPool[this.poolIndex].token;
    }

    _invalidateToken(token) {
        const before = this.tokenPool.length;
        this.tokenPool = this.tokenPool.filter(t => t.token !== token);
        if (this.tokenPool.length !== before) this._saveTokenCache();
    }

    async getAuthToken() {
        return this._getToken();
    }

    async _callOnce({ token, model, contents, config }) {
        // Default lebih rendah biar nggak ngarang. Caller bisa override via config.
        const generationConfig = {
            maxOutputTokens: 2048,
            temperature: 0.7,
            topP: 0.9,
            ...config,
        };
        const { data } = await axios.post(
            CHAT_URL,
            {
                model,
                stream: false,
                request: {
                    contents,
                    generationConfig,
                },
            },
            {
                headers: {
                    'accept-encoding': 'gzip',
                    'authorization': `Bearer ${token}`,
                    'content-type': 'application/json; charset=UTF-8',
                    'user-agent': 'okhttp/5.3.2',
                },
                timeout: REQUEST_TIMEOUT_MS,
                httpsAgent: KEEPALIVE_AGENT,
            }
        );
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini returned empty response. Raw: ' + JSON.stringify(data).slice(0, 200));
        return text;
    }

    async chat({ contents, model = 'gemini-flash-latest', ...config }) {
        if (!Array.isArray(contents)) throw new Error('Contents must be an array.');

        const requestedModel = model;
        const modelChain = [requestedModel, ...FALLBACK_MODELS.filter(m => m !== requestedModel)];

        const tStart = Date.now();
        const promptSize = JSON.stringify(contents).length;

        let lastErr = null;

        for (const m of modelChain) {
            for (let attempt = 0; attempt < MAX_TOKEN_ROTATIONS; attempt++) {
                let token;
                try {
                    token = await this._getToken({ forceFresh: attempt > 0 });
                } catch (e) {
                    lastErr = e;
                    break;
                }

                try {
                    const text = await this._callOnce({ token, model: m, contents, config });
                    const elapsed = Date.now() - tStart;
                    const slow = elapsed > 8000 ? ' 🐢' : elapsed > 4000 ? ' ⏱️' : '';
                    geminiTiming(`\x1b[36m[Gemini]\x1b[0m ✓ ${m} • ${elapsed}ms • in:${(promptSize/1024).toFixed(1)}KB out:${text.length}c${slow}`);
                    if (attempt > 0 || m !== requestedModel) {
                        geminiLog(`\x1b[32m[Gemini]\x1b[0m ✅ OK setelah retry → model=${m}, attempt=${attempt + 1}`);
                    }
                    return text;
                } catch (err) {
                    lastErr = err;
                    const status = err.response?.status;
                    const body = err.response?.data;
                    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

                    if (status === 401 || status === 403 || /UNAUTHENTICATED|invalid.?token|expired/i.test(bodyStr)) {
                        geminiError(`\x1b[33m[Gemini]\x1b[0m 🔒 Token invalid → refresh & retry`);
                        this._invalidateToken(token);
                        await new Promise(r => setTimeout(r, 300));
                        continue;
                    }

                    if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(bodyStr)) {
                        geminiError(`\x1b[33m[Gemini]\x1b[0m ⏳ Rate-limit (429) → rotate token (attempt ${attempt + 1}/${MAX_TOKEN_ROTATIONS}, model=${m})`);
                        this._invalidateToken(token);
                        const wait = Math.min(500 * (attempt + 1), 2500);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }

                    if (status === 404 || /NOT_FOUND|not found/i.test(bodyStr)) {
                        geminiError(`\x1b[33m[Gemini]\x1b[0m 🚫 Model ${m} tidak tersedia (404) → fallback model berikutnya`);
                        break;
                    }

                    if (status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
                        geminiError(`\x1b[33m[Gemini]\x1b[0m 🌐 Network/server error (${status || err.code}) → retry`);
                        const wait = Math.min(400 * (attempt + 1), 2000);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }

                    throw new Error(bodyStr ? bodyStr.slice(0, 300) : err.message);
                }
            }
        }

        if (lastErr?.response?.data) {
            const body = lastErr.response.data;
            throw new Error(typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300));
        }
        throw new Error(lastErr?.message || 'Gemini request failed after all retries.');
    }

    // Chat text only
    async ask(prompt) {
        return this.chat({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            model: 'gemini-flash-latest',
        });
    }

    // Chat dengan gambar (vision) — pakai chat() yang sudah punya auto fallback model + token rotation
    async askWithImage(prompt, imageBuffer, mimeType = 'image/jpeg') {
        if (!imageBuffer || imageBuffer.length === 0) {
            throw new Error('Image buffer kosong atau tidak valid');
        }
        const base64 = imageBuffer.toString('base64');
        return this.chat({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: base64 } },
                    { text: prompt },
                ],
            }],
        });
    }
}

const gemini = new Gemini();

// Pre-warm token pool
gemini._ensurePool().catch(() => {});

export default gemini;
