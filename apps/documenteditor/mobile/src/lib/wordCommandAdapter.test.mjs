/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {createEditorRuntime} from '../../../../common/mobile/lib/runtime/createEditorRuntime.mjs';
import {createWordCommandAdapter} from './wordCommandAdapter.mjs';
import {
    getWordCommandSpecByMethod,
    WORD_COMMAND_IDS,
    WORD_COMMAND_SPECS
} from './wordCommandCatalog.mjs';
import {createWordEditorApiGate} from './wordEditorApiGate.mjs';
import {
    getWordSelectionContexts,
    resolveWordCommandTarget,
    searchAvailableWordCommands
} from './wordCommandSearch.mjs';
import {
    disposeWordEditorRuntime,
    initializeWordEditorRuntime,
    updateWordEditorPermissions
} from './wordEditorRuntime.mjs';
import {presentWordSession} from './wordSessionPresentation.mjs';

function createApi({missing = []} = {}) {
    const callbacks = new Map();
    const calls = [];
    const unavailable = new Set(missing);
    const target = {
        callbacks,
        calls,
        asc_registerCallback(name, callback) {
            callbacks.set(name, callback);
        },
        asc_unregisterCallback(name, callback) {
            if (callbacks.get(name) === callback) {
                callbacks.delete(name);
            }
        },
        getSelectedElements() {
            return ['selection'];
        },
        can_CopyCut() {
            calls.push(['can_CopyCut']);
            return true;
        }
    };

    return new Proxy(target, {
        get(api, property, receiver) {
            if (unavailable.has(property)) {
                return undefined;
            }
            if (Reflect.has(api, property)) {
                return Reflect.get(api, property, receiver);
            }
            if (typeof property !== 'string') {
                return undefined;
            }
            const method = (...args) => {
                calls.push([property, ...args]);
                return `${property}-result`;
            };
            api[property] = method;
            return method;
        }
    });
}

function markReady(api) {
    api.callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    api.callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
}

test('maps tracer payloads to the exact SDK signatures', () => {
    const api = createApi();
    const adapter = createWordCommandAdapter({getApi: () => api});
    const comment = {text: 'review'};

    adapter.execute(WORD_COMMAND_IDS.BOLD, {value: true});
    adapter.execute(WORD_COMMAND_IDS.PARAGRAPH_ALIGN, {value: 'center'});
    adapter.execute(WORD_COMMAND_IDS.TABLE_INSERT, {columns: 3, rows: 2, style: 'default'});
    adapter.execute(WORD_COMMAND_IDS.COMMENT_ADD, {comment});
    adapter.execute(WORD_COMMAND_IDS.COPY);
    adapter.execute(WORD_COMMAND_IDS.UNDO);

    assert.deepEqual(api.calls, [
        ['put_TextPrBold', true],
        ['put_PrAlign', 2],
        ['put_Table', 3, 2, 'default'],
        ['asc_addComment', comment],
        ['Copy'],
        ['Undo']
    ]);
    assert.deepEqual(adapter.getSelectionSnapshot(), ['selection']);
    assert.throws(
        () => adapter.execute(WORD_COMMAND_IDS.PARAGRAPH_ALIGN, {value: 'diagonal'}),
        error => error.code === 'MOBILE_COMMAND_PAYLOAD_INVALID'
    );
});

test('publishes one unique descriptor and one real SDK binding per Word command', () => {
    const adapter = createWordCommandAdapter({getApi: createApi});
    const descriptors = adapter.getCommandDescriptors();

    assert.equal(new Set(WORD_COMMAND_SPECS.map(spec => spec.id)).size, WORD_COMMAND_SPECS.length);
    assert.equal(new Set(WORD_COMMAND_SPECS.map(spec => spec.binding.method)).size, WORD_COMMAND_SPECS.length);
    assert.equal(descriptors.length, WORD_COMMAND_SPECS.length);

    descriptors.forEach((descriptor, index) => {
        const spec = WORD_COMMAND_SPECS[index];
        assert.equal(descriptor.id, spec.id);
        assert.deepEqual(descriptor.contexts, spec.contexts);
        assert.equal(descriptor.mobilePath, spec.mobilePath);
        assert.equal(descriptor.mutates, spec.mutates);
        if (spec.permissions.length === 1) {
            assert.equal(descriptor.permission, spec.permissions[0]);
            assert.equal(descriptor.permissionsAny, undefined);
        } else {
            assert.deepEqual(descriptor.permissionsAny, spec.permissions);
            assert.equal(descriptor.permission, undefined);
        }
    });
});

