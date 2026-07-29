import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import test from 'node:test';

import {
    createPresentationCommandInventory,
    getPresentationCommandSpecByMethod,
    PRESENTATION_COMMAND_SPECS,
} from '../src/lib/presentationCommandCatalog.mjs';
import {createPresentationEditorApiGate} from '../src/lib/presentationEditorApiGate.mjs';

const inventoryUrl = new URL('../src/commands/desktop-command-inventory.json', import.meta.url);
const auditedInventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
const presentationCommandInventory = createPresentationCommandInventory(auditedInventory);

test('presentation catalog keeps every audited and SDK command uniquely testable', () => {
    assert.ok(presentationCommandInventory.commands.length > auditedInventory.commands.length);
    assert.equal(
        new Set(presentationCommandInventory.commands.map(command => command.id)).size,
        presentationCommandInventory.commands.length,
    );
    assert.ok(presentationCommandInventory.commands.every(command => command.testIds.length > 0));
});

test('presentation release inventory closes every Desktop command with a real binding or ADR exclusion', () => {
    const commandsById = new Map(presentationCommandInventory.commands.map(command => [command.id, command]));
    const allowedExclusions = new Set([
        'presentation.desktop.file-open',
        'presentation.desktop.new',
        'presentation.desktop.recent',
        'presentation.desktop.rights',
    ]);

    assert.deepEqual(
        presentationCommandInventory.commands.filter(command => command.implementation === 'planned').map(command => command.id),
        [],
    );

    const excluded = presentationCommandInventory.commands.filter(command => command.implementation === 'excluded');
    assert.deepEqual(new Set(excluded.map(command => command.id)), allowedExclusions);
    for (const command of excluded) {
        assert.equal(command.binding, null);
        assert.equal(command.exclusion?.adr, 'ADR-0040');
        assert.ok(command.exclusion?.reason);
    }

    for (const command of presentationCommandInventory.commands.filter(command => command.implementation === 'implemented')) {
        assert.ok(['sdk', 'alias', 'controller'].includes(command.binding?.kind), command.id);
        if (command.binding.kind === 'alias') {
            const target = commandsById.get(command.binding.commandId);
            assert.equal(target?.implementation, 'implemented', command.id);
            assert.notEqual(target?.id, command.id);
        }
        if (command.binding.kind === 'controller') {
            assert.ok(command.binding.action, command.id);
            assert.notEqual(command.mobilePath, 'more.command-search', command.id);
        }
    }

    for (const entry of presentationCommandInventory.entries) {
        if (!entry.commandId) {
            assert.equal(entry.disposition, 'excluded', entry.desktopKey);
            assert.ok(entry.adr, entry.desktopKey);
            continue;
        }
        const command = commandsById.get(entry.commandId);
        if (command?.implementation === 'excluded') {
            assert.equal(entry.disposition, 'excluded', entry.desktopKey);
            assert.equal(entry.adr, command.exclusion.adr, entry.desktopKey);
        } else {
            assert.equal(entry.disposition, 'catalog', entry.desktopKey);
        }
    }
});

test('presentation catalog gates every SDKJS mutation used by the Mobile UI', () => {
    for (const method of [
        'AddSlide',
        'ChangeLayout',
        'ChangeTheme',
        'ChartApply',
        'DeleteSlide',
        'DublicateSlide',
        'SetSlideProps',
        'ShapeApply',
        'SlideTransitionApplyToAll',
        'asc_Remove',
        'asc_Save',
        'asc_DistributeTableCells',
        'asc_addImage',
        'asc_undoAllChanges',
        'asc_replaceText',
        'changeSlideSize',
        'put_Table',
        'put_TextPrBold',
        'shapes_bringToFront',
        'setVerticalAlign',
        'tblApply',
    ]) {
        const spec = getPresentationCommandSpecByMethod(method);
        assert.ok(spec, method);
        assert.equal(spec.binding.method, method);
        assert.equal(spec.mutates, true, method);
    }
});

test('session commands remain available to every profile that can mutate a presentation', () => {
    const expectedProfiles = ['edit', 'review', 'comment', 'fillForms'];
    for (const id of [
        'presentation.history.undo',
        'presentation.history.redo',
        'presentation.desktop.save',
        'presentation.sdk.undo-all-changes',
    ]) {
        const command = presentationCommandInventory.commands.find(item => item.id === id);
        assert.deepEqual(command.permissions, expectedProfiles, id);
    }
});

