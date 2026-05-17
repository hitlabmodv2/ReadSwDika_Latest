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

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Shazam } = require('node-shazam');
const axios = require('axios');

const shazam = new Shazam('Asia/Jakarta');
let geminiAuthToken = null;
let geminiTokenExpiry = 0;

function cleanText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function ensureTmpDir() {
  const dir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function extFromMime(mimetype = '') {
  const mime = String(mimetype || '').toLowerCase();
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('video')) return 'mp4';
  return 'bin';
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(cleanText(stderr) || error.message || `${command} gagal.`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function getAudioDuration(inputPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ], { timeout: 15000 });
    const duration = Number.parseFloat(String(stdout || '').trim());
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  } catch (_) {
    return 0;
  }
}

function buildRecognitionWindows(duration = 0) {
  if (!duration || duration <= 35) return [{ start: 0, duration: Math.min(30, Math.max(18, duration || 25)) }];

  const points = [
    0,
    Math.max(0, duration * 0.16),
    Math.max(0, duration * 0.34),
    Math.max(0, duration * 0.52),
    Math.max(0, duration * 0.70),
    Math.max(0, duration - 34)
  ];

  const windows = [];
  for (const point of points) {
    const start = Math.floor(point);
    if (windows.some(item => Math.abs(item.start - start) < 7)) continue;
    windows.push({ start, duration: 30 });
    if (windows.length >= 5) break;
  }
  return windows.length ? windows : [{ start: 0, duration: 30 }];
}

function runFfmpeg(inputPath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const start = Math.max(0, Number(options.start || 0));
    const duration = Math.max(12, Math.min(35, Number(options.duration || 30)));
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      ...(start > 0 ? ['-ss', String(start)] : []),
      '-i', inputPath,
      '-t', String(duration),
      '-vn',
      '-ac', '1',
      '-ar', '44100',
      '-b:a', '128k',
      '-af', 'highpass=f=70,lowpass=f=15000,dynaudnorm=f=75:g=15,volume=1.7',
      outputPath
    ];

    execFile('ffmpeg', args, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(cleanText(stderr) || error.message || 'Konversi audio gagal.'));
        return;
      }
      resolve();
    });
  });
}

function withTimeout(promise, ms, label = 'Proses terlalu lama') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function getGeminiAuthToken() {
  if (geminiAuthToken && Date.now() < geminiTokenExpiry - 300000) return geminiAuthToken;

  const { data } = await axios.post(
    'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyAxof8_SbpDcww38NEQRhNh0Pzvbphh-IQ',
    { clientType: 'CLIENT_TYPE_ANDROID' },
    {
      headers: {
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
      },
      timeout: 20000
    }
  );

  if (!data.idToken) throw new Error('Token AI kosong.');
  geminiAuthToken = data.idToken;
  geminiTokenExpiry = Date.now() + 3600 * 1000;
  return geminiAuthToken;
}

