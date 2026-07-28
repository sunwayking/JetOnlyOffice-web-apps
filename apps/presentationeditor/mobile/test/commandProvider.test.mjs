import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    createEditorUIControllerFacade,
    createPresentationCommandProvider,
} from '../src/lib/commandProvider.mjs';

const inventoryUrl = new URL('../src/commands/desktop-command-inventory.json', import.meta.url);
const inventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
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

    for (const source of inventory.source.files) {
        const content = await readFile(new URL(source.path, editorRoot));
        assert.equal(createHash('sha256').update(content).digest('hex'), source.sha256, source.path);
    }
});

test('presentation inventory maps every entry to a catalog command or ADR exclusion', () => {
    assert.ok(inventory.entries.length >= 80);
    assert.equal(new Set(inventory.entries.map(entry => entry.desktopKey)).size, inventory.entries.length);
    const commandIds = new Set(inventory.commands.map(command => command.id));
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
        if (command.implementation === 'implemented') assert.ok(command.binding && command.binding.method);
        else assert.equal(command.binding, null);
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
        } else {
            assert.equal(entry.disposition, 'excluded');
            assert.match(entry.adr, /^ADR-\d{4}$/);
            assert.ok(entry.reason);
        }
    }
});

test('presentation inventory covers every locked Desktop toolbar surface', async () => {
    const viewSource = inventory.source.files.find(source => source.path.endsWith('/view/Toolbar.js'));
    const source = await readFile(new URL(viewSource.path, editorRoot), 'utf8');
    const inventoryKeys = inventory.entries
        .filter(entry => entry.desktopSource === viewSource.path)
        .map(entry => entry.desktopKey)
        .sort();

    assert.deepEqual(inventoryKeys, extractDesktopSurfaceKeys(source));
});

test('presentation provider implements the shared Runtime adapter contract and first SDKJS bindings', () => {
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
    };
    const provider = createPresentationCommandProvider({ inventory, getApi: () => api });

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
    assert.equal(provider.execute('presentation.text.bold', { value: true }), 2);
    assert.deepEqual(calls, [
        ['Undo'],
        ['put_TextPrBold', true],
    ]);

    assert.equal(provider.getSelectionSnapshot(), selection);
    assert.deepEqual(provider.resolveContextMenu({ commands: ['copy'] }), ['copy']);
    assert.equal(typeof provider.subscribeState(() => {}), 'function');
    assert.equal(provider.captureViewState(), null);
    assert.doesNotThrow(() => provider.restoreViewState({ slide: 4 }));

    const descriptors = provider.getCommandDescriptors();
    assert.equal(descriptors.length, 7);
    assert.equal(descriptors.find(command => command.id === 'presentation.clipboard.copy').permission, 'view');
    assert.throws(
        () => provider.execute('presentation.insert.chart'),
        error => error.code === 'MOBILE_COMMAND_NOT_IMPLEMENTED',
    );
    assert.throws(
        () => provider.execute('presentation.missing'),
        error => error.code === 'MOBILE_COMMAND_NOT_FOUND',
    );
});

test('presentation EditorUIController facade preserves the current Mobile contract', () => {
    const provider = createPresentationCommandProvider({ inventory, getApi: () => null });
    const facade = createEditorUIControllerFacade(provider);

    assert.equal(facade.isSupportEditFeature(), false);
    assert.equal(facade.getCommandProvider(), provider);
    assert.equal(typeof facade.initFocusObjects, 'function');
    assert.equal(typeof facade.initEditorStyles, 'function');
    assert.equal(typeof facade.initFonts, 'function');
    assert.equal(typeof facade.initTableTemplates, 'function');
    assert.equal(typeof facade.initThemeColors, 'function');
    assert.equal(typeof facade.updateChartStyles, 'function');
    assert.equal(typeof facade.getUndoRedo, 'function');
    assert.equal(typeof facade.getToolbarOptions, 'function');
    assert.equal(typeof facade.getEditCommentControllers, 'function');
    assert.equal(typeof facade.ContextMenu.mapMenuItems, 'function');
    assert.equal(typeof facade.ContextMenu.handleMenuItemClick, 'function');
});
