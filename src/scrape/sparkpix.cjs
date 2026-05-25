/**
 * 【 SparkPix Free HD Upscale 】
 * Creator  : rhmt
 * Base     : https://sparkpix.ai/
 * Category : Upscaler
 * Desc     : Free HD image upscaler 4K/6K/8K + optional face enhancement
 * Recode   : CJS + Buffer support
 */

'use strict';

const { basename, extname } = require('node:path');

const API     = 'https://sparkpix.ai/api/free-hd-upscale';
const REFERER = 'https://sparkpix.ai/aitools/free-hd-upscaler';

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

const FILE_FIELDS = ['file', 'image', 'imageFile', 'photo', 'upload'];

function mimeFromPath(filePath = '') {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
}

function parseResolution(input = '4k') {
    const v = String(input).toLowerCase().replace(/\s+/g, '');
    if (['4k', '2', '2x'].includes(v)) return { resolution: '4K', scale: '2' };
    if (['6k', '3', '3x'].includes(v)) return { resolution: '6K', scale: '3' };
    if (['8k', '4', '4x'].includes(v)) return { resolution: '8K', scale: '4' };
    return { resolution: '4K', scale: '2' };
}

async function inputToFile(input, options = {}) {
    if (Buffer.isBuffer(input)) {
        const mime = options.mimeType || 'image/jpeg';
        return {
            blob    : new Blob([input], { type: mime }),
            filename: options.fileName || 'image.jpg',
            mime,
            size    : input.length,
            source  : 'buffer'
        };
    }

    if (/^https?:\/\//i.test(input)) {
        const res = await fetch(input, {
            headers: { accept: 'image/*,*/*;q=0.8', 'user-agent': UA }
        });
        if (!res.ok) throw new Error(`Gagal fetch image URL: ${res.status}`);
        const arr  = await res.arrayBuffer();
        const type = res.headers.get('content-type') || 'image/jpeg';
        return {
            blob    : new Blob([arr], { type }),
            filename: options.fileName || 'image.jpg',
            mime    : type,
            size    : arr.byteLength,
            source  : input
        };
    }

    const { readFile } = require('node:fs/promises');
    const buffer = await readFile(input);
    const mime   = options.mimeType || mimeFromPath(input);
    return {
        blob    : new Blob([buffer], { type: mime }),
        filename: options.fileName || basename(input),
        mime,
        size    : buffer.length,
        source  : input
    };
}

async function requestUpscale(image, options = {}) {
    const { resolution, scale } = parseResolution(options.resolution || '4k');
    const faceEnhance = !!options.faceEnhance;
    const field       = options.fileField || 'file';

    const form = new FormData();
    form.append(field, image.blob, image.filename);
    form.append('scale', scale);
    form.append('resolution', resolution);
    form.append('faceEnhance', String(faceEnhance));
    form.append('upscaleFactor', scale);
    form.append('targetResolution', resolution);
    form.append('face_enhance', String(faceEnhance));

    const started = Date.now();
    const res = await fetch(API, {
        method : 'POST',
        headers: {
            accept      : '*/*',
            origin      : 'https://sparkpix.ai',
            referer     : REFERER,
            'user-agent': UA
        },
        body: form
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }

    return {
        ok                  : res.ok,
        status_code         : res.status,
        field,
        resolution,
        scale,
        faceEnhance,
        processing_time_local: Date.now() - started,
        json,
        text
    };
}

async function sparkpixHdUpscale(input, options = {}) {
    const image  = await inputToFile(input, options);
    const fields = options.fileField ? [options.fileField] : FILE_FIELDS;

    const attempts = [];

    for (const fileField of fields) {
        const result = await requestUpscale(image, { ...options, fileField });

        attempts.push({
            field      : fileField,
            status_code: result.status_code,
            response   : result.json || result.text?.slice(0, 300)
        });

        const json = result.json;

        if (result.ok && json?.success && json?.resultUrl) {
            return {
                status         : true,
                code           : result.status_code,
                service        : 'sparkpix-free-hd-upscale',
                working_field  : fileField,
                options        : {
                    resolution : result.resolution,
                    scale      : result.scale,
                    faceEnhance: result.faceEnhance
                },
                result_url     : json.resultUrl,
                processing_time: json.processingTime ?? result.processing_time_local
            };
        }

        if (result.status_code !== 400) break;
    }

    return {
        status  : false,
        code    : 500,
        service : 'sparkpix-free-hd-upscale',
        message : 'Gagal upscale. API tidak merespons dengan benar.',
        attempts
    };
}

module.exports = { sparkpixHdUpscale, parseResolution };