function extractJsonObject(text = '') {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : raw;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function normalizeGeminiResult(parsed = {}, rawText = '', sample = {}) {
  const title = cleanText(parsed.title || parsed.judul || '');
  const artist = cleanText(parsed.artist || parsed.artis || parsed.singer || '');
  const confidenceNumber = Number(parsed.confidence || parsed.akurasi || 0);
  const rejected = parsed.detected === false || /^(unknown|tidak diketahui|tidak terdeteksi)$/i.test(title);

  if (rejected || !title || title.length < 2 || confidenceNumber < 0.42) return null;

  return {
    id: '',
    title,
    artist: artist || '-',
    subtitle: artist || '',
    album: cleanText(parsed.album || '-'),
    released: cleanText(parsed.released || parsed.rilis || '-'),
    genre: cleanText(parsed.genre || '-'),
    label: '-',
    writer: '-',
    composer: '-',
    producer: '-',
    cover: '',
    coverHigh: '',
    links: {
      shazam: '',
      appleMusic: '',
      youtube: '',
      spotify: ''
    },
    source: 'gemini-audio',
    confidence: confidenceNumber >= 0.7 ? 'sedang-tinggi' : 'perkiraan AI',
    sample,
    raw: { parsed, text: rawText }
  };
}

async function recognizeWithGeminiAudio(audioPath, sample = {}, options = {}) {
  const buffer = fs.readFileSync(audioPath);
  if (!buffer.length || buffer.length > 18 * 1024 * 1024) return null;

  const authToken = await getGeminiAuthToken();
  const prompt = [
    'Dengarkan audio ini dan identifikasi lagu seakurat mungkin.',
    'Jika audio bukan musik jelas, terlalu noise, atau kamu tidak yakin, isi detected false.',
    'Balas hanya JSON valid tanpa markdown dengan format:',
    '{"detected":true,"title":"judul lagu","artist":"artis","album":"","released":"","genre":"","confidence":0.0}',
    'confidence harus angka 0 sampai 1. Jangan mengarang jika tidak yakin.'
  ].join('\n');

  const { data } = await axios.post(
    'https://asia-northeast3-gemmy-ai-bdc03.cloudfunctions.net/gemini',
    {
      model: options.aiModel || 'gemini-flash-latest',
      stream: false,
      request: {
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/mpeg',
                data: buffer.toString('base64')
              }
            },
            { text: prompt }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.1
        }
      }
    },
    {
      headers: {
        'accept-encoding': 'gzip',
        'authorization': `Bearer ${authToken}`,
        'content-type': 'application/json; charset=UTF-8',
        'user-agent': 'okhttp/5.3.2',
      },
      timeout: options.aiTimeout || 35000
    }
  );

  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
  const parsed = extractJsonObject(text);
  if (!parsed) return null;
  return normalizeGeminiResult(parsed, text, sample);
}

function readMetadata(track = {}) {
  const sections = Array.isArray(track.sections) ? track.sections : [];
  const songSection = sections.find(item => item.type === 'SONG') || {};
  const metadata = Array.isArray(songSection.metadata) ? songSection.metadata : [];
  const get = (...names) => {
    const wanted = names.map(name => name.toLowerCase());
    const item = metadata.find(meta => wanted.includes(String(meta.title || '').toLowerCase()));
    return cleanText(item?.text || '');
  };

  return {
    album: get('Album'),
    released: get('Released', 'Release Date'),
    genre: get('Genre') || cleanText(track.genres?.primary || ''),
    label: get('Label'),
    writer: get('Writer', 'Writers'),
    composer: get('Composer'),
    producer: get('Producer', 'Producers')
  };
}

function extractLinks(track = {}) {
  const links = {
    shazam: track.url || '',
    appleMusic: '',
    youtube: '',
    spotify: ''
  };

  const actions = [];
  if (Array.isArray(track.hub?.actions)) actions.push(...track.hub.actions);
  if (Array.isArray(track.sections)) {
    for (const section of track.sections) {
      if (Array.isArray(section?.youtubeurl?.actions)) actions.push(...section.youtubeurl.actions);
      if (Array.isArray(section?.actions)) actions.push(...section.actions);
    }
  }

  for (const action of actions) {
    const uri = action?.uri || action?.share?.href || '';
    const type = String(action?.type || '').toLowerCase();
    if (!uri) continue;
    if (!links.appleMusic && (type.includes('apple') || uri.includes('music.apple.com'))) links.appleMusic = uri;
    if (!links.youtube && (type.includes('youtube') || uri.includes('youtube.com') || uri.includes('youtu.be'))) links.youtube = uri;
    if (!links.spotify && uri.includes('spotify.com')) links.spotify = uri;
  }

  return links;
}

