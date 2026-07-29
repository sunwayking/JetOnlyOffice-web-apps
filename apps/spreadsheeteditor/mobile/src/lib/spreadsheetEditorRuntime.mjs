/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
    createEditorRuntime,
    getActiveEditorRuntime,
    setActiveEditorRuntime,
} from '../../../../common/mobile/lib/runtime/createEditorRuntime.mjs';
import { createSpreadsheetCommandProvider } from './commandProvider.mjs';

const runtimePermissions = {
    edit: false,
    review: false,
    comment: false,
    fillForms: false,
};

let spreadsheetRuntime = null;

export function initializeSpreadsheetEditorRuntime({
    inventory,
    getApi,
    navigateCommand,
    executeHostCommand,
}) {
    disposeSpreadsheetEditorRuntime();
    spreadsheetRuntime = createEditorRuntime({
        adapter: createSpreadsheetCommandProvider({
            inventory,
            getApi,
            navigateCommand,
            executeHostCommand,
        }),
        permissions: runtimePermissions,
    });
    setActiveEditorRuntime(spreadsheetRuntime);
    return spreadsheetRuntime;
}

export function updateSpreadsheetEditorPermissions(permissions) {
    Object.keys(runtimePermissions).forEach(key => {
        runtimePermissions[key] = permissions?.[key] === true;
    });
}

export function getSpreadsheetEditorRuntime() {
    return spreadsheetRuntime;
}

export function executeSpreadsheetCommand(commandId, payload) {
    const runtime = getActiveEditorRuntime();
    if (!runtime || runtime !== spreadsheetRuntime) {
        const error = new Error('Spreadsheet Editor Runtime is not initialized');
        error.code = 'MOBILE_RUNTIME_UNAVAILABLE';
        throw error;
    }
    return runtime.execute(commandId, payload);
}

export function disposeSpreadsheetEditorRuntime() {
    if (spreadsheetRuntime) {
        if (getActiveEditorRuntime() === spreadsheetRuntime) {
            setActiveEditorRuntime(null);
        }
        spreadsheetRuntime.dispose();
        spreadsheetRuntime = null;
    }
    Object.keys(runtimePermissions).forEach(key => {
        runtimePermissions[key] = false;
    });
}
