'use strict';

/**
 * Centralized download handler — re-exports semua platform downloader.
 *
 * Usage di message.js:
 *   const { handleTiktokDl, handleInstagramDl, handleFacebookDl,
 *           handlePlay, handleYtmp3, handleYtmp4 } = _require(path.resolve('./src/scrape/downloader.cjs'));
 */

const { handleTiktokDl }    = require('./tiktok-dl.cjs');
const { handleInstagramDl } = require('./instagram-dl.cjs');
const { handleFacebookDl }  = require('./facebook-dl.cjs');
const { handlePlay, handleYtmp3, handleYtmp4 } = require('./youtube-dl.cjs');

module.exports = {
    handleTiktokDl,
    handleInstagramDl,
    handleFacebookDl,
    handlePlay,
    handleYtmp3,
    handleYtmp4,
};