function normalizeResult(raw = {}) {
  if (!raw) return null;
  const track = raw.track || raw;
  if (!track || !track.title) return null;

  const meta = readMetadata(track);
  return {
    id: track.key || track.id || '',
    title: cleanText(track.title || '-'),
    artist: cleanText(track.subtitle || '-'),
    subtitle: cleanText(track.subtitle || ''),
    album: meta.album || '-',
    released: meta.released || '-',
    genre: meta.genre || '-',
    label: meta.label || '-',
    writer: meta.writer || '-',
    composer: meta.composer || '-',
    producer: meta.producer || '-',
    cover: track.images?.coverart || track.images?.background || track.images?.coverarthq || '',
    coverHigh: track.images?.coverarthq || track.images?.coverart || track.images?.background || '',
    links: extractLinks(track),
    source: 'shazam',
    confidence: 'tinggi',
    raw
  };
}

function normalizeYoutubeFallback(meta = {}, url = '') {
  const title = cleanText(meta.track || meta.title || '');
  if (!title) return null;
  const artist = cleanText(meta.artist || meta.creator || meta.uploader || meta.channel || '-');
  const releaseDate = String(meta.release_date || meta.upload_date || '');
  const released = releaseDate.length === 8
    ? `${releaseDate.slice(0, 4)}-${releaseDate.slice(4, 6)}-${releaseDate.slice(6, 8)}`
    : cleanText(releaseDate);

  return {
    id: meta.id || '',
    title,
    artist,
    subtitle: artist,
    album: cleanText(meta.album || '-'),
    released: released || '-',
    genre: cleanText(Array.isArray(meta.categories) ? meta.categories[0] : meta.genre || '-'),
    label: '-',
    writer: '-',
    composer: '-',
    producer: '-',
    cover: meta.thumbnail || '',
    coverHigh: meta.thumbnail || '',
    links: {
      shazam: '',
      appleMusic: '',
      youtube: url || meta.webpage_url || '',
      spotify: ''
    },
    source: 'youtube-metadata',
    confidence: 'perkiraan',
    raw: meta
  };
}

function videoIdFromUrl(url = '') {
  const text = String(url || '');
  const match = text.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{6,})/i);
  return match ? match[1] : '';
}

function buildYoutubeThumbnail(video = {}) {
  const direct = video.thumbnail || video.image || '';
  const id = video.videoId || videoIdFromUrl(video.url);
  if (direct && /hq720|maxresdefault|sddefault|hqdefault/i.test(direct)) return direct;
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return direct;
}

function isBadSongVideo(video = {}) {
  const title = String(video.title || '').toLowerCase();
  return /\b(karaoke|instrumental|lyrics only|reaction|cover by|tutorial|lesson|remix|sped up|slowed|nightcore)\b/i.test(title);
}

function scoreSongVideo(video = {}, result = {}) {
  const title = String(video.title || '').toLowerCase();
  const author = String(video.author?.name || video.author || '').toLowerCase();
  const songTitle = String(result.title || '').toLowerCase();
  const artist = String(result.artist || '').toLowerCase();
  let score = 0;

  if (songTitle && title.includes(songTitle)) score += 8;
  if (artist && (title.includes(artist) || author.includes(artist))) score += 6;
  if (/\b(official|audio|video|provided to youtube|topic|vevo)\b/i.test(title + ' ' + author)) score += 4;
  if (isBadSongVideo(video)) score -= 6;
  if (video.seconds && video.seconds >= 90 && video.seconds <= 600) score += 2;
  if (video.views) score += Math.min(3, Math.log10(Math.max(1, Number(video.views))) / 3);
  return score;
}

