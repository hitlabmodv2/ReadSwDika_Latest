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

const axios = require('axios');
const cheerio = require('cheerio');

const BASE = 'https://www.gsmarena.com';
const QUICKSEARCH_URL = 'https://www.gsmarena.com/quicksearch-8020.jpg';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': BASE + '/'
};

// Cache quicksearch data (berlaku 30 menit)
let _quickCache = null;
let _quickCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

function cleanText(str = '') {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function normalize(str = '') {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Ambil daftar semua HP dari GSMArena quicksearch API.
 * Tidak perlu BRAND_LIST — semua brand langsung dari server GSMArena.
 * Response: [ brandMap{id->name}, [ [brandId, phoneId, name, keywords, img, short], ... ] ]
 */
async function fetchQuickSearch(query) {
  const now = Date.now();
  // Gunakan cache kalau masih fresh dan tidak ada query spesifik baru
  if (_quickCache && (now - _quickCacheTime) < CACHE_TTL) {
    return _quickCache;
  }

  const { data } = await axios.get(QUICKSEARCH_URL, {
    params: { sSearchStr: 'all', nCount: 9999 },
    headers: HEADERS,
    timeout: 15000
  });

  // data[0] = brand map { id: brandName }
  // data[1] = array of [brandId, phoneId, fullName, keywords, imgFile, shortName]
  const brandMap = data[0] || {};
  const phones = Array.isArray(data[1]) ? data[1] : [];

  _quickCache = { brandMap, phones };
  _quickCacheTime = now;
  return _quickCache;
}

/**
 * Scoring: seberapa relevan sebuah phone dengan query user.
 * Makin tinggi skor = makin cocok.
 */
function scorePhone(phone, queryTerms) {
  const [brandId, phoneId, fullName, keywords, imgFile, shortName] = phone;
  const nameLower = normalize(fullName);
  const keyLower = (keywords || '').toLowerCase();
  const shortLower = normalize(shortName || '');
  const imgLower = (imgFile || '').toLowerCase().replace('.jpg', '').replace(/-/g, ' ');

  const nameTerms = nameLower.split(' ').filter(Boolean);
  let score = 0;
  let matched = 0;

  for (const qt of queryTerms) {
    if (qt.length < 2) continue;

    // Exact match di nama lengkap
    if (nameTerms.includes(qt)) { score += 5; matched++; continue; }

    // Exact match di keywords
    if (keyLower.includes(qt)) { score += 4; matched++; continue; }

    // Partial match di nama
    if (nameLower.includes(qt)) { score += 3; matched++; continue; }

    // Match di shortname
    if (shortLower.includes(qt)) { score += 2; matched++; continue; }

    // Match di image slug (nama file sering = nama HP)
    if (imgLower.includes(qt)) { score += 1; matched++; continue; }
  }

  // Penalti kalau nama HP punya banyak kata yang tidak ada di query
  const extraTerms = nameTerms.filter(nt => !queryTerms.some(qt => nt.includes(qt) || qt.includes(nt)));
  score -= extraTerms.length * 0.2;

  // Bonus kalau semua term query cocok
  if (matched === queryTerms.length) score += 3;

  return score;
}

/**
 * Cari HP terbaik dari quicksearch berdasarkan query.
 * Support semua brand yang ada di GSMArena secara realtime.
 */
async function findPhone(query) {
  const queryTerms = normalize(query).split(' ').filter(t => t.length >= 2);
  if (!queryTerms.length) throw new Error('Query terlalu pendek.');

  const { brandMap, phones } = await fetchQuickSearch(query);

  let bestPhone = null;
  let bestScore = 0;

  for (const phone of phones) {
    const score = scorePhone(phone, queryTerms);
    if (score > bestScore) {
      bestScore = score;
      bestPhone = phone;
    }
  }

  if (!bestPhone || bestScore < 1) return null;

  const [brandId, phoneId, fullName, keywords, imgFile] = bestPhone;
  const slug = (imgFile || '').replace('.jpg', '');
  const url = `${BASE}/${slug}-${phoneId}.php`;
  const brand = brandMap[String(brandId)] || '';

  return { name: fullName, brand, url, score: bestScore };
}

async function fetchPhonePage(url) {
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  return data;
}

function buildHdImageUrl(bigpicUrl) {
  if (!bigpicUrl) return null;
  try {
    const filename = bigpicUrl.split('/').pop().replace('.jpg', '');
    const brand = filename.split('-')[0];
    return `https://fdn2.gsmarena.com/vv/pics/${brand}/${filename}-1.jpg`;
  } catch (_) {
    return null;
  }
}

function extractNum(str) {
  return parseFloat(String(str).replace(/,/g, ''));
}

function extractUsdPrice(priceStr = '') {
  const m = priceStr.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/) ||
            priceStr.match(/([\d,]+(?:\.\d{1,2})?)\s*USD/i);
  return m ? extractNum(m[1]) : null;
}

function extractInrPrice(priceStr = '') {
  const m = priceStr.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/) ||
            priceStr.match(/([\d,]+(?:\.\d{1,2})?)\s*INR/i);
  return m ? extractNum(m[1]) : null;
}

