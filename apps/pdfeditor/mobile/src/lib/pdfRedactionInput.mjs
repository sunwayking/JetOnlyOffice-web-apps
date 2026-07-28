/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const pageRangeError = value => {
    const error = new Error('PDF page range must contain positive page numbers and ascending ranges');
    error.code = 'MOBILE_PDF_PAGE_RANGE_INVALID';
    error.value = value;
    return error;
};

export function parsePdfPageRange(value, pageCount) {
    if (typeof value !== 'string' || !value.trim() ||
        !Number.isSafeInteger(pageCount) || pageCount < 1) {
        throw pageRangeError(value);
    }
    const parts = value.split(',').map(part => part.trim());
    if (parts.some(part => !/^\d+(?:\s*-\s*\d+)?$/.test(part))) throw pageRangeError(value);

    const pages = new Set();
    for (const part of parts) {
        const [start, end = start] = part.split('-').map(item => Number.parseInt(item.trim(), 10));
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
            start < 1 || end < start || end > pageCount) {
            throw pageRangeError(value);
        }
        for (let page = start; page <= end; page += 1) pages.add(page - 1);
    }
    return Array.from(pages).sort((left, right) => left - right);
}

export default parsePdfPageRange;
