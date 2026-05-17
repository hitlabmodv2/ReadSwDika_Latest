/**
 * ───────────────────────────────
 *  Scraper   : Tempmail by Etokom
 *  Source    : https://tmail.etokom.com/
 *  Recode By : Bang Wilykun
 *  WhatsApp  : 6289688206739
 * ───────────────────────────────
 */
'use strict';

const axios = require('axios');
const path = require('path');

const BASE_URL = 'https://tmail.etokom.com';
const DEFAULT_DOMAINS = ['t.etokom.com', 'us.seebestdeals.com', 'gift4zone.top'];

const UA = 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

let _gemSingleton = null;
function getGem() {
  if (_gemSingleton) return _gemSingleton;
  try {
    const Gem = require(path.join(__dirname, 'gemmyGemini.cjs'));
    _gemSingleton = new Gem();
  } catch (_) {
    _gemSingleton = null;
  }
  return _gemSingleton;
}

class TmailEtokom {
  constructor(opts = {}) {
    this.baseURL = opts.baseURL || BASE_URL;
    this.cookies = new Map();
    this.token = null;
    this.mailbox = null;
    this.emailToken = null;
    this.lastSeenIds = new Set();
    this.analyze = opts.analyze !== false; // default ON
    this.aiTimeout = opts.aiTimeout || 25000;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: opts.timeout || 20000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: {
        'user-agent': UA,
        'accept-language': 'en-US,en;q=0.9,id;q=0.8',
      },
    });

    this.client.interceptors.request.use((config) => {
      const cookieHeader = this._cookieHeader();
      if (cookieHeader) config.headers.Cookie = cookieHeader;
      config.headers.Referer = this.baseURL + '/';
      config.headers.Origin = this.baseURL;
      return config;
    });

    this.client.interceptors.response.use((res) => {
      this._absorbCookies(res.headers['set-cookie']);
      return res;
    }, (err) => {
      if (err.response) this._absorbCookies(err.response.headers['set-cookie']);
      return Promise.reject(err);
    });
  }

  _absorbCookies(setCookie) {
    if (!setCookie) return;
    const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const raw of arr) {
      const part = String(raw).split(';')[0];
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      const name = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (!name) continue;
      if (!value || value === 'deleted') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  _cookieHeader() {
    if (!this.cookies.size) return '';
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async init(force = false) {
    if (this.token && !force) return this.token;
    const { data } = await this.client.get('/');
    const m = String(data).match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i);
    if (!m) throw new Error('Gagal mengambil CSRF token dari halaman utama.');
    this.token = m[1];
    return this.token;
  }

  _form(extra = {}) {
    const params = new URLSearchParams();
    params.append('_token', this.token);
    for (const [k, v] of Object.entries(extra)) {
      if (Array.isArray(v)) {
        for (const item of v) params.append(`${k}[]`, item);
      } else if (v !== undefined && v !== null) {
        params.append(k, String(v));
      }
    }
    return params;
  }

  async _post(path, extra = {}) {
    await this.init();
    const headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': this.token,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const xsrf = this.cookies.get('XSRF-TOKEN');
    if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);

    const res = await this.client.post(path, this._form(extra), { headers });
    return res.data;
  }

  _absorbState(data) {
    if (data && typeof data === 'object') {
      if (data.mailbox) this.mailbox = data.mailbox;
      if (data.email_token) this.emailToken = data.email_token;
    }
    return data;
  }

  /** Buat (atau ambil) email default acak */
  async create() {
    const data = await this._post('/get_messages', { captcha: '' });
    return this._absorbState(data);
  }

  /** Serialisasi state penting buat disimpan ke file (per user) */
  serialize() {
    return {
      mailbox: this.mailbox,
      token: this.token,
      emailToken: this.emailToken,
      cookies: [...this.cookies.entries()],
      savedAt: Date.now(),
    };
  }

  /** Restore state dari objek hasil serialize() */
  restore(state) {
    if (!state || typeof state !== 'object') return this;
    if (state.mailbox) this.mailbox = state.mailbox;
    if (state.token) this.token = state.token;
    if (state.emailToken) this.emailToken = state.emailToken;
    if (Array.isArray(state.cookies)) {
      this.cookies = new Map(state.cookies);
    }
    return this;
  }

  /** Ganti ke alamat email custom (name + domain) */
  async change(name, domain = DEFAULT_DOMAINS[0]) {
    if (!name || !String(name).trim()) throw new Error('Nama email diperlukan.');
    if (!domain) throw new Error('Domain diperlukan.');
    if (!this.token) await this.create();
    const data = await this._post('/change', {
      name: String(name).trim().toLowerCase(),
      domain: String(domain).trim().toLowerCase(),
    });
    return this._absorbState(data);
  }

  /** Pilih email dari history */
  async select(name, domain) {
    if (!this.token) await this.create();
    const data = await this._post('/change_email', { name, domain });
    return this._absorbState(data);
  }

  /** Ambil daftar pesan (inbox) terbaru */
  async inbox() {
    const data = await this._post('/get_messages', { captcha: '' });
    return this._absorbState(data);
  }

  /** Lihat detail pesan (otomatis ambil konten iframe juga) */
  async view(id) {
    if (!id) throw new Error('Message ID diperlukan.');
    await this.init();
    const { data: html } = await this.client.get(`/view/${encodeURIComponent(id)}`, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    const parsed = this._parseView(String(html), id);

    // Kalau body diembed lewat iframe src, fetch lagi isi iframe-nya
    if (!parsed.bodyHtml && parsed.iframeSrc) {
      try {
        const { data: frameHtml } = await this.client.get(parsed.iframeSrc, {
          headers: { Accept: 'text/html,application/xhtml+xml' },
        });
        parsed.bodyHtml = String(frameHtml);
        parsed.bodyText = stripHtml(parsed.bodyHtml);
      } catch (_) {}
    }

    parsed.links = extractLinks(parsed.bodyHtml || '');

    if (this.analyze) {
      parsed.ai = await this._enrichWithAI(parsed);
    }
    return parsed;
  }

  /** Analisa pakai Gemini — kembalikan { code, primaryUrl, primaryLabel, summary } atau null */
  async _enrichWithAI(parsed) {
    const gem = getGem();
    if (!gem) return null;
    try {
      const aiPromise = gem.analyzeEmail({
        subject: parsed.subject || '',
        from: parsed.from || '',
        body: parsed.bodyText || '',
        links: parsed.links || [],
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), this.aiTimeout)
      );
      return await Promise.race([aiPromise, timeoutPromise]);
    } catch (_) {
      return null;
    }
  }

  _parseView(html, id) {
    const pick = (re) => {
      const m = html.match(re);
      return m ? m[1].trim() : null;
    };

    const subject = pick(/<h1[^>]*class=["'][^"']*(?:message-subject|email-subject|subject)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      || pick(/<h[1-3][^>]*id=["']subject["'][^>]*>([\s\S]*?)<\/h[1-3]>/i)
      || pick(/<meta[^>]+name=["']subject["'][^>]+content=["']([^"']+)["']/i)
      || pick(/<title>([^<]*)<\/title>/i);

    const from = pick(/<input[^>]+id=["']from["'][^>]*value=["']([^"']+)["']/i)
      || pick(/data-from=["']([^"']+)["']/i)
      || pick(/<(?:span|p|div)[^>]*class=["'][^"']*(?:from-email|sender-email|from)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|p|div)>/i)
      || pick(/From:\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i);

    const to = pick(/<input[^>]+id=["']to["'][^>]*value=["']([^"']+)["']/i)
      || pick(/data-to=["']([^"']+)["']/i)
      || pick(/<(?:span|p|div)[^>]*class=["'][^"']*(?:to-email|recipient)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|p|div)>/i);

    const date = pick(/<time[^>]*>([\s\S]*?)<\/time>/i)
      || pick(/<(?:span|p|div)[^>]*class=["'][^"']*(?:date|received|message-date)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|p|div)>/i);

    // 1) Body diembed via srcdoc
    let body = pick(/<iframe[^>]*id=["']myContent["'][^>]*srcdoc=["']([\s\S]*?)["']\s*[>\/]/i)
      || pick(/<iframe[^>]*srcdoc=["']([\s\S]*?)["'][^>]*>/i);
    if (body) {
      body = body.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
    }

    // 2) Body diembed via src URL
    const iframeSrc = pick(/<iframe[^>]*id=["']myContent["'][^>]*src=["']([^"']+)["']/i)
      || pick(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);

    // 3) Fallback: cari container utama
    if (!body && !iframeSrc) {
      body = pick(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*(?:message-body|email-body|mail-body|content-area|message-content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
      if (!body) {
        const main = pick(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
          || pick(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
        if (main) body = main;
      }
    }

    const text = stripHtml(body || html);

    return {
      id,
      subject: cleanText(subject),
      from: cleanText(from),
      to: cleanText(to),
      date: cleanText(date),
      bodyHtml: body || null,
      bodyText: text,
      iframeSrc: iframeSrc ? (iframeSrc.startsWith('http') ? iframeSrc : this.baseURL + iframeSrc) : null,
      url: `${this.baseURL}/view/${id}`,
    };
  }

  /** Polling realtime — resolve saat ada pesan baru atau timeout */
  async waitMessage(opts = {}) {
    const interval = Math.max(1000, opts.interval || 5000);
    const timeout = Math.max(interval, opts.timeout || 5 * 60 * 1000);
    const onTick = typeof opts.onTick === 'function' ? opts.onTick : null;
    const start = Date.now();

    if (!this.mailbox) await this.create();
    // baseline
    const first = await this.inbox();
    for (const m of first.messages || []) this.lastSeenIds.add(m.id);

    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, interval));
      let data;
      try {
        data = await this.inbox();
      } catch (e) {
        if (onTick) onTick({ error: e.message });
        continue;
      }
      const fresh = (data.messages || []).filter((m) => !this.lastSeenIds.has(m.id));
      for (const m of (data.messages || [])) this.lastSeenIds.add(m.id);
      if (onTick) onTick({ mailbox: data.mailbox, total: (data.messages || []).length, fresh: fresh.length });
      if (fresh.length) {
        const detailed = await Promise.all(fresh.map((m) =>
          this.view(m.id).then((d) => ({ ...m, ...d })).catch(() => m)
        ));
        return { mailbox: data.mailbox, messages: detailed };
      }
    }
    return { mailbox: this.mailbox, messages: [], timeout: true };
  }

  /**
   * Streaming realtime — terus polling sampai timeout, panggil onMessage
   * setiap kali ada email baru (lengkap dengan body & links).
   */
  async streamMessages(opts = {}) {
    const interval = Math.max(1000, opts.interval || 5000);
    const timeout = Math.max(interval, opts.timeout || 5 * 60 * 1000);
    const onMessage = typeof opts.onMessage === 'function' ? opts.onMessage : () => {};
    const onTick = typeof opts.onTick === 'function' ? opts.onTick : null;
    const start = Date.now();

    if (!this.mailbox) await this.create();
    const first = await this.inbox();
    for (const m of first.messages || []) this.lastSeenIds.add(m.id);

    let totalReceived = 0;
    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, interval));
      let data;
      try {
        data = await this.inbox();
      } catch (e) {
        if (onTick) onTick({ error: e.message });
        continue;
      }
      const fresh = (data.messages || []).filter((m) => !this.lastSeenIds.has(m.id));
      for (const m of (data.messages || [])) this.lastSeenIds.add(m.id);
      if (onTick) onTick({ mailbox: data.mailbox, total: (data.messages || []).length, fresh: fresh.length });
      for (const m of fresh) {
        let detail;
        try { detail = await this.view(m.id); } catch (_) { detail = {}; }
        const merged = { ...m, ...detail };
        totalReceived++;
        try { await onMessage(merged); } catch (_) {}
      }
    }
    return { mailbox: this.mailbox, total: totalReceived, timeout: true };
  }

  static get domains() {
    return [...DEFAULT_DOMAINS];
  }
}

function decodeHtmlEntities(s) {
  if (!s) return s;
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _; } })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&'); // HARUS terakhir biar gak double-decode
}

function extractLinks(html) {
  if (!html) return [];
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = decodeHtmlEntities(m[1].trim());
    if (!/^https?:\/\//i.test(url)) continue;
    const label = cleanText(m[2]) || '';
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, text: label });
  }
  // Plain-text fallback URLs (kalau body cuma teks)
  const plainRe = /(https?:\/\/[^\s<>"')]+)/gi;
  while ((m = plainRe.exec(html)) !== null) {
    const url = decodeHtmlEntities(m[1].replace(/[.,;:!?)]+$/, ''));
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, text: '' });
  }
  return out;
}

function cleanText(t) {
  if (t == null) return null;
  return String(t).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null;
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = TmailEtokom;
module.exports.TmailEtokom = TmailEtokom;
module.exports.DEFAULT_DOMAINS = DEFAULT_DOMAINS;