function extractEurPrice(priceStr = '') {
  const m = priceStr.match(/€\s*([\d,]+(?:\.\d{1,2})?)/) ||
            priceStr.match(/([\d,]+(?:\.\d{1,2})?)\s*EUR/i);
  return m ? extractNum(m[1]) : null;
}

function extractGbpPrice(priceStr = '') {
  const m = priceStr.match(/£\s*([\d,]+(?:\.\d{1,2})?)/) ||
            priceStr.match(/([\d,]+(?:\.\d{1,2})?)\s*GBP/i);
  return m ? extractNum(m[1]) : null;
}

const FALLBACK_IDR = 16300;
const FALLBACK_INR = 83.5;
const FALLBACK_EUR = 0.92;
const FALLBACK_GBP = 0.79;

async function getRates() {
  const sources = [
    async () => {
      const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 8000 });
      if (data?.rates?.IDR) return {
        IDR: data.rates.IDR,
        INR: data.rates.INR || FALLBACK_INR,
        EUR: data.rates.EUR || FALLBACK_EUR,
        GBP: data.rates.GBP || FALLBACK_GBP
      };
    },
    async () => {
      const { data } = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 8000 });
      if (data?.rates?.IDR) return {
        IDR: data.rates.IDR,
        INR: data.rates.INR || FALLBACK_INR,
        EUR: data.rates.EUR || FALLBACK_EUR,
        GBP: data.rates.GBP || FALLBACK_GBP
      };
    },
    async () => {
      const { data } = await axios.get('https://api.frankfurter.app/latest?from=USD&to=IDR,INR,EUR,GBP', { timeout: 8000 });
      if (data?.rates?.IDR) return {
        IDR: data.rates.IDR,
        INR: data.rates.INR || FALLBACK_INR,
        EUR: data.rates.EUR || FALLBACK_EUR,
        GBP: data.rates.GBP || FALLBACK_GBP
      };
    },
    async () => {
      const { data } = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', { timeout: 8000 });
      if (data?.usd?.idr) return {
        IDR: data.usd.idr,
        INR: data.usd.inr || FALLBACK_INR,
        EUR: data.usd.eur || FALLBACK_EUR,
        GBP: data.usd.gbp || FALLBACK_GBP
      };
    }
  ];

  for (const src of sources) {
    try {
      const result = await src();
      if (result?.IDR) return result;
    } catch (_) {}
  }

  return { IDR: FALLBACK_IDR, INR: FALLBACK_INR, EUR: FALLBACK_EUR, GBP: FALLBACK_GBP, isFallback: true };
}

