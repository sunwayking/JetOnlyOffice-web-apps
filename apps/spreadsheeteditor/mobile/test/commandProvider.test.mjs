import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    createEditorUIControllerFacade,
    createSpreadsheetCommandProvider,
} from '../src/lib/commandProvider.mjs';
import {
    disposeSpreadsheetEditorRuntime,
    initializeSpreadsheetEditorRuntime,
    updateSpreadsheetEditorPermissions,
} from '../src/lib/spreadsheetEditorRuntime.mjs';

const inventoryUrl = new URL('../src/commands/desktop-command-inventory.json', import.meta.url);
const inventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
const editorRoot = new URL('../../../../', import.meta.url);
const implementedBindingTestIds = new Set([
    'sse-provider-clipboard-copy',
    'sse-provider-clipboard-cut',
    'sse-provider-clipboard-paste',
    'sse-provider-history-redo',
    'sse-provider-history-undo',
    'sse-provider-text-bold',
    'sse-provider-text-italic',
]);

const extractDesktopSurfaceKeys = source => {
    const keys = new Set();
    for (const pattern of [
        /\baction\s*:\s*['"]([^'"]+)['"]/g,
        /\bid\s*:\s*['"]((?:id-|tlbtn|toolbar-menu)[^'"]+)['"]/g,
    ]) {
        for (const match of source.matchAll(pattern)) keys.add(match[1]);
    }
    return [...keys].sort();
};

test('spreadsheet inventory is locked to the audited Desktop sources', async () => {
    assert.equal(inventory.schemaVersion, 1);
    assert.equal(inventory.editor, 'spreadsheet');
    assert.equal(inventory.source.commit, '9c0ca538c3b211052347df09d2a4d6781f023403');
    assert.equal(inventory.source.hashNormalization, 'text-lf');

    for (const source of inventory.source.files) {
        const content = (await readFile(new URL(source.path, editorRoot), 'utf8')).replace(/\r\n?/g, '\n');
        assert.equal(createHash('sha256').update(content).digest('hex'), source.sha256, source.path);
    }
});

test('spreadsheet inventory maps every entry to a catalog command or ADR exclusion', () => {
    assert.ok(inventory.entries.length >= 60);
    assert.equal(new Set(inventory.entries.map(entry => `${entry.desktopSource}|${entry.desktopKey}`)).size, inventory.entries.length);
    const commandsById = new Map(inventory.commands.map(command => [command.id, command]));
    const commandIds = new Set(commandsById.keys());
    const permissionProfiles = new Set(['view', 'edit', 'review', 'comment', 'fillForms']);
    assert.equal(commandIds.size, inventory.commands.length);

    for (const command of inventory.commands) {
        assert.match(command.id, /^spreadsheet\./);
        assert.ok(command.contexts.length > 0);
        assert.ok(command.permissions.length > 0);
        assert.ok(command.permissions.every(permission => permissionProfiles.has(permission)));
        assert.ok(command.mobilePath);
        assert.ok(command.testIds.length > 0, command.id);
        assert.ok(command.testIds.every(testId => typeof testId === 'string' && testId.length > 0));
        if (command.implementation === 'implemented') {
            assert.ok(command.testIds.every(testId => implementedBindingTestIds.has(testId)), command.id);
        } else {
            assert.ok(command.testIds.every(testId => /^sse-issue-8-(?:desktop-)?[a-z0-9-]+$/.test(testId)), command.id);
        }
        assert.ok(['implemented', 'planned'].includes(command.implementation));
        if (command.implementation === 'implemented') assert.ok(command.binding && command.binding.method);
        else assert.equal(command.binding, null);
    }

    for (const entry of inventory.entries) {
        assert.ok(entry.desktopKey);
        assert.ok(entry.desktopSource);
        if (entry.disposition === 'catalog') {
            assert.match(entry.commandId, /^spreadsheet\./);
            assert.ok(commandIds.has(entry.commandId), `${entry.desktopKey}: ${entry.commandId}`);
            assert.ok(entry.contexts.length > 0);
            assert.ok(entry.permissions.length > 0);
            assert.ok(entry.permissions.every(permission => permissionProfiles.has(permission)));
            assert.ok(entry.mobilePath);
            const command = commandsById.get(entry.commandId);
            assert.deepEqual(entry.contexts, command.contexts, entry.commandId);
            assert.deepEqual(entry.permissions, command.permissions, entry.commandId);
            assert.equal(entry.mobilePath, command.mobilePath, entry.commandId);
        } else {
            assert.equal(entry.disposition, 'excluded');
            assert.match(entry.adr, /^ADR-\d{4}$/);
            assert.ok(entry.reason);
        }
    }
});

test('spreadsheet inventory covers every locked Desktop command surface', async () => {
    for (const sourceFile of inventory.source.files) {
        const source = await readFile(new URL(sourceFile.path, editorRoot), 'utf8');
        const inventoryKeys = inventory.entries
            .filter(entry => entry.desktopSource === sourceFile.path)
            .map(entry => entry.desktopKey)
            .sort();
        assert.deepEqual(inventoryKeys, extractDesktopSurfaceKeys(source), sourceFile.path);
    }
});

