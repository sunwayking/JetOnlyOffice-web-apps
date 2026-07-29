/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

function getDocumentState(getApi) {
    try {
        const api = getApi?.();
        if (!api || typeof api.isDocumentModified !== 'function') {
            return 'unknown';
        }
        return api.isDocumentModified() === true ? 'modified' : 'clean';
    } catch {
        return 'unknown';
    }
}

export function requestWordSessionReopen({getApi, confirmDiscard, reload} = {}) {
    if (typeof reload !== 'function') {
        throw new TypeError('Word session reopen requires a reload function');
    }

    if (getDocumentState(getApi) !== 'clean') {
        if (typeof confirmDiscard !== 'function' || confirmDiscard() !== true) {
            return false;
        }
    }

    reload();
    return true;
}
