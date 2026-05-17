/**
 * ───────────────────────────────
 *  Helper    : Gemini AI wrapper untuk analisa email tempmail
 *  Tujuan    : Pilih SATU link verifikasi paling penting + label akurat
 *  Dipakai   : src/scrape/tmail.cjs → analyzeEmail()
 * ───────────────────────────────
 */
'use strict';

const path = require('path');
const _gem = require(path.join(__dirname, 'gemini.cjs'));
const Gemini = _gem && _gem.Gemini ? _gem.Gemini : _gem;

class GemmyGemini {
  constructor() {
    this.gem = (_gem && _gem.gemini) ? _gem.gemini : new Gemini();
  }

  async analyzeEmail({ subject = '', from = '', body = '', links = [] } = {}) {
    const cleanLinks = (Array.isArray(links) ? links : [])
      .filter((l) => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
      .slice(0, 20)
      .map((l, i) => ({ i: i + 1, url: l.url, text: (l.text || '').slice(0, 80) }));

    const safeBody = String(body || '').slice(0, 4000);
    const linksJson = JSON.stringify(cleanLinks, null, 0);

    const prompt =
      `Kamu adalah analis email otomatis. Tugasmu MEMILIH SATU link paling penting dari daftar links berikut, ` +
      `dan ambil kode OTP/verifikasi (kalau ada) dari isi email.\n\n` +
      `ATURAN MEMILIH LINK:\n` +
      `1. Prioritaskan link verifikasi/konfirmasi/aktivasi/reset/login/magic-link akun.\n` +
      `2. JANGAN pilih link unsubscribe, opt-out, manage preferences, notification settings, social media, atau footer.\n` +
      `3. Kalau ada beberapa kandidat, pilih yang paling spesifik (misal mengandung token/kode di query string seperti oobCode, token, key).\n` +
      `4. Kalau benar-benar tidak ada link verifikasi, pilih link utama yang paling masuk akal (CTA pertama, bukan junk).\n` +
      `5. Kalau tidak ada link sama sekali, set primaryUrl = null.\n\n` +
      `ATURAN LABEL (primaryLabel):\n` +
      `- Maks 18 karakter, Bahasa Indonesia, action-oriented.\n` +
      `- Contoh bagus: "Verifikasi Email", "Konfirmasi Akun", "Reset Password", "Login", "Aktivasi", "Buka Dashboard".\n\n` +
      `ATURAN KODE (code):\n` +
      `- Ambil kode OTP / verification code yang DITUJUKAN ke user (4-10 char alfanumerik, harus mengandung minimal 1 angka).\n` +
      `- JANGAN ambil ID pesan, nomor invoice, tahun, atau angka acak yang bukan kode verifikasi.\n` +
      `- Kalau tidak ada, set code = null.\n\n` +
      `RINGKASAN (summary):\n` +
      `- 1 kalimat Bahasa Indonesia, maks 120 karakter, jelaskan inti email.\n\n` +
      `INPUT EMAIL:\n` +
      `Subject: ${subject || '-'}\n` +
      `From: ${from || '-'}\n` +
      `Body:\n${safeBody || '-'}\n\n` +
      `Links (JSON array): ${linksJson}\n\n` +
      `OUTPUT: WAJIB JSON valid satu baris (tanpa markdown, tanpa code fence), dengan schema persis:\n` +
      `{"code": string|null, "primaryUrl": string|null, "primaryLabel": string|null, "summary": string|null}`;

    let raw;
    try {
      raw = await this.gem.chat({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        temperature: 0,
        responseMimeType: 'application/json',
      });
    } catch (_) {
      return null;
    }

    const parsed = this._parseJson(raw);
    if (!parsed) return null;

    let code = this._sanitizeCode(parsed.code);
    let primaryUrl = this._sanitizeUrl(parsed.primaryUrl, cleanLinks);
    let primaryLabel = this._sanitizeLabel(parsed.primaryLabel);
    let summary = this._sanitizeSummary(parsed.summary);

    return { code, primaryUrl, primaryLabel, summary };
  }

  _parseJson(raw) {
    if (!raw) return null;
    let txt = String(raw).trim();
    txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return JSON.parse(txt); } catch (_) {}
    const m = txt.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
    return null;
  }

  _sanitizeCode(c) {
    if (c == null) return null;
    const s = String(c).trim();
    if (!s || s.length < 4 || s.length > 12) return null;
    if (!/^[A-Za-z0-9-]+$/.test(s)) return null;
    if (!/\d/.test(s)) return null;
    if (/^(null|none|tidak|kosong)$/i.test(s)) return null;
    return s;
  }

  _sanitizeUrl(u, allowed) {
    if (!u) return null;
    const s = String(u).trim();
    if (!/^https?:\/\//i.test(s)) return null;
    // Pastikan AI gak ngarang URL — wajib ada di daftar links yang dikasih
    if (Array.isArray(allowed) && allowed.length) {
      const ok = allowed.some((l) => l.url === s);
      if (!ok) {
        // Tolerate trailing slash / case
        const norm = (x) => String(x).replace(/\/+$/, '').toLowerCase();
        const ok2 = allowed.some((l) => norm(l.url) === norm(s));
        if (!ok2) return null;
      }
    }
    return s;
  }

  _sanitizeLabel(l) {
    if (!l) return null;
    const s = String(l).trim().replace(/[\r\n]+/g, ' ');
    if (!s) return null;
    return s.slice(0, 18);
  }

  _sanitizeSummary(s) {
    if (!s) return null;
    const t = String(s).trim().replace(/\s+/g, ' ');
    if (!t) return null;
    return t.slice(0, 140);
  }
}

module.exports = GemmyGemini;
module.exports.GemmyGemini = GemmyGemini;