async function findRealtimeYoutubeSong(result = {}) {
  const title = cleanText(result.title || '');
  const artist = cleanText(result.artist || '');
  if (!title || !artist || artist === '-') return null;

  const queries = [
    `${artist} ${title} official audio`,
    `${artist} ${title} official video`,
    `${artist} ${title}`,
    `${title} ${artist} ${result.album && result.album !== '-' ? result.album : ''}`.trim()
  ];

  let yts = null;
  try {
    const mod = await import('yt-search');
    yts = mod.default || mod;
  } catch (_) {
    return null;
  }

  let best = null;
  let bestScore = -Infinity;
  let bestQuery = '';

  for (const query of [...new Set(queries)]) {
    try {
      const search = await yts(query);
      const videos = Array.isArray(search?.videos) ? search.videos.slice(0, 8) : [];
      for (const video of videos) {
        if (!video?.url || !video?.title) continue;
        const score = scoreSongVideo(video, result);
        if (score > bestScore) {
          best = video;
          bestScore = score;
          bestQuery = query;
        }
      }
      if (bestScore >= 14) break;
    } catch (_) {}
  }

  if (!best || bestScore < 5) return null;
  return {
    title: cleanText(best.title || ''),
    channel: cleanText(best.author?.name || best.author || ''),
    url: best.url,
    thumbnail: buildYoutubeThumbnail(best),
    duration: best.seconds || 0,
    timestamp: best.timestamp || '',
    views: best.views || 0,
    realtime: true,
    searchQuery: bestQuery,
    score: bestScore
  };
}

async function enrichWithRealtimeYoutube(result = {}, options = {}) {
  if (!result || !result.title || options.useYoutubeEnrichment === false) return result;
  const needsYoutube = !result.links?.youtube;
  const needsCover = !result.coverHigh && !result.cover;
  if (!needsYoutube && !needsCover && result.youtube?.title) return result;

  const video = await findRealtimeYoutubeSong(result);
  if (!video) return result;

  result.links = {
    shazam: result.links?.shazam || '',
    appleMusic: result.links?.appleMusic || '',
    youtube: result.links?.youtube || video.url,
    spotify: result.links?.spotify || ''
  };
  if (!result.cover) result.cover = video.thumbnail;
  if (!result.coverHigh) result.coverHigh = video.thumbnail;
  result.youtube = {
    ...(result.youtube || {}),
    title: result.youtube?.title || video.title,
    channel: result.youtube?.channel || video.channel,
    duration: result.youtube?.duration || video.duration,
    timestamp: video.timestamp,
    views: video.views,
    realtime: true,
    searchQuery: video.searchQuery
  };
  return result;
}

function isYoutubeUrl(text = '') {
  return /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)[\w-]{6,}/i.test(String(text || ''));
}

function extractYoutubeUrl(text = '') {
  const match = String(text || '').match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/[^\s]+|youtu\.be\/[^\s]+)/i);
  return match ? match[0].replace(/[)\]}.,]+$/, '') : '';
}

function ensureYtdlpPath(customPath = '') {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const localPath = path.join(process.cwd(), 'bin', 'yt-dlp');
  if (fs.existsSync(localPath)) return localPath;
  return 'yt-dlp';
}

async function getYoutubeMetadata(url, ytdlpPath) {
  const { stdout } = await execFileAsync(ytdlpPath, [
    '--js-runtimes', 'node',
    '--no-playlist',
    '--dump-json',
    url
  ], { timeout: 45000, maxBuffer: 5 * 1024 * 1024 });
  return JSON.parse(String(stdout || '').trim());
}

async function downloadYoutubeSample(url, ytdlpPath, outputBase, start = 0, duration = 35) {
  const template = `${outputBase}.%(ext)s`;
  const dir = path.dirname(outputBase);
  const before = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  await execFileAsync(ytdlpPath, [
    '--js-runtimes', 'node',
    '--no-playlist',
    '--force-overwrites',
    '--download-sections', `*${Math.max(0, Math.floor(start))}-${Math.max(1, Math.floor(start + duration))}`,
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '5',
    '-o', template,
    url
  ], { timeout: 120000, maxBuffer: 2 * 1024 * 1024 });

  const base = path.basename(outputBase);
  const created = fs.readdirSync(dir)
    .filter(name => name.startsWith(base) && !before.has(name))
    .map(name => path.join(dir, name));
  const mp3 = `${outputBase}.mp3`;
  if (fs.existsSync(mp3)) return mp3;
  return created.find(file => /\.(mp3|m4a|webm|opus|ogg|wav)$/i.test(file)) || created[0] || '';
}

