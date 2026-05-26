"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPlaylistId = exports.extractCollectionId = exports.extractMusicId = void 0;
const extractMusicId = (musicIdOrUrl) => {
    if (!musicIdOrUrl || typeof musicIdOrUrl !== "string") {
        return null;
    }
    const trimmed = musicIdOrUrl.trim();
    if (/^\d+$/.test(trimmed)) {
        return trimmed;
    }
    const urlPattern = /tiktok\.com\/music\/[^\/\-]*-?(\d+)/i;
    const match = trimmed.match(urlPattern);
    if (match && match[1]) {
        return match[1];
    }
    return null;
};
exports.extractMusicId = extractMusicId;
const extractCollectionId = (input) => {
    if (/^\d+$/.test(input)) {
        return input;
    }
    const urlPattern = /collection\/[^\/\-]*-?(\d+)/i;
    const match = input.match(urlPattern);
    return match ? match[1] : null;
};
exports.extractCollectionId = extractCollectionId;
const extractPlaylistId = (input) => {
    if (/^\d+$/.test(input)) {
        return input;
    }
    const urlPattern = /playlist\/[^\/\-]*-?(\d+)/i;
    const match = input.match(urlPattern);
    return match ? match[1] : null;
};
exports.extractPlaylistId = extractPlaylistId;
