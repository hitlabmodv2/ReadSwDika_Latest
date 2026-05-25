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
'use strict';

const axios  = require('axios');
const sharp  = require('sharp');
const PDFDoc = require('pdfkit');

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

// A4
const PW = 595.28;
const PH = 841.89;
const ML = 30;
const MR = 30;
const CW = PW - ML - MR; // ~535

// Banner image dimensions (landscape, like kusonime website)
const IMG_W = CW;          // full content width
const IMG_H = Math.round(CW * 340 / 604); // maintain 604:340 ratio → ~301px

// Colors
const RED   = '#e94560';
const DARK  = '#1a1a2e';
const DARK2 = '#16213e';
const WHITE = '#ffffff';
const GRAY  = '#777777';
const LGRAY = '#aaaaaa';
const TEXT  = '#1a1a1a';
const SUB   = '#555555';
const BLUE  = '#0055cc';
const BG1   = '#f4f4f4';
const BG2   = '#ffffff';

function fill(doc, x, y, w, h, color) {
        doc.rect(x, y, w, h).fill(color);
}

// Strict printable ASCII only — strips all kanji/emoji/etc.
function safe(str, max) {
        if (!str) return '';
        const s = str.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
        return max && s.length > max ? s.slice(0, max - 1) + '...' : s;
}

function cleanTitle(t) {
        return (t || '')
                .replace(/\s*Batch\s+Subtitle\s+Indonesia\s*/gi, '')
                .replace(/\s*Subtitle\s+Indonesia\s*/gi, '')
                .replace(/\s*Sub\s+Indo\s*/gi, '')
                .trim();
}

