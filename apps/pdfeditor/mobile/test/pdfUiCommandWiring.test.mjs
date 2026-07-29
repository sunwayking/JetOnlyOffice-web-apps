/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
    createPdfUiCommandHandler,
    disposePdfEditorRuntime,
    initializePdfEditorRuntime,
} from '../src/lib/pdfEditorRuntime.mjs';

const catalog = {
    commands: [{
        id: 'pdf.ui.test',
        taskSpace: 'edit',
        permission: 'view',
        mutates: false,
        binding: {kind: 'ui', method: 'openSettings', arguments: []},
    }],
};

function createRuntimeApi() {
    const callbacks = new Map();
    return {
        asc_registerCallback: (name, callback) => callbacks.set(name, callback),
        asc_unregisterCallback: (name, callback) => {
            if (callbacks.get(name) === callback) callbacks.delete(name);
        },
        getSelectedElements: () => [],
        callbacks,
    };
}

function ready(runtimeApi) {
    runtimeApi.callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
    runtimeApi.callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
}

test.afterEach(() => disposePdfEditorRuntime());

test('PDF Runtime forwards the Mobile UI executor to the command provider', () => {
    const api = createRuntimeApi();
    const calls = [];
    const runtime = initializePdfEditorRuntime({
        catalog,
        getApi: () => api,
        executeUiCommand: (...args) => {
            calls.push(args);
            return 'opened';
        },
    });
    ready(api);

    assert.equal(runtime.execute('pdf.ui.test', {source: 'catalog'}), 'opened');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'openSettings');
    assert.deepEqual(calls[0][1], {source: 'catalog'});
    assert.equal(calls[0][2].id, 'pdf.ui.test');
});

test('PDF Runtime fails closed when no Mobile UI executor is configured', () => {
    const api = createRuntimeApi();
    const runtime = initializePdfEditorRuntime({catalog, getApi: () => api});
    ready(api);

    assert.throws(
        () => runtime.execute('pdf.ui.test'),
        error => error.code === 'MOBILE_COMMAND_CAPABILITY_UNAVAILABLE' &&
            error.details.reason === 'mobile-ui-binding-unavailable',
    );
});

test('PDF Mobile UI dispatcher runs only explicitly registered actions', () => {
    const calls = [];
    const executeUiCommand = createPdfUiCommandHandler({
        openSettings: (payload, command) => calls.push([payload, command.id]),
    });

    executeUiCommand('openSettings', {source: 'toolbar'}, {id: 'pdf.ui.quick-access'});
    assert.deepEqual(calls, [[{source: 'toolbar'}, 'pdf.ui.quick-access']]);
    assert.throws(
        () => executeUiCommand('openSupport'),
        error => error.code === 'MOBILE_UI_COMMAND_UNAVAILABLE' &&
            error.details.action === 'openSupport',
    );
    assert.throws(
        () => createPdfUiCommandHandler({openSettings: null})('openSettings'),
        error => error.code === 'MOBILE_UI_COMMAND_UNAVAILABLE' &&
            error.details.action === 'openSettings',
    );
});

test('PDF Mobile app maps every catalog UI action to a concrete state transition', async () => {
    const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
    const mappings = [
        "openSettings: () => mobileState.openOverlay('settings')",
        "openEditRights: () => mobileState.openOverlay('collaboration')",
        "openPages: () => mobileState.openTask('pages')",
        "openSearch: () => mobileState.openOverlay('command-search')",
        "openComments: () => mobileState.openTask('comment')",
        "openAbout: () => mobileState.openOverlay('about')",
        "openSupport: () => mobileState.openOverlay('support')",
        "openForms: () => mobileState.openTask('forms')",
        "openEdit: () => mobileState.openTask('edit')",
        "openSignatures: () => mobileState.openTask('signatures')",
        "openChartLinks: () => mobileState.openOverlay('chart-links')",
        "updateChartData: () => mobileState.openOverlay('chart-data')",
        'closePanel: () => mobileState.closePanel()',
    ];

    mappings.forEach(mapping => assert.match(source, new RegExp(mapping.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
    assert.match(source, /executeUiCommand:\s*executePdfUiCommand/);
});
