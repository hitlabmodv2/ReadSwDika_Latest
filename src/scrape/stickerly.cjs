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
const axios = require('axios');

const API_BASE = 'https://api.sticker.ly/v4';
const HEADERS = {
  'user-agent': 'androidapp.stickerly/3.17.0 (Redmi Note 4; U; Android 29; in-ID; id;)',
  'content-type': 'application/json',
  'accept-encoding': 'gzip'
};

function extractPackId(input = '') {
  const value = String(input || '').trim();
  const match = value.match(/(?:sticker\.ly\/s\/|sticker\.ly\/pack\/|\/s\/|\/pack\/)([a-z0-9_-]{4,32})/i);
  if (match) return match[1];
  if (/^[a-z0-9_-]{4,32}$/i.test(value)) return value;
  return null;
}

function resourceUrl(prefix, fileName) {
  if (!prefix || !fileName) return null;
  if (/^https?:\/\//i.test(fileName)) return fileName;
  return `${prefix}${fileName}`;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

class StickerLy {
  async search(query, options = {}) {
    const keyword = String(query || '').trim();
    if (!keyword) throw new Error('Query wajib diisi.');

    const { data } = await axios.post(`${API_BASE}/stickerPack/smartSearch`, {
      keyword,
      enabledKeywordSearch: true,
      filter: {
        extendSearchResult: false,
        sortBy: 'RECOMMENDED',
        languages: ['ALL'],
        minStickerCount: 5,
        searchBy: 'ALL',
        stickerType: 'ALL'
      }
    }, {
      headers: HEADERS,
      timeout: options.timeout || 20000
    });

    const packs = data?.result?.stickerPacks;
    if (!Array.isArray(packs)) return [];

    return packs.slice(0, options.limit || 10).map(pack => {
      const trayIndex = Number.isInteger(pack.trayIndex) ? pack.trayIndex : 0;
      const trayFile = pack.resourceFiles?.[trayIndex] || pack.resourceFiles?.[0] || '';
      return {
        id: pack.packId,
        name: pack.name || 'Tanpa Nama',
        author: pack.authorName || pack.user?.displayName || pack.user?.userName || 'Unknown',
        stickerCount: Array.isArray(pack.resourceFiles) ? pack.resourceFiles.length : normalizeNumber(pack.stickerCount),
        viewCount: normalizeNumber(pack.viewCount),
        exportCount: normalizeNumber(pack.exportCount),
        isPaid: !!pack.isPaid,
        isAnimated: !!(pack.isAnimated || pack.animated),
        thumbnailUrl: resourceUrl(pack.resourceUrlPrefix, trayFile),
        url: pack.shareUrl || (pack.packId ? `https://sticker.ly/s/${pack.packId}` : null)
      };
    }).filter(pack => pack.id || pack.url);
  }

  async detail(input, options = {}) {
    const packId = extractPackId(input);
    if (!packId) throw new Error('URL atau ID Stickerly tidak valid.');

    const { data } = await axios.get(`${API_BASE}/stickerPack/${packId}?needRelation=true`, {
      headers: HEADERS,
      timeout: options.timeout || 20000
    });

    const result = data?.result;
    if (!result) throw new Error('Sticker pack tidak ditemukan.');

    const stickers = Array.isArray(result.stickers) ? result.stickers : [];
    const user = result.user || {};
    const trayIndex = Number.isInteger(result.trayIndex) ? result.trayIndex : 0;
    const traySticker = stickers[trayIndex] || stickers[0] || {};

    return {
      id: result.packId || packId,
      name: result.name || 'StickerLy Pack',
      author: {
        name: user.displayName || result.authorName || user.userName || 'Unknown',
        username: user.userName || '',
        bio: user.bio || '',
        followers: normalizeNumber(user.followerCount),
        following: normalizeNumber(user.followingCount),
        isPrivate: !!user.isPrivate,
        avatar: user.profileUrl || '',
        website: user.website || result.website || '',
        url: user.shareUrl || ''
      },
      stickers: stickers.map(sticker => ({
        id: sticker.sid || '',
        fileName: sticker.fileName,
        isAnimated: !!(sticker.isAnimated || sticker.animated || result.isAnimated || result.animated),
        imageUrl: resourceUrl(result.resourceUrlPrefix, sticker.fileName),
        viewCount: normalizeNumber(sticker.viewCount)
      })).filter(sticker => sticker.fileName && sticker.imageUrl),
      stickerCount: stickers.length,
      viewCount: normalizeNumber(result.viewCount),
      exportCount: normalizeNumber(result.exportCount),
      isPaid: !!result.isPaid,
      isAnimated: !!(result.isAnimated || result.animated),
      thumbnailUrl: resourceUrl(result.resourceUrlPrefix, traySticker.fileName),
      trayIconFileName: traySticker.fileName || '',
      resourceZipUrl: resourceUrl(result.resourceUrlPrefix, result.resourceZip),
      resourceUrlPrefix: result.resourceUrlPrefix || '',
      url: result.shareUrl || `https://sticker.ly/s/${packId}`
    };
  }

  async downloadPackZipBuffer(url, options = {}) {
    if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('URL ZIP pack Stickerly tidak valid.');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: options.timeout || 30000,
      headers: {
        'user-agent': HEADERS['user-agent'],
        accept: 'application/zip,application/octet-stream,*/*'
      }
    });
    const buffer = Buffer.from(response.data);
    if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
      throw new Error('File ZIP pack Stickerly tidak valid.');
    }
    return buffer;
  }

  async downloadStickerBuffer(url, options = {}) {
    if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('URL sticker tidak valid.');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: options.timeout || 20000,
      headers: {
        'user-agent': HEADERS['user-agent'],
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    return Buffer.from(response.data);
  }
}

const stickerly = new StickerLy();

module.exports = {
  StickerLy,
  stickerly,
  extractPackId,
  search: (...args) => stickerly.search(...args),
  detail: (...args) => stickerly.detail(...args),
  downloadPackZipBuffer: (...args) => stickerly.downloadPackZipBuffer(...args),
  downloadStickerBuffer: (...args) => stickerly.downloadStickerBuffer(...args)
};