// Fetch thumbnail and resize to landscape banner — exactly like kusonime.com
async function fetchBanner(url) {
        if (!url) return null;
        try {
                const r = await axios.get(url, {
                        responseType: 'arraybuffer',
                        headers: HEADERS,
                        timeout: 12000,
                });
                // Resize to PDF content width, keep landscape ratio
                return await sharp(Buffer.from(r.data))
                        .resize(Math.round(IMG_W * 2), Math.round(IMG_H * 2), {
                                fit: 'cover',
                                position: 'top',
                        })
                        .jpeg({ quality: 88 })
                        .toBuffer();
        } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
async function generateSeasonPdf(season, year, animes) {
        const label = season.charAt(0).toUpperCase() + season.slice(1).toLowerCase();
        const now   = new Date().toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const valid = animes.filter(Boolean);

        // Pre-fetch banners (5 at a time)
        const banners = [];
        for (let i = 0; i < valid.length; i += 5) {
                const batch = await Promise.all(
                        valid.slice(i, i + 5).map(a => fetchBanner(a.thumbnail))
                );
                banners.push(...batch);
        }

        return new Promise((resolve, reject) => {
                const doc = new PDFDoc({ size: 'A4', margin: 0, autoFirstPage: false, compress: true });
                const chunks = [];
                doc.on('data', c => chunks.push(c));
                doc.on('end',  () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // ══════════════════════════════
                // COVER PAGE
                // ══════════════════════════════
                doc.addPage();

                fill(doc, 0, 0, PW, 195, DARK);
                fill(doc, 0, 191, PW, 4, RED);

                doc.fillColor(RED).font('Helvetica-Bold').fontSize(9)
                   .text('KUSONIME.COM', ML, 25, { width: CW, align: 'center' });
                doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(30)
                   .text('ANIME ' + label.toUpperCase() + ' ' + year, ML, 44, { width: CW, align: 'center' });
                doc.fillColor(LGRAY).font('Helvetica').fontSize(10)
                   .text('Koleksi Anime Subtitle Indonesia', ML, 90, { width: CW, align: 'center' });

                // Stat boxes
                const SBY = 118, SBH = 50;
                const W1 = 116, W3 = 116, W2 = CW - W1 - W3 - 10;

                fill(doc, ML, SBY, W1, SBH, DARK2);
                doc.fillColor(RED).font('Helvetica-Bold').fontSize(26)
                   .text(String(valid.length), ML, SBY + 4, { width: W1, align: 'center' });
                doc.fillColor(LGRAY).font('Helvetica').fontSize(7.5)
                   .text('TOTAL ANIME', ML, SBY + 35, { width: W1, align: 'center' });

                fill(doc, ML + W1 + 5, SBY, W2, SBH, DARK2);
                doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(14)
                   .text(label + ' ' + year, ML + W1 + 5, SBY + 10, { width: W2, align: 'center' });
                doc.fillColor(LGRAY).font('Helvetica').fontSize(7.5)
                   .text('MUSIM ANIME', ML + W1 + 5, SBY + 34, { width: W2, align: 'center' });

                fill(doc, ML + W1 + W2 + 10, SBY, W3, SBH, DARK2);
                doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(10)
                   .text(safe(now.slice(0, 16)), ML + W1 + W2 + 10, SBY + 12, { width: W3, align: 'center' });
                doc.fillColor(LGRAY).font('Helvetica').fontSize(7.5)
                   .text('DIPERBARUI', ML + W1 + W2 + 10, SBY + 34, { width: W3, align: 'center' });

                // TOC
                const TOC_Y = 210;
                doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12)
                   .text('DAFTAR JUDUL', ML, TOC_Y);
                fill(doc, ML, TOC_Y + 17, 50, 3, RED);

                const LY0 = TOC_Y + 27;
                const RH  = 15;
                const HW  = Math.floor(CW / 2) - 4;
                valid.forEach((a, i) => {
                        const right = i % 2 === 1;
                        const row   = Math.floor(i / 2);
                        const x     = right ? ML + HW + 8 : ML;
                        const y     = LY0 + row * RH;
                        if (y > PH - 40) return;
                        if (row % 2 === 0) fill(doc, x - 2, y - 1, HW + 2, RH - 1, BG1);
                        doc.fillColor(RED).font('Helvetica-Bold').fontSize(7.5)
                           .text(String(i + 1).padStart(2, '0'), x, y + 1, { width: 14, lineBreak: false });
                        doc.fillColor(TEXT).font('Helvetica').fontSize(7.5)
                           .text(safe(cleanTitle(a.title), 33), x + 16, y + 1, { width: HW - 18, lineBreak: false });
                });

                fill(doc, 0, PH - 20, PW, 20, DARK);
                doc.fillColor(LGRAY).font('Helvetica').fontSize(7.5)
                   .text('Wily Bot  |  kusonime.com  |  ' + label + ' ' + year,
                          0, PH - 13, { width: PW, align: 'center', lineBreak: false });

                // ══════════════════════════════
                // PER-ANIME PAGES
                // Layout (A4 = 841px):
                //   [0–7]     Red top bar
                //   [7–55]    Dark title bar
                //   [55–356]  Landscape banner (IMG_H ~301px)
                //   [356–…]   Info grid (2-col)
                //   […–…]     Download links (fills to bottom)
                //   [821–841] Footer bar
                // ══════════════════════════════
                valid.forEach((anime, idx) => {
                        doc.addPage();

                        const banner = banners[idx];
                        const title  = cleanTitle(anime.title);
                        const info   = anime.info || {};
                        const groups = anime.downloadGroups || [];
                        const num    = String(idx + 1).padStart(2, '0');

                        let curY = 0;

                        // ── Red top bar
                        fill(doc, 0, 0, PW, 6, RED);
                        curY = 6;

                        // ── Dark title bar
                        fill(doc, 0, curY, PW, 49, DARK);
                        // Number badge
                        fill(doc, ML, curY + 7, 36, 35, RED);
                        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(17)
                           .text(num, ML, curY + 16, { width: 36, align: 'center', lineBreak: false });
                        // Title
                        const TX = ML + 44, TXW = CW - 44;
                        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(12.5)
                           .text(safe(title, 68), TX, curY + 9, { width: TXW, lineBreak: false });
                        // Source URL (small)
                        if (anime.url) {
                                doc.fillColor(LGRAY).font('Helvetica').fontSize(7.5)
                                   .text(safe(anime.url, 72), TX, curY + 30, { width: TXW, lineBreak: false });
                        }
                        curY += 55;

                        // ── Landscape banner — full content width, same ratio as kusonime.com
                        if (banner) {
                                try {
                                        doc.image(banner, ML, curY, { width: IMG_W, height: IMG_H });
                                } catch { noBanner(doc, ML, curY, IMG_W, IMG_H); }
                        } else {
                                noBanner(doc, ML, curY, IMG_W, IMG_H);
                        }

                        // Red accent line under image
                        fill(doc, ML, curY + IMG_H, IMG_W, 3, RED);
                        curY += IMG_H + 4;

                        // ── Info grid — 2 columns
                        const ALL_FIELDS = [
                                ['Genre',         'Genre    :'],
                                ['Type',          'Tipe     :'],
                                ['Total Episode', 'Episode  :'],
                                ['Score',         'Score    :'],
                                ['Duration',      'Durasi   :'],
                                ['Status',        'Status   :'],
                                ['Released on',   'Rilis    :'],
                                ['Seasons',       'Season   :'],
                                ['Producers',     'Studio   :'],
                        ].filter(([key]) => info[key]);

                        const IFR  = 16;                   // row height
                        const HALF = Math.floor(CW / 2) - 3;
                        const COL2 = ML + HALF + 6;

                        // Split into left/right columns
                        const leftFields  = ALL_FIELDS.filter((_, i) => i % 2 === 0);
                        const rightFields = ALL_FIELDS.filter((_, i) => i % 2 === 1);
                        const rows = Math.max(leftFields.length, rightFields.length);

                        const INFO_START = curY;
                        for (let r = 0; r < rows; r++) {
                                const rowY = INFO_START + r * IFR;

                                // Left col
                                if (leftFields[r]) {
                                        const [key, lbl] = leftFields[r];
                                        fill(doc, ML - 2, rowY, HALF + 2, IFR - 1, r % 2 === 0 ? BG1 : BG2);
                                        doc.fillColor(SUB).font('Helvetica-Bold').fontSize(8)
                                           .text(lbl, ML, rowY + 3, { width: 52, lineBreak: false });
                                        doc.fillColor(TEXT).font('Helvetica').fontSize(8)
                                           .text(safe(info[key], 36), ML + 54, rowY + 3, { width: HALF - 56, lineBreak: false });
                                }
                                // Right col
                                if (rightFields[r]) {
                                        const [key, lbl] = rightFields[r];
                                        fill(doc, COL2 - 2, rowY, HALF + 2, IFR - 1, r % 2 === 0 ? BG1 : BG2);
                                        doc.fillColor(SUB).font('Helvetica-Bold').fontSize(8)
                                           .text(lbl, COL2, rowY + 3, { width: 52, lineBreak: false });
                                        doc.fillColor(TEXT).font('Helvetica').fontSize(8)
                                           .text(safe(info[key], 36), COL2 + 54, rowY + 3, { width: HALF - 56, lineBreak: false });
                                }
                        }
                        curY += rows * IFR + 5;

                        // ── Download section — fills rest of page
                        fill(doc, ML, curY, CW, 15, DARK);
                        doc.fillColor(RED).font('Helvetica-Bold').fontSize(9)
                           .text('DOWNLOAD LINKS', ML + 5, curY + 3, { width: CW, lineBreak: false });
                        curY += 17;

                        const MAX_Y = PH - 22;

                        groups.forEach((group, gi) => {
                                if (curY > MAX_Y - 14) return;

                                const gLabel = safe((group.groupTitle || '')
                                        .replace(/Download\s+/i, '')
                                        .replace(/\s*Batch\s+Subtitle\s+Indonesia\s*/gi, '')
                                        .replace(/\s*Subtitle\s+Indonesia\s*/gi, '')
                                        .trim(), 68);

                                fill(doc, ML, curY, CW, 14, gi % 2 === 0 ? '#ececec' : '#e4e4e4');
                                doc.fillColor(DARK).font('Helvetica-Bold').fontSize(8)
                                   .text('>> ' + gLabel, ML + 4, curY + 3, { width: CW - 8, lineBreak: false });
                                curY += 15;

                                Object.entries(group.resolutions || {}).forEach(([res, links]) => {
                                        if (curY > MAX_Y - 12 || !links?.length) return;

                                        fill(doc, ML, curY - 1, 34, 13, DARK);
                                        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(7)
                                           .text(res, ML, curY + 1, { width: 34, align: 'center', lineBreak: false });

                                        let lx = ML + 38;
                                        doc.font('Helvetica').fontSize(8.5);
                                        links.slice(0, 8).forEach((lnk, li) => {
                                                if (lx > PW - MR - 20) return;
                                                const lbl = safe(lnk.label || 'Link');
                                                const lw  = doc.widthOfString(lbl) + 1;
                                                doc.fillColor(BLUE)
                                                   .text(lbl, lx, curY + 1, {
                                                           link: lnk.url,
                                                           underline: true,
                                                           width: lw,
                                                           lineBreak: false,
                                                   });
                                                lx += lw + 1;
                                                if (li < links.length - 1 && lx < PW - MR - 32) {
                                                        doc.fillColor(LGRAY)
                                                           .text('  |  ', lx, curY + 1, { width: 14, lineBreak: false });
                                                        lx += 14;
                                                }
                                        });
                                        curY += 14;
                                });
                                curY += 2;
                        });

                        // ── Footer bar
                        fill(doc, 0, PH - 20, PW, 20, DARK);
                        doc.fillColor(LGRAY).font('Helvetica').fontSize(7.5)
                           .text('Wily Bot  |  kusonime.com  |  ' + label + ' ' + year +
                                  '  |  ' + num + ' / ' + valid.length,
                                  0, PH - 13, { width: PW, align: 'center', lineBreak: false });
                });

                doc.end();
        });
}

function noBanner(doc, x, y, w, h) {
        fill(doc, x, y, w, h, '#dddddd');
        doc.fillColor(GRAY).font('Helvetica').fontSize(10)
           .text('No Image', x, y + h / 2 - 6, { width: w, align: 'center', lineBreak: false });
}

module.exports = { generateSeasonPdf };