function formatRupiah(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

function parsePhonePage(html, sourceUrl) {
  const $ = cheerio.load(html);

  const name = cleanText($('h1.specs-phone-name-title').text()) ||
    cleanText($('h1').first().text());

  const bigpicUrl = $('div.specs-photo-main a img').attr('src') ||
    $('div.specs-photo-main img').attr('src') ||
    '';

  const hdImageUrl = buildHdImageUrl(bigpicUrl);
  const image = hdImageUrl || bigpicUrl;

  const specs = {};

  $('#specs-list table').each((_, table) => {
    const category = cleanText($(table).find('th').first().text());
    if (!category) return;
    specs[category] = {};

    $(table).find('tr').each((_, row) => {
      const label = cleanText($(row).find('td.ttl').text());
      const value = cleanText($(row).find('td.nfo').text());
      if (label && value && value !== '-') {
        specs[category][label] = value;
      }
    });
  });

  const fans = cleanText($('.specs-fans strong').first().text());
  const priceRaw = specs['Misc']?.['Price'] || '';

  return { name, image, bigpicUrl, specs, fans, priceRaw, sourceUrl };
}

async function enrichWithPrice(detail) {
  const { priceRaw } = detail;
  if (!priceRaw) return { ...detail, priceInfo: null };

  const usdPrice = extractUsdPrice(priceRaw);
  const inrPrice = extractInrPrice(priceRaw);
  const eurPrice = extractEurPrice(priceRaw);
  const gbpPrice = extractGbpPrice(priceRaw);

  if (!usdPrice && !inrPrice && !eurPrice && !gbpPrice) {
    return { ...detail, priceInfo: { raw: priceRaw, usd: null, idr: null } };
  }

  const rates = await getRates();
  let idrPrice = null;
  let usdEquiv = usdPrice;
  let currency = 'USD';

  if (usdPrice && rates.IDR) {
    idrPrice = usdPrice * rates.IDR;
    usdEquiv = usdPrice;
    currency = 'USD';
  } else if (inrPrice && rates.INR && rates.IDR) {
    usdEquiv = inrPrice / rates.INR;
    idrPrice = usdEquiv * rates.IDR;
    currency = 'INR';
  } else if (eurPrice && rates.EUR && rates.IDR) {
    usdEquiv = eurPrice / rates.EUR;
    idrPrice = usdEquiv * rates.IDR;
    currency = 'EUR';
  } else if (gbpPrice && rates.GBP && rates.IDR) {
    usdEquiv = gbpPrice / rates.GBP;
    idrPrice = usdEquiv * rates.IDR;
    currency = 'GBP';
  }

  return {
    ...detail,
    priceInfo: {
      raw: priceRaw,
      usd: usdEquiv ? Math.round(usdEquiv * 100) / 100 : null,
      idr: idrPrice,
      rate: rates.IDR ? Math.round(rates.IDR) : null,
      fromInr: !usdPrice && !!inrPrice,
      currency,
      rateFallback: !!rates.isFallback
    }
  };
}

async function cekHP(query) {
  if (!query || !query.trim()) throw new Error('Nama HP tidak boleh kosong.');
  const q = query.trim();

  const match = await findPhone(q);
  if (!match) {
    throw new Error(
      `HP "${q}" tidak ditemukan di database GSMArena.\n` +
      `Coba tulis nama lebih lengkap, contoh:\n` +
      `• Samsung Galaxy A55\n• iPhone 16 Pro Max\n• Redmi Note 13 Pro\n• Vivo V40`
    );
  }

  const html = await fetchPhonePage(match.url);
  const detail = parsePhonePage(html, match.url);

  if (!detail.name || !Object.keys(detail.specs).length) {
    throw new Error(`Gagal membaca data spesifikasi untuk "${q}".`);
  }

  const enriched = await enrichWithPrice(detail);
  return enriched;
}

async function getHPImage(imageUrl, bigpicUrl) {
  const tryUrls = [];
  if (imageUrl) tryUrls.push(imageUrl);
  if (bigpicUrl && bigpicUrl !== imageUrl) tryUrls.push(bigpicUrl);

  for (const url of tryUrls) {
    try {
      const res = await axios.get(url, {
        headers: { ...HEADERS, Accept: 'image/*,*/*' },
        responseType: 'arraybuffer',
        timeout: 12000
      });
      const buf = Buffer.from(res.data);
      if (buf.length > 2000) return buf;
    } catch (_) {}
  }
  return null;
}

function formatHPSpecs(data) {
  const { name, specs, fans, sourceUrl, priceInfo } = data;

  const wantedCategories = [
    'Network', 'Launch', 'Body', 'Display', 'Platform',
    'Memory', 'Main Camera', 'Selfie camera', 'Sound',
    'Comms', 'Features', 'Battery', 'Misc', 'Our Tests'
  ];

  const categoryEmoji = {
    'Network': '📡',
    'Launch': '🚀',
    'Body': '📐',
    'Display': '🖥️',
    'Platform': '⚙️',
    'Memory': '💾',
    'Main Camera': '📷',
    'Selfie camera': '🤳',
    'Sound': '🔊',
    'Comms': '📶',
    'Features': '✨',
    'Battery': '🔋',
    'Misc': '📋',
    'Our Tests': '🧪'
  };

  const keySpecs = [
    { cat: 'Display', key: 'Size', label: 'Layar' },
    { cat: 'Platform', key: 'OS', label: 'OS' },
    { cat: 'Platform', key: 'Chipset', label: 'Chipset' },
    { cat: 'Platform', key: 'CPU', label: 'CPU' },
    { cat: 'Platform', key: 'GPU', label: 'GPU' },
    { cat: 'Memory', key: 'Internal', label: 'Storage/RAM' },
    { cat: 'Main Camera', key: 'Triple', label: 'Kamera Utama' },
    { cat: 'Main Camera', key: 'Dual', label: 'Kamera Utama' },
    { cat: 'Main Camera', key: 'Single', label: 'Kamera Utama' },
    { cat: 'Main Camera', key: 'Quad', label: 'Kamera Utama' },
    { cat: 'Selfie camera', key: 'Single', label: 'Kamera Depan' },
    { cat: 'Selfie camera', key: 'Dual', label: 'Kamera Depan' },
    { cat: 'Battery', key: 'Type', label: 'Baterai' },
    { cat: 'Battery', key: 'Charging', label: 'Charging' },
    { cat: 'Body', key: 'Dimensions', label: 'Dimensi' },
    { cat: 'Body', key: 'Weight', label: 'Berat' },
    { cat: 'Launch', key: 'Announced', label: 'Rilis' }
  ];

  const highlights = [];
  const usedLabels = new Set();
  for (const ks of keySpecs) {
    if (usedLabels.has(ks.label)) continue;
    const catData = specs[ks.cat];
    if (!catData) continue;
    const val = catData[ks.key];
    if (val && val !== '-') {
      const short = val.split('\n')[0].trim().split('(')[0].trim().slice(0, 80);
      if (short.length > 1) {
        highlights.push(`▸ *${ks.label}:* ${short}`);
        usedLabels.add(ks.label);
      }
    }
  }

  let body = `📱 *INFO HP REALTIME*\n\n`;
  body += `📱 *${name}*\n`;
  if (fans) body += `❤️ Fans: ${fans}\n`;
  body += `\n`;

  body += `💰 *HARGA*\n`;
  if (priceInfo) {
    if (priceInfo.raw) {
      body += `▸ *Global:* ${priceInfo.raw.slice(0, 80)}\n`;
    }
    if (priceInfo.idr) {
      const rateLabel = priceInfo.rateFallback ? '(kurs fallback)' : '(kurs realtime)';
      body += `▸ *🇮🇩 Konversi IDR:* ${formatRupiah(priceInfo.idr)} ${rateLabel}\n`;
    }
  } else {
    body += `▸ Harga tidak tersedia\n`;
  }
  body += `%%AI_PRICE%%\n\n`;

  if (highlights.length) {
    body += `⚡ *Spesifikasi Utama*\n`;
    body += highlights.join('\n') + '\n\n';
  }

  for (const cat of wantedCategories) {
    const catData = specs[cat];
    if (!catData || !Object.keys(catData).length) continue;
    const emoji = categoryEmoji[cat] || '📌';
    body += `${emoji} *${cat}*\n`;
    for (const [label, value] of Object.entries(catData)) {
      const cleanVal = value.split('\n').map(l => l.trim()).filter(Boolean).join(' | ').slice(0, 120);
      if (cleanVal && cleanVal !== '-') {
        body += `▸ *${label}:* ${cleanVal}\n`;
      }
    }
    body += `\n`;
  }

  return body.trimEnd();
}

module.exports = { cekHP, getHPImage, formatHPSpecs };
