/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
    createEditorRuntime,
    getActiveEditorRuntime,
    setActiveEditorRuntime,
} from '../../../../common/mobile/lib/runtime/createEditorRuntime.mjs';
import { createPresentationCommandProvider } from './commandProvider.mjs';

const runtimePermissions = {
    edit: false,
    review: false,
    comment: false,
    fillForms: false,
};

let presentationRuntime = null;

export function initializePresentationEditorRuntime({ inventory, getApi }) {
    disposePresentationEditorRuntime();
    presentationRuntime = createEditorRuntime({
        adapter: createPresentationCommandProvider({ inventory, getApi }),
        permissions: runtimePermissions,
    });
    setActiveEditorRuntime(presentationRuntime);
    return presentationRuntime;
}

export function updatePresentationEditorPermissions(permissions) {
    Object.keys(runtimePermissions).forEach(key => {
        runtimePermissions[key] = permissions?.[key] === true;
    });
}

export function getPresentationEditorRuntime() {
    return presentationRuntime;
}

export function executePresentationCommand(commandId, payload) {
    const runtime = getActiveEditorRuntime();
    if (!runtime || runtime !== presentationRuntime) {
        const error = new Error('Presentation Editor Runtime is not initialized');
        error.code = 'MOBILE_RUNTIME_UNAVAILABLE';
        throw error;
    }
    return runtime.execute(commandId, payload);
}

export function disposePresentationEditorRuntime() {
    if (presentationRuntime) {
        if (getActiveEditorRuntime() === presentationRuntime) {
            setActiveEditorRuntime(null);
        }
        presentationRuntime.dispose();
        presentationRuntime = null;
    }
    Object.keys(runtimePermissions).forEach(key => {
        runtimePermissions[key] = false;
    });
}
