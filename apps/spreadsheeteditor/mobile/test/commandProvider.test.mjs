import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
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
    'sse-issue-8-context-cell-clear',
    'sse-issue-8-context-cell-autofill',
    'sse-issue-8-context-cell-delete',
    'sse-issue-8-context-cell-insert',
    'sse-issue-8-context-cell-merge',
    'sse-issue-8-context-column-hide',
    'sse-issue-8-context-column-show',
    'sse-issue-8-context-object-delete',
    'sse-issue-8-context-row-hide',
    'sse-issue-8-context-row-show',
    'sse-issue-8-desktop-decrease-font',
    'sse-issue-8-desktop-halign',
    'sse-issue-8-desktop-increase-font',
    'sse-issue-8-desktop-strikeout',
    'sse-issue-8-desktop-subscript',
    'sse-issue-8-desktop-underline',
    'sse-issue-8-desktop-valign',
    'sse-issue-8-desktop-wrap-text',
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
    assert.equal(inventory.schemaVersion, 2);
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
        if (command.aliasOf) {
            assert.ok(commandIds.has(command.aliasOf), `${command.id}: ${command.aliasOf}`);
            assert.notEqual(command.aliasOf, command.id);
        }
        if (command.implementation === 'implemented') {
            assert.ok(command.binding && command.binding.method);
            assert.equal(command.binding.kind, 'sdk');
        } else {
            assert.equal(command.binding, null);
        }
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
        asc_decreaseFontSize: (...args) => calls.push(['asc_decreaseFontSize', ...args]),
        asc_increaseFontSize: (...args) => calls.push(['asc_increaseFontSize', ...args]),
        asc_setCellAlign: (...args) => calls.push(['asc_setCellAlign', ...args]),
        asc_setCellStrikeout: (...args) => calls.push(['asc_setCellStrikeout', ...args]),
        asc_setCellSubscript: (...args) => calls.push(['asc_setCellSubscript', ...args]),
        asc_setCellTextWrap: (...args) => calls.push(['asc_setCellTextWrap', ...args]),
        asc_setCellUnderline: (...args) => calls.push(['asc_setCellUnderline', ...args]),
        asc_setCellVertAlign: (...args) => calls.push(['asc_setCellVertAlign', ...args]),
        asc_emptyCells: (...args) => calls.push(['asc_emptyCells', ...args]),
        asc_fillHandleDone: (...args) => calls.push(['asc_fillHandleDone', ...args]),
        asc_deleteCells: (...args) => calls.push(['asc_deleteCells', ...args]),
        asc_insertCells: (...args) => calls.push(['asc_insertCells', ...args]),
        asc_mergeCells: (...args) => calls.push(['asc_mergeCells', ...args]),
        asc_hideColumns: (...args) => calls.push(['asc_hideColumns', ...args]),
        asc_showColumns: (...args) => calls.push(['asc_showColumns', ...args]),
        asc_hideRows: (...args) => calls.push(['asc_hideRows', ...args]),
        asc_showRows: (...args) => calls.push(['asc_showRows', ...args]),
        asc_Remove: (...args) => calls.push(['asc_Remove', ...args]),
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
    assert.equal(provider.execute('spreadsheet.desktop.decrease-font'), 8);
    assert.equal(provider.execute('spreadsheet.desktop.halign', {value: 2}), 9);
    assert.equal(provider.execute('spreadsheet.desktop.increase-font'), 10);
    assert.equal(provider.execute('spreadsheet.desktop.strikeout', {value: true}), 11);
    assert.equal(provider.execute('spreadsheet.desktop.subscript', {value: false}), 12);
    assert.equal(provider.execute('spreadsheet.desktop.underline', {value: true}), 13);
    assert.equal(provider.execute('spreadsheet.desktop.valign', {value: 1}), 14);
    assert.equal(provider.execute('spreadsheet.desktop.wrap-text', {value: true}), 15);
    assert.equal(provider.execute('spreadsheet.cell.clear', {args: [10, false]}), 16);
    assert.equal(provider.execute('spreadsheet.cell.delete', {value: 20}), 17);
    assert.equal(provider.execute('spreadsheet.cell.insert', {value: 30}), 18);
    assert.equal(provider.execute('spreadsheet.cell.merge', {value: 40}), 19);
    assert.equal(provider.execute('spreadsheet.column.hide'), 20);
    assert.equal(provider.execute('spreadsheet.column.show'), 21);
    assert.equal(provider.execute('spreadsheet.row.hide'), 22);
    assert.equal(provider.execute('spreadsheet.row.show'), 23);
    assert.equal(provider.execute('spreadsheet.object.delete'), 24);
    assert.equal(provider.execute('spreadsheet.cell.autofill'), 25);
    const comment = { text: 'runtime comment' };
    assert.equal(provider.execute('common.comment.add', { comment }), 26);
    assert.deepEqual(calls, [
        ['asc_Undo'],
        ['asc_Redo'],
        ['asc_Copy'],
        ['asc_Cut'],
        ['asc_Paste'],
        ['asc_setCellBold', true],
        ['asc_setCellItalic', false],
        ['asc_decreaseFontSize'],
        ['asc_setCellAlign', 2],
        ['asc_increaseFontSize'],
        ['asc_setCellStrikeout', true],
        ['asc_setCellSubscript', false],
        ['asc_setCellUnderline', true],
        ['asc_setCellVertAlign', 1],
        ['asc_setCellTextWrap', true],
        ['asc_emptyCells', 10, false],
        ['asc_deleteCells', 20],
        ['asc_insertCells', 30],
        ['asc_mergeCells', 40],
        ['asc_hideColumns'],
        ['asc_showColumns'],
        ['asc_hideRows'],
        ['asc_showRows'],
        ['asc_Remove'],
        ['asc_fillHandleDone'],
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
    assert.equal(descriptors.length, 26);
    assert.deepEqual(
        descriptors.find(command => command.id === 'spreadsheet.clipboard.copy'),
        {
            id: 'spreadsheet.clipboard.copy',
            permission: 'view',
            contexts: ['cell', 'object', 'text'],
            mobilePath: 'context.copy',
            mutates: false,
        },
    );
    assert.deepEqual(descriptors.find(command => command.id === 'common.comment.add'), {
        id: 'common.comment.add',
        permission: 'comment',
        mutates: true,
    });
    assert.throws(
        () => provider.execute('spreadsheet.insert.chart'),
        error => error.code === 'MOBILE_COMMAND_NOT_IMPLEMENTED',
    );
    assert.throws(
        () => provider.execute('spreadsheet.missing'),
        error => error.code === 'MOBILE_COMMAND_NOT_FOUND',
    );
});

