/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
    createEditorRuntime,
    getActiveEditorRuntime,
    setActiveEditorRuntime
} from '../../../../common/mobile/lib/runtime/createEditorRuntime.mjs';
import {createWordCommandAdapter} from './wordCommandAdapter.mjs';

const runtimePermissions = {
    edit: false,
    review: false,
    comment: false,
    fillForms: false
};

let wordRuntime = null;
const runtimeSubscribers = new Set();

function publishRuntime() {
    runtimeSubscribers.forEach(subscriber => subscriber(wordRuntime));
}

export function initializeWordEditorRuntime({getApi}) {
    disposeWordEditorRuntime();
    wordRuntime = createEditorRuntime({
        adapter: createWordCommandAdapter({getApi}),
        permissions: runtimePermissions
    });
    setActiveEditorRuntime(wordRuntime);
    publishRuntime();
    return wordRuntime;
}

export function updateWordEditorPermissions(permissions) {
    Object.keys(runtimePermissions).forEach(key => {
        runtimePermissions[key] = permissions?.[key] === true;
    });
}

export function getWordEditorRuntime() {
    return wordRuntime;
}

export function subscribeWordEditorRuntime(subscriber) {
    if (typeof subscriber !== 'function') {
        throw new TypeError('Word Runtime subscriber must be a function');
    }
    runtimeSubscribers.add(subscriber);
    subscriber(wordRuntime);
    return () => runtimeSubscribers.delete(subscriber);
}

export function executeWordCommand(commandId, payload) {
    const runtime = getActiveEditorRuntime();
    if (!runtime || runtime !== wordRuntime) {
        const error = new Error('Word Editor Runtime is not initialized');
        error.code = 'MOBILE_RUNTIME_UNAVAILABLE';
        throw error;
    }
    return runtime.execute(commandId, payload);
}

export function disposeWordEditorRuntime() {
    if (wordRuntime) {
        if (getActiveEditorRuntime() === wordRuntime) {
            setActiveEditorRuntime(null);
        }
        wordRuntime.dispose();
        wordRuntime = null;
        publishRuntime();
    }
    Object.keys(runtimePermissions).forEach(key => {
        runtimePermissions[key] = false;
    });
}
