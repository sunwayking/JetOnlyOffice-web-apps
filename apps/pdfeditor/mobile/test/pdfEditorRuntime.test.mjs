/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
    disposePdfEditorRuntime,
    getPdfCommandProvider,
    initializePdfEditorRuntime,
} from '../src/lib/pdfEditorRuntime.mjs';

const catalog = JSON.parse(await readFile(
    new URL('../src/commands/mobile-command-catalog.json', import.meta.url),
    'utf8',
));

function createRuntimeApi() {
    const callbacks = new Map();
    const calls = [];
    return {
        callbacks,
        calls,
        api: {
            asc_registerCallback: (name, callback) => callbacks.set(name, callback),
            asc_unregisterCallback: (name, callback) => {
                if (callbacks.get(name) === callback) callbacks.delete(name);
            },
            getSelectedElements: () => [],
            Undo: () => calls.push('undo'),
            asc_getSignatures: () => [],
            asc_getSignatureFields: () => [],
        },
    };
}

test('PDF Runtime enforces permission and real session facts', () => {
    const fixture = createRuntimeApi();
    const runtime = initializePdfEditorRuntime({
        catalog,
        getApi: () => fixture.api,
        permissions: {edit: true},
    });

    assert.throws(
        () => runtime.execute('pdf.edit.undo'),
        error => error.code === 'MOBILE_COMMAND_SESSION_FROZEN' && error.details.freezeReason === 'open-idle',
    );
    fixture.callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
    fixture.callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    runtime.execute('pdf.edit.undo');
    assert.deepEqual(fixture.calls, ['undo']);
    assert.equal(runtime.resolve('pdf.comment.add').reason, 'permission-denied');
    assert.deepEqual(getPdfCommandProvider().resolveCapability('pdf.signatures.fields'), {available: true});

    fixture.callbacks.get('asc_onServerSaveStateChanged')({state: 'blocking-failed'});
    assert.throws(
        () => runtime.execute('pdf.edit.undo'),
        error => error.code === 'MOBILE_COMMAND_SESSION_FROZEN' &&
            error.details.freezeReason === 'blocking-save-failure',
    );
    assert.equal(runtime.resolve('pdf.signatures.fields').available, true);

    disposePdfEditorRuntime();
    assert.equal(fixture.callbacks.size, 0);
    assert.equal(getPdfCommandProvider(), null);
});
