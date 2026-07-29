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

const uiCommandError = action => {
    const error = new Error(`PDF Mobile UI command is unavailable: ${String(action)}`);
    error.code = 'MOBILE_UI_COMMAND_UNAVAILABLE';
    error.details = {action};
    return error;
};

export function createPdfUiCommandHandler(handlers = {}) {
    const registeredHandlers = handlers && typeof handlers === 'object' ? {...handlers} : {};
    return (action, payload, command) => {
        const handler = Object.prototype.hasOwnProperty.call(registeredHandlers, action)
            ? registeredHandlers[action]
            : null;
        if (typeof handler !== 'function') throw uiCommandError(action);
        return handler(payload, command);
    };
}

export function initializePdfEditorRuntime({catalog, getApi, permissions = {}, executeUiCommand}) {
    disposePdfEditorRuntime();
    updatePdfEditorPermissions(permissions);
    pdfCommandProvider = createPdfCommandProvider({catalog, getApi, executeUiCommand});
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
