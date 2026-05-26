"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCookie = void 0;
const validateCookie = (cookie) => {
    if (!cookie)
        return false;
    if (typeof cookie === "string")
        return cookie.length > 0;
    if (Array.isArray(cookie))
        return cookie.length > 0;
    return false;
};
exports.validateCookie = validateCookie;