test('presentation Mobile API calls are classified as commands or read-only infrastructure', async () => {
    const sourceRoot = new URL('../src/', import.meta.url);
    const sourceFiles = (await readdir(sourceRoot, {recursive: true}))
        .filter(relativePath => /\.(?:js|jsx)$/.test(relativePath));
    const methods = new Set();
    const apiCallPattern = /(?:\bapi|Common\.EditorApi\.get\(\))\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    for (const relativePath of sourceFiles) {
        const sourceUrl = new URL(relativePath.replaceAll('\\', '/'), sourceRoot);
        const source = await readFile(sourceUrl, 'utf8');
        for (const match of source.matchAll(apiCallPattern)) methods.add(match[1]);
    }

    const classifiedCommands = new Set(PRESENTATION_COMMAND_SPECS.map(command => command.binding.method));
    const expectedInfrastructure = [
        'DemonstrationEndShowMessage', 'DemonstrationNextSlide', 'DemonstrationPrevSlide',
        'EndDemonstration', 'Resize', 'SetDrawImagePreviewBulletForMenu', 'SetDrawingFreeze',
        'SetFontRenderingMode', 'SetThemesPath', 'asc_DownloadOrigin',
        'asc_GetCurrentColorSchemeIndex', 'asc_GetDefaultTableStyles', 'asc_GoToInternalHyperlink',
        'asc_LoadDocument', 'asc_SetDocumentUnits', 'asc_SetFastCollaborative',
        'asc_SetThumbnailsPosition', 'asc_coAuthoringDisconnect', 'asc_continueSaving',
        'asc_enableKeyEvents', 'asc_findText', 'asc_getAppProps', 'asc_getChartPreviews',
        'asc_getCoreProps', 'asc_getCropOriginalImageSize', 'asc_getEditorPermissions',
        'asc_getTableStylesPreviews', 'asc_getUrlType', 'asc_isAnonymousSupport',
        'asc_isDocumentCanSave', 'asc_isOffline', 'asc_refreshFile', 'asc_registerCallback',
        'asc_runAutostartMacroses', 'asc_selectSearchingResults', 'asc_setAdvancedOptions',
        'asc_setAutoSaveGap', 'asc_setDemoBackgroundColor', 'asc_setDocInfo', 'asc_setLocale',
        'asc_setRestriction', 'asc_setSpellCheck', 'asc_setViewMode', 'asc_stopSaving',
        'asc_unregisterCallback', 'asc_wopi_renameFile', 'can_AddHyperlink',
        'can_AddQuotedComment', 'can_CopyCut', 'getCountPages', 'getSelectedElements',
        'get_PresentationHeight', 'get_PresentationWidth', 'isDocumentModified', 'zoom',
        'zoomFitToPage', 'zoomFitToWidth',
    ];
    assert.deepEqual(
        [...methods].filter(method => !classifiedCommands.has(method)).sort(),
        expectedInfrastructure.sort(),
    );
});

test('Main routes every classified mutation through the Mobile API gate', async () => {
    const source = await readFile(new URL('../src/controller/Main.jsx', import.meta.url), 'utf8');
    const rawApiCallPattern = /\bthis\.api\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    const bypassedMutations = [...source.matchAll(rawApiCallPattern)]
        .map(match => match[1])
        .filter(method => getPresentationCommandSpecByMethod(method)?.mutates === true);

    assert.deepEqual(bypassedMutations, []);
});

test('presentation API gate routes catalog mutations and preserves read-only SDK calls', () => {
    const calls = [];
    const rawApi = {
        AddSlide: () => assert.fail('raw mutation bypassed Runtime'),
        getCountPages: () => 12,
    };
    const getApi = createPresentationEditorApiGate({
        getRawApi: () => rawApi,
        executeCommand: (id, payload) => calls.push([id, payload]),
    });

    const api = getApi();
    api.AddSlide(4);
    assert.equal(api.getCountPages(), 12);
    assert.deepEqual(calls, [[
        getPresentationCommandSpecByMethod('AddSlide').id,
        {args: [4]},
    ]]);
    assert.equal(getApi(), api);
    assert.ok(PRESENTATION_COMMAND_SPECS.length > 50);
});