test('spreadsheet provider implements the shared Runtime adapter contract and first SDKJS bindings', () => {
    const calls = [];
    const selection = { type: 'cell' };
    const api = {
        asc_getCellInfo: () => selection,
        asc_Undo: (...args) => calls.push(['asc_Undo', ...args]),
        asc_Redo: (...args) => calls.push(['asc_Redo', ...args]),
        asc_Cut: (...args) => calls.push(['asc_Cut', ...args]),
        asc_Copy: (...args) => calls.push(['asc_Copy', ...args]),
        asc_Paste: (...args) => calls.push(['asc_Paste', ...args]),
        asc_setCellBold: (...args) => calls.push(['asc_setCellBold', ...args]),
        asc_setCellItalic: (...args) => calls.push(['asc_setCellItalic', ...args]),
        asc_addComment: (...args) => calls.push(['asc_addComment', ...args]),
        asc_registerCallback() {},
        asc_unregisterCallback() {},
    };
    const provider = createSpreadsheetCommandProvider({ inventory, getApi: () => api });

    for (const method of [
        'getSelectionSnapshot',
        'subscribeState',
        'getCommandDescriptors',
        'execute',
        'resolveContextMenu',
        'captureViewState',
        'restoreViewState',
    ]) assert.equal(typeof provider[method], 'function', method);

    assert.equal(provider.execute('spreadsheet.history.undo'), 1);
    assert.equal(provider.execute('spreadsheet.history.redo'), 2);
    assert.equal(provider.execute('spreadsheet.clipboard.copy'), 3);
    assert.equal(provider.execute('spreadsheet.clipboard.cut'), 4);
    assert.equal(provider.execute('spreadsheet.clipboard.paste'), 5);
    assert.equal(provider.execute('spreadsheet.text.bold', { value: true }), 6);
    assert.equal(provider.execute('spreadsheet.text.italic', { value: false }), 7);
    const comment = { text: 'runtime comment' };
    assert.equal(provider.execute('common.comment.add', { comment }), 8);
    assert.deepEqual(calls, [
        ['asc_Undo'],
        ['asc_Redo'],
        ['asc_Copy'],
        ['asc_Cut'],
        ['asc_Paste'],
        ['asc_setCellBold', true],
        ['asc_setCellItalic', false],
        ['asc_addComment', comment],
    ]);
    assert.deepEqual(
        new Set(inventory.commands.filter(command => command.implementation === 'implemented').flatMap(command => command.testIds)),
        implementedBindingTestIds,
    );

    assert.equal(provider.getSelectionSnapshot(), selection);
    assert.deepEqual(provider.resolveContextMenu({ commands: ['copy'] }), ['copy']);
    assert.equal(typeof provider.subscribeState(() => {}), 'function');
    assert.equal(provider.captureViewState(), null);
    assert.doesNotThrow(() => provider.restoreViewState({ scrollTop: 20 }));

    const descriptors = provider.getCommandDescriptors();
    assert.equal(descriptors.length, 8);
    assert.equal(descriptors.find(command => command.id === 'spreadsheet.clipboard.copy').permission, 'view');
    assert.equal(descriptors.find(command => command.id === 'common.comment.add').permission, 'comment');
    assert.throws(
        () => provider.execute('spreadsheet.insert.chart'),
        error => error.code === 'MOBILE_COMMAND_NOT_IMPLEMENTED',
    );
    assert.throws(
        () => provider.execute('spreadsheet.missing'),
        error => error.code === 'MOBILE_COMMAND_NOT_FOUND',
    );
});

test('spreadsheet Runtime owns lifecycle callbacks, permissions, and disposal', () => {
    const callbacks = new Map();
    const comments = [];
    const api = {
        asc_registerCallback(name, callback) {
            callbacks.set(name, callback);
        },
        asc_unregisterCallback(name, callback) {
            if (callbacks.get(name) === callback) callbacks.delete(name);
        },
        asc_addComment(comment) {
            comments.push(comment);
        },
    };

    const runtime = initializeSpreadsheetEditorRuntime({ inventory, getApi: () => api });
    assert.deepEqual([...callbacks.keys()].sort(), [
        'asc_onDocumentOpenStateChanged',
        'asc_onServerSaveStateChanged',
        'asc_onTransportStateChanged',
    ]);

    callbacks.get('asc_onTransportStateChanged')({ state: 'connected' });
    callbacks.get('asc_onDocumentOpenStateChanged')({ phase: 'ready' });
    assert.equal(runtime.resolve('common.comment.add').reason, 'permission-denied');

    updateSpreadsheetEditorPermissions({ edit: true, comment: true });
    const comment = { text: 'allowed' };
    runtime.execute('common.comment.add', { comment });
    callbacks.get('asc_onServerSaveStateChanged')({ state: 'accepted', scope: 'coauthoring-server' });

    assert.deepEqual(comments, [comment]);
    assert.deepEqual(runtime.getSession(), {
        open: { phase: 'ready' },
        transport: { state: 'connected' },
        save: { state: 'accepted', scope: 'coauthoring-server' },
    });

    disposeSpreadsheetEditorRuntime();
    assert.equal(callbacks.size, 0);
    assert.throws(
        () => runtime.getSession(),
        error => error.code === 'MOBILE_RUNTIME_DISPOSED',
    );
});

test('spreadsheet EditorUIController facade preserves the current Mobile contract', () => {
    const provider = createSpreadsheetCommandProvider({ inventory, getApi: () => null });
    const facade = createEditorUIControllerFacade(provider);

    assert.equal(facade.isSupportEditFeature(), false);
    assert.equal(facade.getCommandProvider(), provider);
    assert.equal(typeof facade.initCellInfo, 'function');
    assert.equal(typeof facade.initEditorStyles, 'function');
    assert.equal(typeof facade.initFonts, 'function');
    assert.equal(typeof facade.initThemeColors, 'function');
    assert.equal(typeof facade.toolbarOptions.getUndoRedo, 'function');
    assert.equal(typeof facade.toolbarOptions.getEditOptions, 'function');
    assert.equal(typeof facade.ContextMenu.mapMenuItems, 'function');
    assert.equal(typeof facade.ContextMenu.handleMenuItemClick, 'function');
});