test('spreadsheet inventory collapses audited Desktop aliases without duplicate bindings', () => {
    const aliases = Object.fromEntries(inventory.commands
        .filter(command => command.aliasOf)
        .map(command => [command.id, command.aliasOf]));

    assert.deepEqual(aliases, {
        'spreadsheet.desktop.insertsmartart': 'spreadsheet.desktop.insert-smartart',
        'spreadsheet.desktop.insertsymbol': 'spreadsheet.desktop.insert-symbol',
        'spreadsheet.desktop.pagebreak': 'spreadsheet.desktop.page-break',
        'spreadsheet.desktop.pagemargins': 'spreadsheet.desktop.page-margins',
        'spreadsheet.desktop.pageorient': 'spreadsheet.desktop.page-orient',
        'spreadsheet.desktop.pagesize': 'spreadsheet.desktop.page-size',
        'spreadsheet.desktop.printarea': 'spreadsheet.desktop.print-area',
        'spreadsheet.desktop.recommended-chart': 'spreadsheet.insert.chart',
        'spreadsheet.desktop.save-2': 'spreadsheet.desktop.save',
    });
});

test('spreadsheet descriptors preserve any-of permission profiles', () => {
    const provider = createSpreadsheetCommandProvider({
        inventory: {
            editor: 'spreadsheet',
            commands: [{
                id: 'spreadsheet.review.accept',
                contexts: ['cell'],
                permissions: ['edit', 'review'],
                implementation: 'implemented',
                binding: {kind: 'sdk', method: 'asc_AcceptChanges'},
                mobilePath: 'review.accept',
                mutates: true,
            }],
        },
        getApi: () => ({asc_AcceptChanges() {}}),
    });

    assert.deepEqual(provider.getCommandDescriptors().find(command => command.id === 'spreadsheet.review.accept'), {
        id: 'spreadsheet.review.accept',
        permissionsAny: ['edit', 'review'],
        contexts: ['cell'],
        mobilePath: 'review.accept',
        mutates: true,
    });
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

test('spreadsheet Runtime keeps copy available while freezing clipboard mutations', () => {
    const callbacks = new Map();
    const calls = [];
    const api = {
        asc_registerCallback: (name, callback) => callbacks.set(name, callback),
        asc_unregisterCallback: name => callbacks.delete(name),
        asc_Copy: () => calls.push('copy'),
        asc_Cut: () => calls.push('cut'),
    };

    const runtime = initializeSpreadsheetEditorRuntime({inventory, getApi: () => api});
    assert.equal(runtime.resolve('spreadsheet.clipboard.copy').available, true);
    runtime.execute('spreadsheet.clipboard.copy');

    updateSpreadsheetEditorPermissions({edit: true});
    assert.deepEqual(runtime.resolve('spreadsheet.clipboard.cut'), {
        id: 'spreadsheet.clipboard.cut',
        permission: 'edit',
        contexts: ['cell', 'object', 'text'],
        mobilePath: 'context.cut',
        mutates: true,
        available: false,
        reason: 'session-frozen',
        freezeReason: 'open-idle',
    });
    assert.throws(
        () => runtime.execute('spreadsheet.clipboard.cut'),
        error => error.code === 'MOBILE_COMMAND_SESSION_FROZEN',
    );

    callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
    callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    runtime.execute('spreadsheet.clipboard.cut');
    assert.deepEqual(calls, ['copy', 'cut']);
    disposeSpreadsheetEditorRuntime();
});