test('executes every catalog binding and fails closed for unknown or unavailable bindings', () => {
    const api = createApi();
    const adapter = createWordCommandAdapter({getApi: () => api});

    WORD_COMMAND_SPECS.forEach(spec => {
        assert.equal(
            adapter.execute(spec.id, {args: [spec.id]}),
            `${spec.binding.method}-result`,
            spec.id
        );
    });
    assert.deepEqual(
        api.calls.map(call => call[0]),
        WORD_COMMAND_SPECS.map(spec => spec.binding.method)
    );
    assert.throws(
        () => adapter.execute('word.unknown'),
        error => error.code === 'MOBILE_COMMAND_NOT_FOUND'
    );

    const missingAdapter = createWordCommandAdapter({
        getApi: () => createApi({missing: ['put_TextPrBold']})
    });
    assert.throws(
        () => missingAdapter.execute(WORD_COMMAND_IDS.BOLD, {value: true}),
        error => error.code === 'MOBILE_COMMAND_BINDING_UNAVAILABLE' &&
            error.details.method === 'put_TextPrBold'
    );
});

test('enforces all five permission profiles across the complete catalog', () => {
    const profiles = [
        {name: 'full-edit', permissions: {edit: true, review: true, comment: true, fillForms: true}},
        {name: 'review-only', permissions: {review: true}},
        {name: 'comment-only', permissions: {comment: true}},
        {name: 'fill-forms-only', permissions: {fillForms: true}},
        {name: 'view-only', permissions: {}}
    ];

    profiles.forEach(profile => {
        const api = createApi();
        const runtime = createEditorRuntime({
            adapter: createWordCommandAdapter({getApi: () => api}),
            permissions: profile.permissions
        });
        markReady(api);

        WORD_COMMAND_SPECS.forEach(spec => {
            const expected = spec.permissions.includes('view') ||
                spec.permissions.some(permission => profile.permissions[permission] === true);
            const resolved = runtime.resolve(spec.id);
            assert.equal(resolved.available, expected, `${profile.name}: ${spec.id}`);
            if (!expected) {
                assert.throws(
                    () => runtime.execute(spec.id, {args: []}),
                    error => error.code === 'MOBILE_COMMAND_PERMISSION_DENIED',
                    `${profile.name}: ${spec.id}`
                );
            }
        });
        runtime.dispose();
    });
});

test('allows every content-changing permission profile to request a server save', () => {
    assert.deepEqual(
        getWordCommandSpecByMethod('asc_Save').permissions,
        ['edit', 'review', 'comment', 'fillForms']
    );
});

test('routes mapped controller calls through Runtime and preserves query passthrough', () => {
    const api = createApi();
    const runtime = initializeWordEditorRuntime({getApi: () => api});
    updateWordEditorPermissions({edit: true});
    markReady(api);

    const getApi = createWordEditorApiGate({getRawApi: () => api});
    const gatedApi = getApi();
    assert.equal(gatedApi.put_TextPrBold(true), 'put_TextPrBold-result');
    assert.equal(gatedApi.can_CopyCut(), true);
    assert.deepEqual(api.calls, [
        ['put_TextPrBold', true],
        ['can_CopyCut']
    ]);
    assert.equal(getApi(), gatedApi);

    api.callbacks.get('asc_onTransportStateChanged')({state: 'reconnecting'});
    assert.throws(
        () => gatedApi.put_TextPrBold(false),
        error => error.code === 'MOBILE_COMMAND_SESSION_FROZEN'
    );
    api.callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    updateWordEditorPermissions({review: true});
    assert.throws(
        () => gatedApi.put_Table(2, 2, 'default'),
        error => error.code === 'MOBILE_COMMAND_PERMISSION_DENIED'
    );

    runtime.dispose();
    disposeWordEditorRuntime();
});

