/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
    createEditorRuntime,
    getActiveEditorRuntime,
    setActiveEditorRuntime,
} from '../../../../common/mobile/lib/runtime/createEditorRuntime.mjs';
import {createPdfCommandProvider} from './pdfCommandProvider.mjs';

const runtimePermissions = {
    edit: false,
    review: false,
    comment: false,
    fillForms: false,
};

let pdfRuntime = null;
let pdfCommandProvider = null;

export function initializePdfEditorRuntime({catalog, getApi, permissions = {}}) {
    disposePdfEditorRuntime();
    updatePdfEditorPermissions(permissions);
    pdfCommandProvider = createPdfCommandProvider({catalog, getApi});
    pdfRuntime = createEditorRuntime({
        adapter: pdfCommandProvider,
        permissions: runtimePermissions,
    });
    setActiveEditorRuntime(pdfRuntime);
    return pdfRuntime;
}

export function updatePdfEditorPermissions(permissions) {
    Object.keys(runtimePermissions).forEach(key => {
        runtimePermissions[key] = permissions?.[key] === true;
    });
}

export function getPdfEditorRuntime() {
    return pdfRuntime;
}

export function getPdfCommandProvider() {
    return pdfCommandProvider;
}

export function disposePdfEditorRuntime() {
    if (pdfRuntime) {
        if (getActiveEditorRuntime() === pdfRuntime) setActiveEditorRuntime(null);
        pdfRuntime.dispose();
        pdfRuntime = null;
        pdfCommandProvider = null;
    }
    updatePdfEditorPermissions();
}