async function downloadYoutubeAudioFile(url, ytdlpPath, outputBase) {
  const template = `${outputBase}.%(ext)s`;
  const dir = path.dirname(outputBase);
  const before = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  await execFileAsync(ytdlpPath, [
    '--js-runtimes', 'node',
    '--no-playlist',
    '--force-overwrites',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '5',
    '-o', template,
    url
  ], { timeout: 180000, maxBuffer: 2 * 1024 * 1024 });

  const base = path.basename(outputBase);
  const created = fs.readdirSync(dir)
    .filter(name => name.startsWith(base) && !before.has(name))
    .map(name => path.join(dir, name));
  const mp3 = `${outputBase}.mp3`;
  if (fs.existsSync(mp3)) return mp3;
  return created.find(file => /\.(mp3|m4a|webm|opus|ogg|wav)$/i.test(file)) || created[0] || '';
}

async function convertToVoiceNote(inputPath, outputPath, maxDuration = 600) {
  await execFileAsync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', inputPath,
    '-t', String(Math.max(30, Math.min(900, Number(maxDuration || 600)))),
    '-vn',
    '-ac', '1',
    '-ar', '48000',
    '-c:a', 'libopus',
    '-b:a', '48k',
    '-vbr', 'on',
    '-compression_level', '10',
    outputPath
  ], { timeout: 120000, maxBuffer: 1024 * 1024 });
}

async function downloadWhatsMusicVoiceNote(youtubeUrl, options = {}) {
  const cleanUrl = extractYoutubeUrl(youtubeUrl) || youtubeUrl;
  if (!isYoutubeUrl(cleanUrl)) throw new Error('URL YouTube untuk audio tidak valid.');

  const tmpDir = ensureTmpDir();
  const ytdlpPath = ensureYtdlpPath(options.ytdlpPath);
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const base = path.join(tmpDir, `whatsmusik_vn_${id}`);
  const outputPath = `${base}.ogg`;
  const files = [outputPath];

  try {
    const meta = await getYoutubeMetadata(cleanUrl, ytdlpPath);
    const duration = Number(meta.duration || 0);
    const maxDuration = Number(options.maxDuration || 600);
    if (duration && duration > maxDuration) {
      throw new Error(`Durasi lagu terlalu panjang (${Math.ceil(duration / 60)} menit). Maksimal ${Math.ceil(maxDuration / 60)} menit.`);
    }

    const audioPath = await downloadYoutubeAudioFile(cleanUrl, ytdlpPath, base);
    if (!audioPath || !fs.existsSync(audioPath)) throw new Error('Audio YouTube gagal diunduh.');
    files.push(audioPath);

    await convertToVoiceNote(audioPath, outputPath, maxDuration);
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
      throw new Error('Konversi voice note gagal.');
    }

    const buffer = fs.readFileSync(outputPath);
    return {
      buffer,
      mimetype: 'audio/ogg; codecs=opus',
      fileName: `${cleanText(meta.title || 'whatsmusik').replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'whatsmusik'}.ogg`,
      title: cleanText(meta.title || ''),
      url: cleanUrl,
      duration
    };
  } finally {
    for (const file of files) {
      try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
    }
  }
}