test('mapped controller calls cannot bypass a missing Runtime', () => {
    disposeWordEditorRuntime();
    const api = createApi();
    const gatedApi = createWordEditorApiGate({getRawApi: () => api})();

    assert.throws(
        () => gatedApi.put_TextPrBold(true),
        error => error.code === 'MOBILE_RUNTIME_UNAVAILABLE'
    );
    assert.equal(api.calls.length, 0);
});

test('Word API gate leaves non-Word editor methods on their owning API', () => {
    disposeWordEditorRuntime();
    const calls = [];
    const api = {
        asc_Save: (...args) => calls.push(['asc_Save', ...args]),
        Copy: (...args) => calls.push(['Copy', ...args])
    };
    const getApi = createWordEditorApiGate({
        getRawApi: () => api,
        shouldGate: () => false
    });

    getApi().asc_Save('pdf');
    getApi().Copy('selection');

    assert.deepEqual(calls, [
        ['asc_Save', 'pdf'],
        ['Copy', 'selection']
    ]);
});

test('forwards only explicit SDK lifecycle facts and unregisters them', () => {
    const api = createApi();
    const adapter = createWordCommandAdapter({getApi: () => api});
    const events = [];
    const unsubscribe = adapter.subscribeState(event => events.push(event));

    api.callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
    api.callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    api.callbacks.get('asc_onServerSaveStateChanged')({
        state: 'accepted',
        scope: 'coauthoring-server',
        changesIndex: 3
    });

    assert.deepEqual(events, [
        {type: 'document-open', phase: 'ready'},
        {type: 'transport', state: 'connected'},
        {
            type: 'server-save',
            state: 'accepted',
            scope: 'coauthoring-server',
            changesIndex: 3
        }
    ]);

    unsubscribe();
    assert.equal(api.callbacks.size, 0);
});

const systemMethods = new Set([
    'ChangeReaderMode',
    'Resize',
    'SetCollaborativeMarksShowType',
    'SetDrawImagePlaceContents',
    'SetDrawImagePreviewBulletForMenu',
    'SetDrawingFreeze',
    'SetFontRenderingMode',
    'SetMobileTopOffset',
    'UpdateInterfaceState',
    'asc_FollowRevisionMove',
    'asc_LoadDocument',
    'asc_SetDisplayModeInReview',
    'asc_SetDocumentUnits',
    'asc_SetFastCollaborative',
    'asc_SetHighlightRequiredFields',
    'asc_SetLocalTrackRevisions',
    'asc_ShowDocumentOutline',
    'asc_coAuthoringDisconnect',
    'asc_continueSaving',
    'asc_enableKeyEvents',
    'asc_findText',
    'asc_hideComments',
    'asc_pluginRun',
    'asc_refreshFile',
    'asc_registerCallback',
    'asc_runAutostartMacroses',
    'asc_selectComment',
    'asc_selectSearchingResults',
    'asc_setAdvancedOptions',
    'asc_setAutoSaveGap',
    'asc_setLocale',
    'asc_setPdfViewer',
    'asc_setSpellCheck',
    'asc_setViewMode',
    'asc_showComment',
    'asc_showComments',
    'asc_stopSaving',
    'asc_unregisterCallback',
    'asc_viewerNavigateTo',
    'put_ShowParaMarks',
    'put_ShowTableEmptyLine',
    'startGetDocInfo',
    'zoom',
    'zoomFitToPage',
    'zoomFitToWidth'
]);

function listFiles(root) {
    return fs.readdirSync(root, {withFileTypes: true}).flatMap(entry => {
        const item = path.join(root, entry.name);
        return entry.isDirectory() ? listFiles(item) : entry.name.endsWith('.jsx') ? [item] : [];
    });
}

function isSdkQuery(method) {
    return /^(?:get_|get[A-Z]|can_|can[A-Z]|is_|is[A-Z]|asc_(?:[gG]et|[iI]s|Have|Can))/.test(method);
}

