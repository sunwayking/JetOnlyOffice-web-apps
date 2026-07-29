import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    createPresentationCommandProvider,
} from '../src/lib/commandProvider.mjs';
import {createPresentationCommandInventory} from '../src/lib/presentationCommandCatalog.mjs';
import {
    capturePresentationEditorViewState,
    disposePresentationEditorRuntime,
    initializePresentationEditorRuntime,
    restorePresentationEditorViewState,
    subscribePresentationEditorRuntime,
    updatePresentationEditorPermissions,
} from '../src/lib/presentationEditorRuntime.mjs';

const inventoryUrl = new URL('../src/commands/desktop-command-inventory.json', import.meta.url);
const auditedInventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
const inventory = createPresentationCommandInventory(auditedInventory);
const editorRoot = new URL('../../../../', import.meta.url);

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

test('presentation inventory is locked to the audited Desktop sources', async () => {
    assert.equal(inventory.schemaVersion, 1);
    assert.equal(inventory.editor, 'presentation');
    assert.equal(inventory.source.commit, '9c0ca538c3b211052347df09d2a4d6781f023403');
    assert.equal(inventory.source.hashNormalization, 'text-lf');

    for (const source of inventory.source.files) {
        const content = (await readFile(new URL(source.path, editorRoot), 'utf8')).replace(/\r\n?/g, '\n');
        assert.equal(createHash('sha256').update(content).digest('hex'), source.sha256, source.path);
    }
});
test('presentation inventory maps every entry to a catalog command or ADR exclusion', () => {
    assert.ok(inventory.entries.length >= 80);
    assert.equal(new Set(inventory.entries.map(entry => `${entry.desktopSource}|${entry.desktopKey}`)).size, inventory.entries.length);
    const commandsById = new Map(inventory.commands.map(command => [command.id, command]));
    const commandIds = new Set(commandsById.keys());
    const permissionProfiles = new Set(['view', 'edit', 'review', 'comment', 'fillForms']);
    assert.equal(commandIds.size, inventory.commands.length);

    for (const command of inventory.commands) {
        assert.match(command.id, /^presentation\./);
        assert.ok(command.contexts.length > 0);
        assert.ok(command.permissions.length > 0);
        assert.ok(command.permissions.every(permission => permissionProfiles.has(permission)));
        assert.ok(command.mobilePath);
        assert.ok(command.testIds.length > 0, command.id);
        assert.ok(command.testIds.every(testId => typeof testId === 'string' && testId.length > 0));
        assert.ok(['implemented', 'planned'].includes(command.implementation));
        if (command.implementation === 'implemented') {
            assert.equal(command.binding?.kind, 'sdk');
            assert.ok(command.binding.method);
        } else {
            assert.equal(command.binding, null);
        }
    }

    for (const entry of inventory.entries) {
        assert.ok(entry.desktopKey);
        assert.ok(entry.desktopSource);
        if (entry.disposition === 'catalog') {
            assert.match(entry.commandId, /^presentation\./);
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
test('presentation inventory covers every locked Desktop command surface', async () => {
    for (const sourceFile of inventory.source.files) {
        const source = await readFile(new URL(sourceFile.path, editorRoot), 'utf8');
        const inventoryKeys = inventory.entries
            .filter(entry => entry.desktopSource === sourceFile.path)
            .map(entry => entry.desktopKey)
            .sort();
        assert.deepEqual(inventoryKeys, extractDesktopSurfaceKeys(source), sourceFile.path);
    }
});

test('presentation provider implements the shared Runtime adapter contract and verified SDKJS bindings', () => {
    const calls = [];
    const selection = [{ type: 'text' }];
    const api = {
        getSelectedElements: () => selection,
        Undo: (...args) => calls.push(['Undo', ...args]),
        Redo: (...args) => calls.push(['Redo', ...args]),
        Cut: (...args) => calls.push(['Cut', ...args]),
        Copy: (...args) => calls.push(['Copy', ...args]),
        Paste: (...args) => calls.push(['Paste', ...args]),
        put_TextPrBold: (...args) => calls.push(['put_TextPrBold', ...args]),
        put_TextPrItalic: (...args) => calls.push(['put_TextPrItalic', ...args]),
        asc_addComment: (...args) => calls.push(['asc_addComment', ...args]),
        asc_registerCallback() {},
        asc_unregisterCallback() {},
    };
    const provider = createPresentationCommandProvider({inventory, getApi: () => api});

    for (const method of [
        'getSelectionSnapshot',
        'subscribeState',
        'getCommandDescriptors',
        'execute',
        'resolveContextMenu',
        'captureViewState',
        'restoreViewState',
    ]) assert.equal(typeof provider[method], 'function', method);

    assert.equal(provider.execute('presentation.history.undo'), 1);
    assert.equal(provider.execute('presentation.history.redo'), 2);
    assert.equal(provider.execute('presentation.clipboard.copy'), 3);
    assert.equal(provider.execute('presentation.clipboard.cut'), 4);
    assert.equal(provider.execute('presentation.clipboard.paste'), 5);
    assert.equal(provider.execute('presentation.text.bold', { value: true }), 6);
    assert.equal(provider.execute('presentation.text.italic', { value: false }), 7);
    const comment = { text: 'runtime comment' };
    assert.equal(provider.execute('common.comment.add', { comment }), 8);
    assert.deepEqual(calls, [
        ['Undo'],
        ['Redo'],
        ['Copy'],
        ['Cut'],
        ['Paste'],
        ['put_TextPrBold', true],
        ['put_TextPrItalic', false],
        ['asc_addComment', comment],
    ]);
    assert.equal(provider.getSelectionSnapshot(), selection);
    assert.deepEqual(provider.resolveContextMenu({ commands: ['copy'] }), ['copy']);
    assert.equal(typeof provider.subscribeState(() => {}), 'function');
    assert.equal(provider.captureViewState(), null);
    assert.doesNotThrow(() => provider.restoreViewState({ slide: 4 }));

    const descriptors = provider.getCommandDescriptors();
    assert.equal(
        descriptors.length,
        inventory.commands.filter(command => command.implementation === 'implemented').length + 1,
    );
    assert.deepEqual(
        descriptors.find(command => command.id === 'presentation.clipboard.copy').permissionsAny,
        ['view', 'edit', 'review', 'comment', 'fillForms'],
    );
    assert.equal(descriptors.find(command => command.id === 'presentation.clipboard.copy').mutates, false);
    assert.equal(descriptors.find(command => command.id === 'common.comment.add').permission, 'comment');
    assert.throws(
        () => provider.execute('presentation.desktop.about'),
        error => error.code === 'MOBILE_COMMAND_NOT_IMPLEMENTED',
    );
    assert.throws(
        () => provider.execute('presentation.insert.chart'),
        error => error.code === 'MOBILE_COMMAND_BINDING_UNAVAILABLE',
    );
    assert.throws(
        () => provider.execute('presentation.missing'),
        error => error.code === 'MOBILE_COMMAND_NOT_FOUND',
    );
});

test('presentation Runtime owns lifecycle callbacks, permissions, and disposal', () => {
    const callbacks = new Map();
    const comments = [];
    let copyCount = 0;
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
        Copy() {
            copyCount += 1;
        },
    };

    const runtime = initializePresentationEditorRuntime({ inventory, getApi: () => api });
    assert.deepEqual([...callbacks.keys()].sort(), [
        'asc_onDocumentOpenStateChanged',
        'asc_onServerSaveStateChanged',
        'asc_onTransportStateChanged',
    ]);

    callbacks.get('asc_onTransportStateChanged')({ state: 'connected' });
    callbacks.get('asc_onDocumentOpenStateChanged')({ phase: 'ready' });
    assert.equal(runtime.resolve('presentation.clipboard.copy').available, true);
    runtime.execute('presentation.clipboard.copy');
    assert.equal(copyCount, 1);
    assert.equal(runtime.resolve('common.comment.add').reason, 'permission-denied');

    updatePresentationEditorPermissions({ edit: true, comment: true });
    const comment = { text: 'allowed' };
    runtime.execute('common.comment.add', { comment });
    callbacks.get('asc_onServerSaveStateChanged')({ state: 'accepted', scope: 'coauthoring-server' });

    assert.deepEqual(comments, [comment]);
    assert.deepEqual(runtime.getSession(), {
        open: { phase: 'ready' },
        transport: { state: 'connected' },
        save: { state: 'accepted', scope: 'coauthoring-server' },
    });

    disposePresentationEditorRuntime();
    assert.equal(callbacks.size, 0);
    assert.throws(
        () => runtime.getSession(),
        error => error.code === 'MOBILE_RUNTIME_DISPOSED',
    );
});

test('presentation Runtime delegates view-state capture and restore to its adapter', () => {
    const selection = {CurPage: 6, slideSelection: {selectedObjects: ['image-2']}};
    const state = {
        slide: 6,
        selection,
        ui: {panel: 'edit', route: '/edit-replace-image/', scroll: {x: 0, y: 180}},
    };
    const restored = [];
    const api = {
        asc_registerCallback() {},
        asc_unregisterCallback() {},
    };

    initializePresentationEditorRuntime({
        inventory,
        getApi: () => api,
        captureViewState: () => state,
        restoreViewState: value => restored.push(value),
    });

    assert.equal(capturePresentationEditorViewState(), state);
    restorePresentationEditorViewState(state);
    assert.deepEqual(restored, [state]);
    disposePresentationEditorRuntime();
});

test('presentation Runtime publishes creation, permission changes, and disposal to command search', () => {
    const published = [];
    const detach = subscribePresentationEditorRuntime(runtime => published.push(runtime));
    const api = {
        asc_registerCallback() {},
        asc_unregisterCallback() {},
    };

    const runtime = initializePresentationEditorRuntime({inventory, getApi: () => api});
    updatePresentationEditorPermissions({edit: true});
    disposePresentationEditorRuntime();
    detach();

    assert.deepEqual(published, [null, runtime, runtime, null]);
});
