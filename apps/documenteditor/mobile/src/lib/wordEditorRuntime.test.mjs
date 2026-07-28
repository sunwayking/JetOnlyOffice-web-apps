/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    disposeWordEditorRuntime,
    executeWordCommand,
    initializeWordEditorRuntime,
    updateWordEditorPermissions
} from './wordEditorRuntime.mjs';

function createApi(calls) {
    const callbacks = new Map();
    return {
        callbacks,
        asc_registerCallback(name, callback) {
            callbacks.set(name, callback);
        },
        asc_unregisterCallback(name, callback) {
            if (callbacks.get(name) === callback) {
                callbacks.delete(name);
            }
        },
        getSelectedElements() {
            return [];
        },
        put_TextPrBold(value) {
            calls.push(value);
        }
    };
}

test('a new Word session starts fail-closed after the previous session is disposed', () => {
    const firstCalls = [];
    const firstApi = createApi(firstCalls);
    initializeWordEditorRuntime({getApi: () => firstApi});
    updateWordEditorPermissions({edit: true});
    firstApi.callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    firstApi.callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
    executeWordCommand('word.text.bold', {value: true});
    assert.deepEqual(firstCalls, [true]);
    disposeWordEditorRuntime();

    const secondCalls = [];
    const secondApi = createApi(secondCalls);
    initializeWordEditorRuntime({getApi: () => secondApi});
    secondApi.callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    secondApi.callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
    assert.throws(
        () => executeWordCommand('word.text.bold', {value: true}),
        error => error.code === 'MOBILE_COMMAND_PERMISSION_DENIED'
    );
    assert.deepEqual(secondCalls, []);
    disposeWordEditorRuntime();
});