test('every direct Word Mobile SDK call is cataloged or explicitly non-mutating', () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const roots = [
        path.resolve(currentDir, '..'),
        path.resolve(currentDir, '../../../../common/mobile/lib/controller/collaboration')
    ];
    const callPattern = /(?:Common\.EditorApi\.get\(\)|this\.api|\bapi)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    const calls = new Map();

    roots.flatMap(listFiles).forEach(file => {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(callPattern)) {
            if (!calls.has(match[1])) {
                calls.set(match[1], []);
            }
            calls.get(match[1]).push(path.relative(currentDir, file));
        }
    });

    const uncovered = [...calls]
        .filter(([method]) => !getWordCommandSpecByMethod(method) &&
            !isSdkQuery(method) && !systemMethods.has(method))
        .map(([method, files]) => ({method, files: [...new Set(files)].sort()}))
        .sort((left, right) => left.method.localeCompare(right.method));
    assert.deepEqual(uncovered, []);
});

test('normalizes SDK selection types and Word image subtypes into command contexts', () => {
    const asc = {c_oAscTypeSelectElement: {Paragraph: 1, Image: 2, Table: 3}};
    const selection = [
        {get_ObjectType: () => 1},
        {
            get_ObjectType: () => 2,
            get_ObjectValue: () => ({get_ChartProperties: () => ({type: 'bar'})})
        }
    ];

    assert.deepEqual(
        getWordSelectionContexts(selection, asc).sort(),
        ['chart', 'document', 'paragraph', 'shape', 'text'].sort()
    );
});

test('filters command search by permission, selection and localized text', () => {
    const available = new Set([
        WORD_COMMAND_IDS.BOLD,
        WORD_COMMAND_IDS.TABLE_INSERT,
        WORD_COMMAND_IDS.COMMENT_ADD
    ]);
    const runtime = {resolve: commandId => ({available: available.has(commandId)})};

    assert.deepEqual(
        searchAvailableWordCommands({runtime, locale: 'en', query: 'bo', contexts: ['document', 'text']}),
        [{id: WORD_COMMAND_IDS.BOLD, label: 'Bold', mobilePath: 'edit.text.bold', target: 'edit'}]
    );
    assert.deepEqual(
        searchAvailableWordCommands({runtime, locale: 'zh-CN', query: '\u8868\u683c', contexts: ['document']}),
        [{id: WORD_COMMAND_IDS.TABLE_INSERT, label: '\u63d2\u5165\u8868\u683c', mobilePath: 'insert.table', target: 'add'}]
    );
});

test('maps command paths to their existing Mobile panels', () => {
    assert.equal(resolveWordCommandTarget('edit.text.bold'), 'edit');
    assert.equal(resolveWordCommandTarget('insert.image'), 'add');
    assert.equal(resolveWordCommandTarget('collaboration.review.accept'), 'coauth');
    assert.equal(resolveWordCommandTarget('settings.save'), 'settings');
    assert.equal(resolveWordCommandTarget('toolbar.undo'), 'editor');
    assert.equal(resolveWordCommandTarget('unknown.path'), 'settings');
});

test('prioritizes recovery states over non-blocking session facts', () => {
    assert.deepEqual(presentWordSession({
        open: {phase: 'ready'},
        transport: {state: 'reconnecting'},
        save: {state: 'version-conflict'}
    }), {kind: 'recovery', code: 'conflict', messageKey: 'Session.textConflict'});
    assert.deepEqual(presentWordSession({
        open: {phase: 'fatal-error'},
        transport: {state: 'closed'},
        save: {state: 'blocking-failed'}
    }), {kind: 'recovery', code: 'fatal', messageKey: 'Session.textFatal'});
});

test('presents real transport and save facts without inferred timers', () => {
    assert.equal(presentWordSession({
        open: {phase: 'ready'},
        transport: {state: 'reconciling'},
        save: {state: 'idle'}
    }).code, 'connection');
    assert.equal(presentWordSession({
        open: {phase: 'ready'},
        transport: {state: 'connected'},
        save: {state: 'retryable-failed'}
    }).code, 'retryable-save');
    assert.equal(presentWordSession({
        open: {phase: 'ready'},
        transport: {state: 'connected'},
        save: {state: 'retrying'}
    }).code, 'saving');
    assert.equal(presentWordSession({
        open: {phase: 'rendering'},
        transport: {state: 'connected'},
        save: {state: 'idle'}
    }).code, 'opening');
});

test('hides the presenter only when the session is ready and stable', () => {
    assert.deepEqual(presentWordSession({
        open: {phase: 'ready'},
        transport: {state: 'connected'},
        save: {state: 'accepted'}
    }), {kind: 'none'});
});