async function recognizeAudioFile(inputPath, options = {}) {
  const tmpDir = ensureTmpDir();
  const duration = await getAudioDuration(inputPath);
  const windows = buildRecognitionWindows(duration);
  const languages = [...new Set([options.language || 'id-ID', 'en-US'])];
  let lastError = null;
  const created = [];

  for (let i = 0; i < windows.length; i++) {
    const window = windows[i];
    const outputPath = path.join(tmpDir, `whatsmusik_norm_${Date.now()}_${Math.random().toString(16).slice(2)}_${i}.mp3`);
    created.push(outputPath);
    try {
      await runFfmpeg(inputPath, outputPath, window);

      for (const language of languages) {
        try {
          const raw = await withTimeout(
            shazam.recognise(outputPath, language),
            options.timeout || 60000,
            'Pengenalan lagu terlalu lama. Coba audio yang lebih jelas/panjang.'
          );
          const normalized = normalizeResult(raw);
          if (normalized) {
            normalized.sample = {
              start: window.start,
              duration: window.duration,
              audioDuration: duration || undefined
            };
            return { result: normalized, files: created };
          }
        } catch (err) {
          lastError = err;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (options.useAiFallback !== false) {
    for (let i = 0; i < Math.min(created.length, 3); i++) {
      const file = created[i];
      if (!fs.existsSync(file)) continue;
      const window = windows[i] || {};
      try {
        const aiResult = await recognizeWithGeminiAudio(file, {
          start: window.start || 0,
          duration: window.duration || 30,
          audioDuration: duration || undefined
        }, options);
        if (aiResult) return { result: aiResult, files: created };
      } catch (err) {
        lastError = err;
      }
    }
  }

  const error = new Error('Lagu tidak terdeteksi. Coba reply bagian reff/chorus 10-35 detik yang jelas, volume cukup, dan bukan voice noise.');
  error.cause = lastError;
  error.files = created;
  throw error;
}

async function identifyWhatsMusic(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1024) {
    throw new Error('Audio kosong atau terlalu kecil.');
  }

  const tmpDir = ensureTmpDir();
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const inputPath = path.join(tmpDir, `whatsmusik_${id}.${extFromMime(options.mimetype)}`);
  let extraFiles = [];

  try {
    fs.writeFileSync(inputPath, buffer);
    const identified = await recognizeAudioFile(inputPath, options);
    extraFiles = identified.files || [];
    return await enrichWithRealtimeYoutube(identified.result, options);
  } finally {
    for (const file of [inputPath, ...extraFiles]) {
      try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
    }
  }
}

async function identifyWhatsMusicFromYoutube(url, options = {}) {
  if (!isYoutubeUrl(url)) throw new Error('Link YouTube tidak valid.');

  const tmpDir = ensureTmpDir();
  const ytdlpPath = ensureYtdlpPath(options.ytdlpPath);
  const cleanUrl = extractYoutubeUrl(url) || url;
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const downloaded = [];
  let meta = null;

  try {
    meta = await getYoutubeMetadata(cleanUrl, ytdlpPath);
    const duration = Number(meta.duration || 0);
    const windows = buildRecognitionWindows(duration);

    for (let i = 0; i < Math.min(windows.length, 4); i++) {
      const window = windows[i];
      const base = path.join(tmpDir, `whatsmusik_yt_${id}_${i}`);
      let samplePath = '';
      try {
        samplePath = await downloadYoutubeSample(cleanUrl, ytdlpPath, base, window.start, Math.min(35, window.duration + 5));
        if (samplePath) downloaded.push(samplePath);
        if (!samplePath || !fs.existsSync(samplePath)) continue;
        const identified = await recognizeAudioFile(samplePath, options);
        downloaded.push(...(identified.files || []));
        const result = identified.result;
        result.links = {
          ...(result.links || {}),
          youtube: result.links?.youtube || cleanUrl
        };
        if (!result.cover && meta.thumbnail) result.cover = meta.thumbnail;
        if (!result.coverHigh && meta.thumbnail) result.coverHigh = meta.thumbnail;
        result.youtube = {
          title: meta.title || '',
          channel: meta.uploader || meta.channel || '',
          duration,
          realtime: false
        };
        return await enrichWithRealtimeYoutube(result, options);
      } catch (_) {}
    }

    const fallback = normalizeYoutubeFallback(meta, cleanUrl);
    if (fallback) return await enrichWithRealtimeYoutube(fallback, options);
    throw new Error('Detail YouTube tidak bisa dibaca sebagai lagu.');
  } catch (err) {
    const fallback = meta ? normalizeYoutubeFallback(meta, cleanUrl) : null;
    if (fallback) return await enrichWithRealtimeYoutube(fallback, options);
    throw err;
  } finally {
    for (const file of downloaded) {
      try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
    }
  }
}

function formatWhatsMusic(result = {}) {
  if (!result || !result.title) return '❌ Lagu tidak terdeteksi.';

  const sourceLabel = result.source === 'youtube-metadata'
    ? 'Perkiraan dari detail YouTube'
    : result.source === 'gemini-audio'
      ? 'Perkiraan AI dari audio'
      : 'Lagu ditemukan';
  let text = `╭─「 🎧 *WHATSMUSIK* 」\n`;
  text += `│ Status: *${sourceLabel}*\n`;
  if (result.confidence) text += `│ Akurasi: *${result.confidence}*\n`;
  if (result.id) text += `│ Shazam ID: *${result.id}*\n`;
  if (result.sample?.start > 0) text += `│ Sampel: detik *${result.sample.start}-${result.sample.start + result.sample.duration}*\n`;
  text += `╰────────────────────\n\n`;
  text += `🎵 *Judul:* ${result.title}\n`;
  text += `👤 *Artis:* ${result.artist}\n`;
  if (result.album && result.album !== '-') text += `💿 *Album:* ${result.album}\n`;
  if (result.released && result.released !== '-') text += `📅 *Rilis:* ${result.released}\n`;
  if (result.genre && result.genre !== '-') text += `🎼 *Genre:* ${result.genre}\n`;
  if (result.label && result.label !== '-') text += `🏷️ *Label:* ${result.label}\n`;
  if (result.producer && result.producer !== '-') text += `🎛️ *Producer:* ${result.producer}\n`;
  if (result.writer && result.writer !== '-') text += `✍️ *Writer:* ${result.writer}\n`;
  if (result.composer && result.composer !== '-') text += `🎹 *Composer:* ${result.composer}\n`;
  if (result.youtube?.title && result.youtube.title !== result.title) text += `▶️ *Judul YouTube:* ${result.youtube.title}\n`;
  if (result.youtube?.channel) text += `📺 *Channel:* ${result.youtube.channel}\n`;
  if (result.youtube?.realtime) text += `🌐 *Sumber:* YouTube realtime\n`;

  const links = result.links || {};
  const linkLines = [
    links.shazam ? `▸ Shazam: ${links.shazam}` : '',
    links.appleMusic ? `▸ Apple Music: ${links.appleMusic}` : '',
    links.youtube ? `▸ YouTube: ${links.youtube}` : '',
    links.spotify ? `▸ Spotify: ${links.spotify}` : ''
  ].filter(Boolean);

  if (linkLines.length) {
    text += `\n🔗 *Link*\n${linkLines.join('\n')}`;
  }

  if (result.source === 'youtube-metadata') {
    text += `\n\nℹ️ _Catatan: audio YouTube belum match di Shazam, jadi hasil ini diambil dari metadata video._`;
  }
  if (result.source === 'gemini-audio') {
    text += `\n\nℹ️ _Catatan: Shazam belum match, hasil ini adalah tebakan AI dari audio. Cek ulang judul/artisnya jika perlu._`;
  }

  return text.trimEnd();
}

module.exports = {
  identifyWhatsMusic,
  identifyWhatsMusicFromYoutube,
  downloadWhatsMusicVoiceNote,
  formatWhatsMusic,
  isYoutubeUrl,
  extractYoutubeUrl,
  enrichWithRealtimeYoutube
};
