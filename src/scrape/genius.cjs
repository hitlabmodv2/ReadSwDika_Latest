'use strict';

const axios = require('axios');

class Genius {
  constructor() {
    this.inst = axios.create({
      baseURL: 'https://api.genius.com',
      timeout: 15000,
      headers: {
        'user-agent': 'Genius/8.0.5.4987 (Android; Android 10; samsung SM-J700F)',
        'x-genius-app-background-request': '0',
        'x-genius-logged-out': 'true',
        'x-genius-android-version': '8.0.5.4987',
        'accept': 'application/json'
      }
    });
  }

  async search(query) {
    if (!query || !String(query).trim()) throw new Error('Query lagu diperlukan.');

    try {
      const { data } = await this.inst.get('/search/multi', {
        params: { q: String(query).trim() }
      });

      const section = data?.response?.sections?.find(item => item.type === 'song');
      const hits = Array.isArray(section?.hits) ? section.hits : [];
      return hits.map(hit => normalizeSong(hit.result || hit)).filter(Boolean);
    } catch (error) {
      throw new Error(`Gagal mencari lagu: ${error.message}`);
    }
  }

  async detail(id) {
    if (!id || isNaN(Number(id))) throw new Error('Song ID diperlukan.');

    try {
      const { data } = await this.inst.get(`/songs/${id}`);
      const song = data?.response?.song;
      if (!song) throw new Error('Data lagu tidak ditemukan.');
      return normalizeSong(song, true);
    } catch (error) {
      throw new Error(`Gagal mengambil detail lagu: ${error.message}`);
    }
  }
}

function cleanText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeSong(song, detailed = false) {
  if (!song) return null;

  const artist = song.primary_artist || {};
  const album = song.album || {};
  const releaseDate = song.release_date_for_display || song.release_date || '';
  const data = {
    id: song.id,
    title: cleanText(song.full_title || song.title_with_featured || song.title || '-'),
    songTitle: cleanText(song.title || '-'),
    artist: cleanText(artist.name || '-'),
    artistUrl: artist.url || '',
    url: song.url || '',
    thumbnail: song.song_art_image_thumbnail_url || song.header_image_thumbnail_url || '',
    image: song.song_art_image_url || song.header_image_url || '',
    releaseDate: cleanText(releaseDate || '-')
  };

  if (detailed) {
    data.album = cleanText(album.name || '-');
    data.description = cleanText(song.description_preview || '');
    data.stats = {
      views: song.stats?.pageviews || 0,
      annotations: song.annotation_count || 0,
      pyongs: song.pyongs_count || 0
    };
    data.featuredArtists = Array.isArray(song.featured_artists)
      ? song.featured_artists.map(item => item.name).filter(Boolean).join(', ')
      : '';
    data.producerArtists = Array.isArray(song.producer_artists)
      ? song.producer_artists.map(item => item.name).filter(Boolean).join(', ')
      : '';
    data.writerArtists = Array.isArray(song.writer_artists)
      ? song.writer_artists.map(item => item.name).filter(Boolean).join(', ')
      : '';
  }

  return data;
}

function formatNumber(num) {
  const n = Number(num || 0);
  if (!n) return '-';
  return n.toLocaleString('id-ID');
}

function formatGeniusSearch(results, query, prefix = '.') {
  if (!Array.isArray(results) || !results.length) {
    return `❌ Lagu *${query}* tidak ditemukan.`;
  }

  let text = `╭─「 🎵 *GENIUS SEARCH* 」\n`;
  text += `│ Query: *${query}*\n`;
  text += `│ Hasil: *${results.length} lagu*\n`;
  text += `╰────────────────────\n\n`;

  results.slice(0, 7).forEach((song, index) => {
    text += `${index + 1}. *${song.songTitle}*\n`;
    text += `   Artis: ${song.artist}\n`;
    text += `   ID: ${song.id}\n`;
    if (song.releaseDate && song.releaseDate !== '-') text += `   Rilis: ${song.releaseDate}\n`;
    text += `   Detail: ${prefix}geniusdetail ${song.id}\n`;
    if (song.url) text += `   Link: ${song.url}\n`;
    text += `\n`;
  });

  return text.trimEnd();
}

function formatGeniusDetail(song) {
  if (!song) return 'Data lagu kosong.';

  let text = `╭─「 🎼 *GENIUS DETAIL* 」\n`;
  text += `│ ID: *${song.id}*\n`;
  text += `╰────────────────────\n\n`;
  text += `🎵 *Judul:* ${song.songTitle}\n`;
  text += `👤 *Artis:* ${song.artist}\n`;
  if (song.featuredArtists) text += `🤝 *Featuring:* ${song.featuredArtists}\n`;
  if (song.album && song.album !== '-') text += `💿 *Album:* ${song.album}\n`;
  if (song.releaseDate && song.releaseDate !== '-') text += `📅 *Rilis:* ${song.releaseDate}\n`;
  if (song.producerArtists) text += `🎛️ *Producer:* ${song.producerArtists}\n`;
  if (song.writerArtists) text += `✍️ *Writer:* ${song.writerArtists}\n`;
  if (song.stats) {
    text += `\n📊 *Statistik*\n`;
    text += `▸ Views: ${formatNumber(song.stats.views)}\n`;
    text += `▸ Anotasi: ${formatNumber(song.stats.annotations)}\n`;
    text += `▸ Pyongs: ${formatNumber(song.stats.pyongs)}\n`;
  }
  if (song.description) text += `\n📝 *Deskripsi:* ${song.description.slice(0, 500)}\n`;
  if (song.url) text += `\n🔗 *Genius:* ${song.url}`;

  return text.trimEnd();
}

module.exports = {
  Genius,
  geniusSearch: query => new Genius().search(query),
  geniusDetail: id => new Genius().detail(id),
  formatGeniusSearch,
  formatGeniusDetail
};