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

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WTTR_URL = 'https://wttr.in';
const USER_AGENT = 'WilyBot/1.0 Weather Scraper contact:6289688206739';

const weatherCodes = {
  0: ['Cerah', '☀️'],
  1: ['Cerah berawan', '🌤️'],
  2: ['Berawan sebagian', '⛅'],
  3: ['Berawan', '☁️'],
  45: ['Berkabut', '🌫️'],
  48: ['Kabut beku', '🌫️'],
  51: ['Gerimis ringan', '🌦️'],
  53: ['Gerimis sedang', '🌦️'],
  55: ['Gerimis lebat', '🌧️'],
  56: ['Gerimis beku ringan', '🌧️'],
  57: ['Gerimis beku lebat', '🌧️'],
  61: ['Hujan ringan', '🌧️'],
  63: ['Hujan sedang', '🌧️'],
  65: ['Hujan lebat', '⛈️'],
  66: ['Hujan beku ringan', '🌧️'],
  67: ['Hujan beku lebat', '⛈️'],
  71: ['Salju ringan', '🌨️'],
  73: ['Salju sedang', '🌨️'],
  75: ['Salju lebat', '❄️'],
  77: ['Butiran salju', '❄️'],
  80: ['Hujan lokal ringan', '🌦️'],
  81: ['Hujan lokal sedang', '🌧️'],
  82: ['Hujan lokal deras', '⛈️'],
  85: ['Hujan salju ringan', '🌨️'],
  86: ['Hujan salju lebat', '❄️'],
  95: ['Badai petir', '⛈️'],
  96: ['Badai petir dengan es ringan', '⛈️'],
  99: ['Badai petir dengan es lebat', '⛈️']
};

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value = '') {
  return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatNumber(value, suffix = '', digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number.toLocaleString('id-ID', { maximumFractionDigits: digits })}${suffix}`;
}

function formatTime(value = '') {
  if (!value) return '-';
  const parts = String(value).split('T');
  return parts[1] || parts[0] || '-';
}

function getDayPeriod(value = '') {
  const time = formatTime(value);
  const hour = Number(String(time).split(':')[0]);
  if (!Number.isFinite(hour)) return 'Realtime';
  if (hour >= 4 && hour < 11) return 'Pagi';
  if (hour >= 11 && hour < 15) return 'Siang';
  if (hour >= 15 && hour < 18) return 'Sore';
  return 'Malam';
}

function weatherInfo(code) {
  return weatherCodes[Number(code)] || ['Tidak diketahui', '🌡️'];
}

function windDirection(degrees) {
  const value = Number(degrees);
  if (!Number.isFinite(value)) return '-';
  const directions = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  return directions[Math.round(value / 45) % 8];
}

function windDirectionArrow(degrees) {
  const value = Number(degrees);
  if (!Number.isFinite(value)) return '';
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[Math.round(value / 45) % 8];
}

function uvLevel(uv) {
  const v = Number(uv);
  if (!Number.isFinite(v)) return '-';
  if (v < 3) return 'Rendah 🟢';
  if (v < 6) return 'Sedang 🟡';
  if (v < 8) return 'Tinggi 🟠';
  if (v < 11) return 'Sangat Tinggi 🔴';
  return 'Ekstrem 🟣';
}

function humidityLevel(hum) {
  const v = Number(hum);
  if (!Number.isFinite(v)) return '';
  if (v < 30) return '(Kering)';
  if (v < 60) return '(Normal)';
  if (v < 80) return '(Lembap)';
  return '(Sangat Lembap)';
}

function visibilityLabel(vis) {
  const v = Number(vis);
  if (!Number.isFinite(v)) return '';
  if (v >= 10000) return '(Sangat Jelas)';
  if (v >= 5000) return '(Jelas)';
  if (v >= 2000) return '(Cukup)';
  if (v >= 500) return '(Kabur)';
  return '(Sangat Kabur)';
}

function weatherAlerts(current, today) {
  const alerts = [];
  const uv = Number(today?.uvIndex);
  const wind = Number(current?.windSpeed);
  const gusts = Number(current?.windGusts);
  const rain = Number(today?.rainProbability);
  const code = Number(current?.weatherCode);
  const temp = Number(current?.temperature);
  const apparentTemp = Number(current?.apparentTemperature);

  if (uv >= 8) alerts.push(`☀️ UV Ekstrem (${formatNumber(uv, '', 1)}) — gunakan tabir surya`);
  if (gusts >= 50) alerts.push(`💨 Hembusan Angin Kencang ${formatNumber(gusts, ' km/jam', 1)} — waspadai benda terbang`);
  else if (wind >= 40) alerts.push(`💨 Angin Kencang ${formatNumber(wind, ' km/jam', 1)} — berhati-hati`);
  if (rain >= 80) alerts.push(`🌧️ Hujan Lebat (${formatNumber(rain, '%')}) — bawa payung`);
  if ([65, 67, 82, 95, 96, 99].includes(code)) alerts.push(`⛈️ Cuaca Ekstrem Aktif — hindari area terbuka`);
  if (Number.isFinite(apparentTemp) && apparentTemp >= 40) alerts.push(`🥵 Indeks Panas Sangat Tinggi (${formatNumber(apparentTemp, '°C')}) — jaga hidrasi`);
  if (Number.isFinite(temp) && temp <= 18) alerts.push(`🧥 Suhu Dingin (${formatNumber(temp, '°C')}) — kenakan pakaian hangat`);

  return alerts;
}

function pickBestLocation(query, results = []) {
  if (!results.length) return null;
  const terms = normalizeText(query).split(' ').filter(Boolean);
  const scored = results.map((item, index) => {
    const fields = [item.name, item.admin4, item.admin3, item.admin2, item.admin1, item.country].filter(Boolean).join(' ');
    const normalized = normalizeText(fields);
    let score = 0;
    for (const term of terms) {
      if (normalized.includes(term)) score += term.length >= 4 ? 3 : 1;
    }
    if (normalizeText(item.country_code) === 'id') score += 5;
    if (normalizeText(item.country) === 'indonesia') score += 5;
    if (item.admin1) score += 1;
    return { item, score: score - index * 0.01 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.item || results[0];
}

function buildLocationName(location) {
  return [location.name, location.admin2, location.admin1, location.country]
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .join(', ');
}

function normalizeNominatimLocation(item = {}) {
  const address = item.address || {};
  const name = address.city || address.town || address.municipality || address.county || address.village || address.suburb || item.name || cleanText(String(item.display_name || '').split(',')[0]);
  return {
    name: cleanText(name),
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    country_code: String(address.country_code || '').toUpperCase(),
    country: address.country || 'Indonesia',
    admin1: address.state || address.province || '',
    admin2: address.county || address.city || address.municipality || '',
    admin3: address.district || address.city_district || '',
    displayName: item.display_name || '',
    osmClass: item.category || '',
    osmType: item.type || '',
    _source: 'nominatim'
  };
}

async function searchLocationNominatim(keyword, options = {}) {
  const { data } = await axios.get(NOMINATIM_URL, {
    params: {
      q: keyword,
      format: 'jsonv2',
      limit: options.limit || 8,
      addressdetails: 1,
      countrycodes: 'id'
    },
    timeout: options.timeout || 15000,
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json'
    }
  });

  const results = Array.isArray(data) ? data.map(normalizeNominatimLocation).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) : [];
  return pickBestLocation(keyword, results);
}

async function searchLocationOpenMeteo(keyword, options = {}) {
  const firstToken = keyword.split(/\s+/).find(Boolean) || keyword;
  const attempts = [...new Set([keyword, firstToken])].filter(Boolean);
  let allResults = [];

  for (const name of attempts) {
    const { data } = await axios.get(GEOCODE_URL, {
      params: {
        name,
        count: options.limit || 10,
        language: 'id',
        format: 'json'
      },
      timeout: options.timeout || 15000,
      headers: {
        'user-agent': USER_AGENT
      }
    });

    const results = Array.isArray(data?.results) ? data.results.map(r => ({ ...r, _source: 'openmeteo' })) : [];
    allResults = allResults.concat(results);
    if (results.length) break;
  }

  const indonesia = allResults.filter(item => String(item.country_code || '').toUpperCase() === 'ID');
  return pickBestLocation(keyword, indonesia.length ? indonesia : allResults);
}

async function searchLocation(query, options = {}) {
  const keyword = cleanText(query);
  if (!keyword) throw new Error('Nama daerah wajib diisi.');

  const [nominatimResult, openMeteoResult] = await Promise.allSettled([
    searchLocationNominatim(keyword, options),
    searchLocationOpenMeteo(keyword, options)
  ]);

  const candidates = [nominatimResult, openMeteoResult]
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  if (!candidates.length) throw new Error(`Daerah "${keyword}" tidak ditemukan.`);

  const om = candidates.find(c => c._source === 'openmeteo');
  const nom = candidates.find(c => c._source !== 'openmeteo');

  if (om) return om;
  if (nom) return nom;
  return candidates[0];
}

async function getWeather(query, options = {}) {
  const location = await searchLocation(query, options);
  const { latitude, longitude } = location;
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    throw new Error('Koordinat daerah tidak valid.');
  }

  const { data } = await axios.get(FORECAST_URL, {
    params: {
      latitude,
      longitude,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'rain',
        'showers',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'visibility',
        'dew_point_2m'
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'dew_point_2m',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'visibility',
        'uv_index'
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'apparent_temperature_min',
        'precipitation_probability_max',
        'precipitation_sum',
        'sunrise',
        'sunset',
        'uv_index_max',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
        'sunshine_duration'
      ].join(','),
      timezone: 'Asia/Jakarta',
      forecast_days: 4
    },
    timeout: options.timeout || 20000,
    headers: {
      'user-agent': USER_AGENT
    }
  });

  const current = data?.current || {};
  const daily = data?.daily || {};
  const hourly = data?.hourly || {};
  const [condition, emoji] = weatherInfo(current.weather_code);
  const nextHours = Array.isArray(hourly.time)
    ? hourly.time.map((time, index) => ({
      time,
      temperature: hourly.temperature_2m?.[index],
      humidity: hourly.relative_humidity_2m?.[index],
      dewPoint: hourly.dew_point_2m?.[index],
      rainProbability: hourly.precipitation_probability?.[index],
      precipitation: hourly.precipitation?.[index],
      weatherCode: hourly.weather_code?.[index],
      cloudCover: hourly.cloud_cover?.[index],
      windSpeed: hourly.wind_speed_10m?.[index],
      windDirection: hourly.wind_direction_10m?.[index],
      windGusts: hourly.wind_gusts_10m?.[index],
      visibility: hourly.visibility?.[index],
      uvIndex: hourly.uv_index?.[index]
    })).filter(item => item.time && item.time >= current.time).slice(0, 6)
    : [];

  const forecast = Array.isArray(daily.time)
    ? daily.time.map((date, index) => {
      const [dailyCondition, dailyEmoji] = weatherInfo(daily.weather_code?.[index]);
      return {
        date,
        condition: dailyCondition,
        emoji: dailyEmoji,
        maxTemp: daily.temperature_2m_max?.[index],
        minTemp: daily.temperature_2m_min?.[index],
        apparentMax: daily.apparent_temperature_max?.[index],
        apparentMin: daily.apparent_temperature_min?.[index],
        rainProbability: daily.precipitation_probability_max?.[index],
        precipitationSum: daily.precipitation_sum?.[index],
        sunrise: daily.sunrise?.[index],
        sunset: daily.sunset?.[index],
        uvIndex: daily.uv_index_max?.[index],
        windSpeedMax: daily.wind_speed_10m_max?.[index],
        windGustsMax: daily.wind_gusts_10m_max?.[index],
        windDirDominant: daily.wind_direction_10m_dominant?.[index],
        sunshineDuration: daily.sunshine_duration?.[index]
      };
    })
    : [];

  return {
    source: 'Open-Meteo realtime forecast',
    location: {
      name: buildLocationName(location),
      rawName: location.name || '',
      province: location.admin1 || '',
      regency: location.admin2 || '',
      country: location.country || '',
      latitude: Number(latitude),
      longitude: Number(longitude),
      timezone: data?.timezone || 'Asia/Jakarta'
    },
    current: {
      time: current.time || '',
      condition,
      emoji,
      isDay: current.is_day === 1,
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      dewPoint: current.dew_point_2m,
      precipitation: current.precipitation,
      rain: current.rain,
      showers: current.showers,
      cloudCover: current.cloud_cover,
      pressureMsl: current.pressure_msl,
      surfacePressure: current.surface_pressure,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      windGusts: current.wind_gusts_10m,
      visibility: current.visibility,
      weatherCode: current.weather_code
    },
    today: forecast[0] || null,
    forecast,
    nextHours,
    fetchedAt: new Date().toISOString()
  };
}

function formatWeatherReport(result) {
  const c = result.current;
  const today = result.today || {};
  const period = getDayPeriod(c.time);

  const nextHours = (result.nextHours || []).slice(0, 6).map(item => {
    const [condition, emoji] = weatherInfo(item.weatherCode);
    const arrow = windDirectionArrow(item.windDirection);
    const windStr = Number.isFinite(Number(item.windSpeed)) ? ` • 💨${formatNumber(item.windSpeed, ' km/j', 0)}${arrow}` : '';
    return `│  ↳ ${formatTime(item.time)} » ${emoji} ${condition}\n│     🌡️${formatNumber(item.temperature, '°C')} • 🌧️${formatNumber(item.rainProbability, '%')}${windStr}`;
  }).join('\n') || '│  ↳ -';

  const forecast = (result.forecast || []).slice(0, 4).map(item => {
    const arrow = windDirectionArrow(item.windDirDominant);
    const sunshineMins = Number.isFinite(Number(item.sunshineDuration)) ? Math.round(Number(item.sunshineDuration) / 60) : null;
    const sunshineStr = sunshineMins !== null ? ` • ☀️${sunshineMins}mnt` : '';
    const windStr = Number.isFinite(Number(item.windSpeedMax)) ? `\n│     💨${formatNumber(item.windSpeedMax, ' km/j', 0)}${arrow} • 💧${formatNumber(item.precipitationSum, ' mm', 1)}${sunshineStr}` : '';
    return `│  ↳ ${item.date} » ${item.emoji} ${item.condition}\n│     🌡️${formatNumber(item.minTemp, '°C')}-${formatNumber(item.maxTemp, '°C')} • 🌧️${formatNumber(item.rainProbability, '%')}${windStr}`;
  }).join('\n') || '│  ↳ -';

  const humNote = humidityLevel(c.humidity);
  const visNote = visibilityLabel(c.visibility);
  const visKm = Number.isFinite(Number(c.visibility)) ? Number(c.visibility) / 1000 : null;
  const visStr = visKm !== null ? `${formatNumber(visKm, ' km', 1)} ${visNote}` : '-';
  const windArrow = windDirectionArrow(c.windDirection);

  const alerts = weatherAlerts(c, today);
  const alertBlock = alerts.length
    ? `│\n│ ⚠️ *Peringatan Cuaca*\n${alerts.map(a => `│  ▸ ${a}`).join('\n')}\n`
    : '';

  const sunshineToday = Number.isFinite(Number(today.sunshineDuration)) ? Math.round(Number(today.sunshineDuration) / 60) : null;
  const sunshineTodayStr = sunshineToday !== null ? `\n│  ▸ Sinar Matahari : ${sunshineToday} menit` : '';

  return `╭─「 🌦️ *CUACA REALTIME* 」
├────────────────────────
│
│ 📍 *Lokasi*
│  ↳ ${result.location.name}
│  ↳ ${result.location.latitude.toFixed(4)}, ${result.location.longitude.toFixed(4)}
│  ↳ Zona Waktu : ${result.location.timezone}
│
│ 🕒 *Update Realtime*
│  ↳ ${formatTime(c.time)} WIB • ${period}
│
│ ${c.emoji} *Kondisi Sekarang*
│  ▸ Cuaca      : ${c.condition}
│  ▸ Suhu       : ${formatNumber(c.temperature, '°C')} (Terasa ${formatNumber(c.apparentTemperature, '°C')})
│  ▸ Titik Embun: ${formatNumber(c.dewPoint, '°C')}
│  ▸ Kelembapan : ${formatNumber(c.humidity, '%')} ${humNote}
│  ▸ Awan       : ${formatNumber(c.cloudCover, '%')}
│  ▸ Hujan      : ${formatNumber(c.precipitation, ' mm', 1)}
│  ▸ Angin      : ${formatNumber(c.windSpeed, ' km/jam', 1)} ${windArrow} (${windDirection(c.windDirection)})
│  ▸ Hembusan   : ${formatNumber(c.windGusts, ' km/jam', 1)}
│  ▸ Tekanan    : ${formatNumber(c.pressureMsl, ' hPa', 1)}
│  ▸ Visibilitas: ${visStr}
│
│ 🌅 *Hari Ini*
│  ▸ Min / Max  : ${formatNumber(today.minTemp, '°C')} - ${formatNumber(today.maxTemp, '°C')}
│  ▸ Terasa     : ${formatNumber(today.apparentMin, '°C')} - ${formatNumber(today.apparentMax, '°C')}
│  ▸ Hujan      : ${formatNumber(today.rainProbability, '%')}
│  ▸ Total Hujan: ${formatNumber(today.precipitationSum, ' mm', 1)}
│  ▸ UV Index   : ${formatNumber(today.uvIndex, '', 1)} — ${uvLevel(today.uvIndex)}
│  ▸ Angin Max  : ${formatNumber(today.windSpeedMax, ' km/jam', 0)} ${windDirectionArrow(today.windDirDominant)} (${windDirection(today.windDirDominant)})
│  ▸ Hembusan   : ${formatNumber(today.windGustsMax, ' km/jam', 0)}${sunshineTodayStr}
│  ▸ Sunrise    : ${formatTime(today.sunrise)} WIB
│  ▸ Sunset     : ${formatTime(today.sunset)} WIB
│
${alertBlock}│ ⏱️ *Beberapa Jam Ke Depan*
${nextHours}
│
│ 📅 *Prakiraan 4 Hari*
${forecast}
│
╰────────────────────────
│ 🔄 Sumber: Open-Meteo • Realtime
╰────────────────────────`;
}

function tileCoords(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

async function fetchTile(url, timeout = 12000) {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      headers: { 'user-agent': USER_AGENT, accept: 'image/png,image/*' }
    });
    const buf = Buffer.from(res.data);
    return buf.length > 200 ? buf : null;
  } catch (_) {
    return null;
  }
}

async function getWeatherMapImage(latitude, longitude, locationName, options = {}) { // eslint-disable-line no-unused-vars
  const sharp = require('sharp');
  const TILE = 256;
  const OSM_ZOOM = 10;
  const RADAR_ZOOM = 6;
  const GRID = 3;
  const SCALE = Math.pow(2, OSM_ZOOM - RADAR_ZOOM);

  const lat = Number(latitude);
  const lon = Number(longitude);

  const { x: osmCx, y: osmCy } = tileCoords(lat, lon, OSM_ZOOM);
  const { x: radCx, y: radCy } = tileCoords(lat, lon, RADAR_ZOOM);

  const rvRes = await axios.get('https://api.rainviewer.com/public/weather-maps.json', {
    timeout: 10000,
    headers: { 'user-agent': USER_AGENT }
  });
  const rvData = rvRes.data;
  const rvHost = rvData.host || 'https://tilecache.rainviewer.com';
  const past = rvData?.radar?.past || [];
  const latestPath = past.length ? past[past.length - 1].path : null;
  const radarTime = past.length
    ? new Date(past[past.length - 1].time * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    : '-';

  const totalSize = TILE * GRID;

  const osmGrid = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      osmGrid.push({ dx, dy, tx: osmCx + dx, ty: osmCy + dy });
    }
  }

  const osmResults = await Promise.all(osmGrid.map(async ({ dx, dy, tx, ty }) => {
    const buf = await fetchTile(`https://tile.openstreetmap.org/${OSM_ZOOM}/${tx}/${ty}.png`);
    let base;
    if (buf) {
      base = await sharp(buf).resize(TILE, TILE).png().toBuffer();
    } else {
      base = await sharp({
        create: { width: TILE, height: TILE, channels: 4, background: { r: 210, g: 230, b: 245, alpha: 255 } }
      }).png().toBuffer();
    }
    return { buffer: base, dx, dy };
  }));

  let osmBase = await sharp({
    create: { width: totalSize, height: totalSize, channels: 4, background: { r: 169, g: 210, b: 235, alpha: 255 } }
  }).composite(
    osmResults.map(({ buffer, dx, dy }) => ({
      input: buffer,
      left: (dx + 1) * TILE,
      top: (dy + 1) * TILE
    }))
  ).png().toBuffer();

  if (latestPath) {
    try {
      const RADAR_GRID = 4;
      const radarFullSize = TILE * RADAR_GRID;

      const radarGrid = [];
      for (let dy = -1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          radarGrid.push({ dx, dy, tx: radCx + dx, ty: radCy + dy });
        }
      }

      const radarTiles = await Promise.all(radarGrid.map(async ({ dx, dy, tx, ty }) => {
        const url = `${rvHost}${latestPath}/256/${RADAR_ZOOM}/${tx}/${ty}/6/1_1.png`;
        const buf = await fetchTile(url);
        if (!buf) return null;
        const resized = await sharp(buf).resize(TILE, TILE).ensureAlpha().png().toBuffer();
        return { buffer: resized, dx, dy };
      }));

      const validTiles = radarTiles.filter(Boolean);
      if (validTiles.length > 0) {
        const radarStitched = await sharp({
          create: { width: radarFullSize, height: radarFullSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
        }).composite(
          validTiles.map(({ buffer, dx, dy }) => ({
            input: buffer,
            left: (dx + 1) * TILE,
            top: (dy + 1) * TILE
          }))
        ).png().toBuffer();

        const osmStartXWorld = (osmCx - 1) * TILE;
        const osmStartYWorld = (osmCy - 1) * TILE;
        const radStartXWorld = (radCx - 1) * TILE * SCALE;
        const radStartYWorld = (radCy - 1) * TILE * SCALE;
        const cropLeft = Math.max(0, osmStartXWorld - radStartXWorld);
        const cropTop = Math.max(0, osmStartYWorld - radStartYWorld);

        const scaledSize = radarFullSize * SCALE;
        const scaledRadarFull = await sharp(radarStitched)
          .resize(scaledSize, scaledSize, { kernel: 'lanczos3' })
          .blur(8)
          .ensureAlpha()
          .png()
          .toBuffer();

        const safeCropLeft = Math.min(cropLeft, scaledSize - totalSize);
        const safeCropTop = Math.min(cropTop, scaledSize - totalSize);
        const scaledRadar = await sharp(scaledRadarFull)
          .extract({ left: Math.max(0, safeCropLeft), top: Math.max(0, safeCropTop), width: totalSize, height: totalSize })
          .ensureAlpha()
          .linear([1, 1, 1, 0.75], [0, 0, 0, 0])
          .png()
          .toBuffer();

        osmBase = await sharp(osmBase)
          .composite([{ input: scaledRadar, blend: 'over' }])
          .png()
          .toBuffer();
      }
    } catch (_) {}
  }

  const centerPx = Math.floor(totalSize / 2);
  const labelName = locationName ? cleanText(locationName).slice(0, 30) : '';

  const svgOverlay = `<svg width="${totalSize}" height="${totalSize}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${centerPx}" cy="${centerPx}" r="14" fill="none" stroke="white" stroke-width="4" opacity="1"/>
    <circle cx="${centerPx}" cy="${centerPx}" r="14" fill="none" stroke="#e53e3e" stroke-width="2" opacity="1"/>
    <circle cx="${centerPx}" cy="${centerPx}" r="4" fill="#e53e3e" stroke="white" stroke-width="2.5"/>
    <line x1="${centerPx}" y1="${centerPx - 20}" x2="${centerPx}" y2="${centerPx - 16}" stroke="white" stroke-width="2.5"/>
    <line x1="${centerPx}" y1="${centerPx + 16}" x2="${centerPx}" y2="${centerPx + 20}" stroke="white" stroke-width="2.5"/>
    <line x1="${centerPx - 20}" y1="${centerPx}" x2="${centerPx - 16}" y2="${centerPx}" stroke="white" stroke-width="2.5"/>
    <line x1="${centerPx + 16}" y1="${centerPx}" x2="${centerPx + 20}" y2="${centerPx}" stroke="white" stroke-width="2.5"/>
    <rect x="6" y="${totalSize - 54}" width="${totalSize - 12}" height="48" rx="8" fill="rgba(0,0,0,0.72)"/>
    <text x="14" y="${totalSize - 33}" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="white">${labelName}</text>
    <text x="14" y="${totalSize - 14}" font-family="Arial,sans-serif" font-size="11" fill="#90cdf4">● Radar ${radarTime} WIB • RainViewer Realtime</text>
  </svg>`;

  const legendW = totalSize;
  const legend = `<svg width="${legendW}" height="28" xmlns="http://www.w3.org/2000/svg">
    <rect width="${legendW}" height="28" fill="rgba(10,10,20,0.92)"/>
    <text x="${legendW / 2}" y="11" font-family="Arial,sans-serif" font-size="9" fill="#aaa" text-anchor="middle">INTENSITAS HUJAN RADAR</text>
    <rect x="10" y="15" width="14" height="9" rx="2" fill="#00eeff"/>
    <text x="28" y="23" font-family="Arial,sans-serif" font-size="9" fill="white">Ringan</text>
    <rect x="80" y="15" width="14" height="9" rx="2" fill="#00cc00"/>
    <text x="98" y="23" font-family="Arial,sans-serif" font-size="9" fill="white">Sedang</text>
    <rect x="156" y="15" width="14" height="9" rx="2" fill="#ffcc00"/>
    <text x="174" y="23" font-family="Arial,sans-serif" font-size="9" fill="white">Lebat</text>
    <rect x="222" y="15" width="14" height="9" rx="2" fill="#ff4400"/>
    <text x="240" y="23" font-family="Arial,sans-serif" font-size="9" fill="white">Deras</text>
    <rect x="288" y="15" width="14" height="9" rx="2" fill="#cc00cc"/>
    <text x="306" y="23" font-family="Arial,sans-serif" font-size="9" fill="white">Badai</text>
    <text x="${legendW - 8}" y="23" font-family="Arial,sans-serif" font-size="8" fill="#666" text-anchor="end">© OSM · RainViewer</text>
  </svg>`;

  const withOverlay = await sharp(osmBase)
    .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
    .png()
    .toBuffer();

  const legendBuf = await sharp(Buffer.from(legend)).png().toBuffer();

  const final = await sharp({
    create: { width: totalSize, height: totalSize + 28, channels: 4, background: { r: 10, g: 10, b: 20, alpha: 255 } }
  }).composite([
    { input: withOverlay, left: 0, top: 0 },
    { input: legendBuf, left: 0, top: totalSize }
  ]).jpeg({ quality: 93 }).toBuffer();

  return final;
}

module.exports = {
  searchLocation,
  getWeather,
  formatWeatherReport,
  getWeatherMapImage
};
