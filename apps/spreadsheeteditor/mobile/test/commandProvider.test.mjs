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
const implementedBindingTestIds = new Set(inventory.commands
    .filter(command => command.implementation === 'implemented')
    .flatMap(command => command.testIds));
const closureBindings = {
    'spreadsheet.desktop.accounting-style': 'asc_setCellStyle',
    'spreadsheet.desktop.auto-filter': 'asc_addAutoFilter',
    'spreadsheet.desktop.autosum': 'asc_insertInCell',
    'spreadsheet.desktop.calculate': 'asc_calculate',
    'spreadsheet.desktop.case': 'asc_ChangeTextCase',
    'spreadsheet.desktop.cell-group': 'asc_group',
    'spreadsheet.desktop.cell-borders': 'asc_setCellBorders',
    'spreadsheet.desktop.cell-style': 'asc_setCellStyle',
    'spreadsheet.desktop.cell-ungroup': 'asc_ungroup',
    'spreadsheet.desktop.change-case': 'asc_ChangeTextCase',
    'spreadsheet.desktop.clear-filter': 'asc_clearFilter',
    'spreadsheet.desktop.clear-style': 'asc_emptyCells',
    'spreadsheet.desktop.comma-style': 'asc_setCellStyle',
    'spreadsheet.desktop.copy-style': 'asc_formatPainter',
    'spreadsheet.desktop.decrease-decimal': 'asc_decreaseCellDigitNumbers',
    'spreadsheet.desktop.direction': 'asc_setCellReadingOrder',
    'spreadsheet.desktop.fill-color': 'asc_setCellBackgroundColor',
    'spreadsheet.desktop.font-color': 'asc_setCellTextColor',
    'spreadsheet.desktop.increase-decimal': 'asc_increaseCellDigitNumbers',
    'spreadsheet.desktop.insert-equation': 'asc_AddMath',
    'spreadsheet.desktop.insert-formula': 'asc_insertInCell',
    'spreadsheet.desktop.insert-image': 'asc_addImage',
    'spreadsheet.desktop.insert-shape': 'asc_addShapeOnSheet',
    'spreadsheet.desktop.insert-table': 'asc_addAutoFilter',
    'spreadsheet.desktop.insert-textart': 'asc_addTextArt',
    'spreadsheet.desktop.object-backward': 'asc_setSelectedDrawingObjectLayer',
    'spreadsheet.desktop.object-align': 'asc_setSelectedDrawingObjectAlign',
    'spreadsheet.desktop.object-forward': 'asc_setSelectedDrawingObjectLayer',
    'spreadsheet.desktop.object-group': 'asc_groupGraphicsObjects',
    'spreadsheet.desktop.page-break': 'asc_InsertPageBreak',
    'spreadsheet.desktop.page-margins': 'asc_changePageMargins',
    'spreadsheet.desktop.page-orient': 'asc_changePageOrient',
    'spreadsheet.desktop.page-scale': 'asc_SetPrintScale',
    'spreadsheet.desktop.page-size': 'asc_changeDocSize',
    'spreadsheet.desktop.percent-style': 'asc_setCellStyle',
    'spreadsheet.desktop.print': 'asc_Print',
    'spreadsheet.desktop.print-area': 'asc_ChangePrintArea',
    'spreadsheet.desktop.save': 'asc_Save',
    'spreadsheet.desktop.select-all': 'asc_EditSelectAll',
    'spreadsheet.desktop.shapes-merge': 'asc_mergeSelectedShapes',
    'spreadsheet.desktop.text-direction': 'asc_setCellReadingOrder',
    'spreadsheet.desktop.text-orientation': 'asc_setCellAngle',
    'spreadsheet.desktop.theme-colors': 'asc_ChangeColorSchemeByIdx',
    'spreadsheet.desktop.visible-area': 'asc_toggleChangeVisibleAreaOleEditor',
    'spreadsheet.desktop.visible-area-close': 'asc_toggleChangeVisibleAreaOleEditor',
    'spreadsheet.desktop.number-fill': 'asc_FillCells',
    'spreadsheet.insert.chart': 'asc_addChartDrawingObject',
};
const closureOperations = {
    'spreadsheet.desktop.auto-filter': {
        toggle: 'asc_changeAutoFilter',
        apply: 'asc_applyAutoFilter',
    },
    'spreadsheet.desktop.insert-image': { url: 'asc_addImageDrawingObject' },
    'spreadsheet.desktop.object-align': {
        'distribute-horizontal': 'asc_DistributeSelectedDrawingObjectHor',
        'distribute-vertical': 'asc_DistributeSelectedDrawingObjectVer',
    },
    'spreadsheet.desktop.object-group': { ungroup: 'asc_unGroupGraphicsObjects' },
    'spreadsheet.desktop.page-break': {
        remove: 'asc_RemovePageBreak',
        reset: 'asc_ResetAllPageBreaks',
    },
    'spreadsheet.desktop.visible-area': {
        show: 'asc_toggleShowVisibleAreaOleEditor',
        hide: 'asc_toggleShowVisibleAreaOleEditor',
    },
};

const remainingSdkBindings = {
    'spreadsheet.desktop.cancel': 'asc_endAddShape',
    'spreadsheet.desktop.conditional-format': 'asc_setCF',
    'spreadsheet.desktop.custom-color': 'asc_setWorksheetTabColor',
    'spreadsheet.desktop.export-pdf': 'asc_DownloadAs',
    'spreadsheet.desktop.formula-datetime': 'asc_insertInCell',
    'spreadsheet.desktop.formula-financial': 'asc_insertInCell',
    'spreadsheet.desktop.formula-logical': 'asc_insertInCell',
    'spreadsheet.desktop.formula-math': 'asc_insertInCell',
    'spreadsheet.desktop.formula-more': 'asc_insertInCell',
    'spreadsheet.desktop.formula-recent': 'asc_insertInCell',
    'spreadsheet.desktop.formula-reference': 'asc_insertInCell',
    'spreadsheet.desktop.formula-textdata': 'asc_insertInCell',
    'spreadsheet.desktop.freeze-panes': 'asc_freezePane',
    'spreadsheet.desktop.id-context-menu-item-add-comment': 'asc_addComment',
    'spreadsheet.desktop.id-context-menu-item-add-named-range': 'asc_setDefinedNames',
    'spreadsheet.desktop.id-context-menu-item-view-add-comment': 'asc_addComment',
    'spreadsheet.desktop.id-toolbar-btn-closeview': 'asc_setActiveNamedSheetView',
    'spreadsheet.desktop.id-toolbar-btn-createview': 'asc_addNamedSheetView',
    'spreadsheet.desktop.insert-link': 'asc_insertHyperlink',
    'spreadsheet.desktop.insert-smartart': 'asc_createSmartArt',
    'spreadsheet.desktop.insert-sparkline': 'asc_addSparklineGroup',
    'spreadsheet.desktop.insert-symbol': 'asc_insertSymbol',
    'spreadsheet.desktop.insert-text': 'asc_startAddShape',
    'spreadsheet.desktop.insertslicer': 'asc_beforeInsertSlicer',
    'spreadsheet.desktop.import-data': 'asc_TextFromFileOrUrl',
    'spreadsheet.desktop.named-ranges': 'asc_setDefinedNames',
    'spreadsheet.desktop.printtitles': 'asc_changePrintTitles',
    'spreadsheet.desktop.save-copy': 'asc_DownloadAs',
    'spreadsheet.desktop.save-desktop': 'asc_DownloadAs',
    'spreadsheet.desktop.saveas': 'asc_DownloadAs',
    'spreadsheet.desktop.sheet-view': 'asc_setActiveNamedSheetView',
    'spreadsheet.desktop.sort-ascending': 'asc_sortCellsRangeExpand',
    'spreadsheet.desktop.sort-descending': 'asc_sortCellsRangeExpand',
    'spreadsheet.desktop.table-template': 'asc_addAutoFilter',
    'spreadsheet.sparkline.type': 'asc_setSparklineGroup',
};

const pivotCommit = {
    receiver: 'commitTarget',
    method: 'asc_set',
    args: ['api', 'target'],
};
const remainingObjectBindings = {
    'spreadsheet.desktop.chart-data': {
        kind: 'sdk-object',
        method: 'startEdit',
        operations: {
            cancel: 'cancelEdit',
            commit: 'endEdit',
        },
    },
    'spreadsheet.desktop.pivot-blank-rows': {
        kind: 'sdk-object',
        method: 'asc_setInsertBlankRow',
        commit: pivotCommit,
    },
    'spreadsheet.desktop.pivot-grand-totals': {
        kind: 'sdk-object',
        method: 'asc_setRowGrandTotals',
        operations: { columns: 'asc_setColGrandTotals' },
        commit: pivotCommit,
    },
    'spreadsheet.desktop.pivot-layout': {
        kind: 'sdk-object',
        method: 'asc_setOutline',
        operations: {
            compact: 'asc_setCompact',
            'fill-down': 'asc_setFillDownLabelsDefault',
        },
        commit: pivotCommit,
    },
    'spreadsheet.desktop.pivot-refresh': {
        kind: 'sdk-object',
        method: 'asc_refresh',
        passApi: true,
        operations: { all: 'asc_refreshAllPivots' },
        operationReceivers: { all: 'api' },
    },
    'spreadsheet.desktop.pivot-subtotals': {
        kind: 'sdk-object',
        method: 'asc_setDefaultSubtotal',
        operations: { top: 'asc_setSubtotalTop' },
        commit: pivotCommit,
    },
};

const remainingNavigationCommands = new Set([
    'spreadsheet.desktop.about',
    'spreadsheet.desktop.advancedsearch',
    'spreadsheet.desktop.auto-bordercolor',
    'spreadsheet.desktop.back',
    'spreadsheet.desktop.charttab',
    'spreadsheet.desktop.custom-border-color',
    'spreadsheet.desktop.draw',
    'spreadsheet.desktop.format-cell',
    'spreadsheet.desktop.help',
    'spreadsheet.desktop.history',
    'spreadsheet.desktop.info',
    'spreadsheet.desktop.interface-theme',
    'spreadsheet.desktop.opts',
    'spreadsheet.desktop.pivot',
    'spreadsheet.desktop.printpreview',
    'spreadsheet.desktop.protect',
    'spreadsheet.desktop.review',
    'spreadsheet.desktop.replace',
    'spreadsheet.desktop.rights',
    'spreadsheet.desktop.search',
    'spreadsheet.desktop.sparklinetab',
    'spreadsheet.desktop.tabledesign',
    'spreadsheet.desktop.view',
]);

const remainingHostBindings = {
    'spreadsheet.desktop.close-editor': 'close-editor',
    'spreadsheet.desktop.edit': 'request-edit-rights',
    'spreadsheet.desktop.exit': 'go-back',
    'spreadsheet.desktop.file-exit': 'file-close',
    'spreadsheet.desktop.file-open': 'file-open',
    'spreadsheet.desktop.new': 'create-new',
    'spreadsheet.desktop.recent': 'open-recent',
    'spreadsheet.desktop.rename': 'rename',
    'spreadsheet.desktop.suggest': 'suggest',
};

const remainingSdkOperations = {
    'spreadsheet.desktop.conditional-format': { clear: 'asc_clearCF' },
    'spreadsheet.desktop.formula-datetime': { wizard: 'asc_startWizard' },
    'spreadsheet.desktop.formula-financial': { wizard: 'asc_startWizard' },
    'spreadsheet.desktop.formula-logical': { wizard: 'asc_startWizard' },
    'spreadsheet.desktop.formula-math': { wizard: 'asc_startWizard' },
    'spreadsheet.desktop.formula-more': { wizard: 'asc_startWizard' },
    'spreadsheet.desktop.formula-recent': { wizard: 'asc_startWizard' },
    'spreadsheet.desktop.formula-reference': { wizard: 'asc_startWizard' },
    'spreadsheet.desktop.formula-textdata': { wizard: 'asc_startWizard' },
    'spreadsheet.desktop.freeze-panes': { border: 'asc_setFrozenPaneBorderType' },
    'spreadsheet.desktop.import-data': {
        'text-to-columns': 'asc_TextToColumns',
        'xml-start': 'asc_ImportXmlStart',
        'xml-end': 'asc_ImportXmlEnd',
    },
    'spreadsheet.desktop.insert-sparkline': { edit: 'asc_setSparklineGroup' },
    'spreadsheet.desktop.insert-text': { end: 'asc_endAddShape' },
    'spreadsheet.desktop.insertslicer': { insert: 'asc_insertSlicer' },
    'spreadsheet.desktop.named-ranges': {
        edit: 'asc_editDefinedNames',
        delete: 'asc_delDefinedNames',
    },
    'spreadsheet.desktop.sheet-view': {
        create: 'asc_addNamedSheetView',
        delete: 'asc_deleteNamedSheetViews',
    },
    'spreadsheet.desktop.sort-ascending': { apply: 'asc_sortColFilter' },
    'spreadsheet.desktop.sort-descending': { apply: 'asc_sortColFilter' },
    'spreadsheet.desktop.table-template': { change: 'asc_changeAutoFilter' },
};

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
        assert.ok(['implemented', 'excluded'].includes(command.implementation));
        if (command.aliasOf) {
            assert.ok(commandIds.has(command.aliasOf), `${command.id}: ${command.aliasOf}`);
            assert.notEqual(command.aliasOf, command.id);
        }
        if (command.implementation === 'implemented' && command.aliasOf) {
            assert.equal(command.binding, null);
            assert.equal(commandsById.get(command.aliasOf)?.implementation, 'implemented', command.id);
        } else if (command.implementation === 'implemented') {
            assert.ok(command.binding, command.id);
            assert.ok(['sdk', 'sdk-object', 'navigation', 'host'].includes(command.binding.kind), command.id);
            if (command.binding.kind === 'navigation') {
                assert.equal(command.binding.target, command.mobilePath, command.id);
                assert.equal(command.mutates, false, command.id);
            } else if (command.binding.kind === 'host') {
                assert.ok(command.binding.action, command.id);
            } else {
                assert.ok(command.binding.method, command.id);
                if (command.binding.operations) {
                    assert.ok(Object.keys(command.binding.operations).length > 0, command.id);
                    assert.ok(Object.values(command.binding.operations).every(method => /^[A-Za-z][A-Za-z0-9_]+$/.test(method)), command.id);
                }
            }
        } else if (command.implementation === 'excluded') {
            assert.equal(command.binding, null);
            assert.match(command.exclusion?.adr, /^ADR-\d{4}$/);
            assert.ok(command.exclusion.reason);
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

test('spreadsheet command closure leaves no planned command and uses audited binding kinds', () => {
    const commandsById = new Map(inventory.commands.map(command => [command.id, command]));
    assert.deepEqual(
        inventory.commands.filter(command => command.implementation === 'planned').map(command => command.id),
        [],
    );
    assert.deepEqual(
        inventory.commands.filter(command => command.implementation === 'excluded').map(command => command.id),
        [],
    );

    for (const [id, method] of Object.entries(remainingSdkBindings)) {
        assert.deepEqual(commandsById.get(id)?.binding, {
            kind: 'sdk',
            method,
            ...(remainingSdkOperations[id] ? { operations: remainingSdkOperations[id] } : {}),
        }, id);
    }
    for (const [id, binding] of Object.entries(remainingObjectBindings)) {
        assert.deepEqual(commandsById.get(id)?.binding, binding, id);
    }
    for (const id of remainingNavigationCommands) {
        const command = commandsById.get(id);
        assert.equal(command?.implementation, 'implemented', id);
        assert.deepEqual(command?.binding, {
            kind: 'navigation',
            target: command.mobilePath,
        }, id);
        assert.equal(command.mutates, false, id);
    }
    for (const [id, action] of Object.entries(remainingHostBindings)) {
        const command = commandsById.get(id);
        assert.equal(command?.implementation, 'implemented', id);
        assert.deepEqual(command?.binding, { kind: 'host', action }, id);
    }

    for (const command of inventory.commands.filter(command => command.aliasOf)) {
        const target = commandsById.get(command.aliasOf);
        assert.equal(command.implementation, 'implemented', command.id);
        assert.ok(['sdk', 'sdk-object'].includes(target?.binding?.kind), command.id);
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
    assert.equal(descriptors.length, inventory.commands.filter(command => command.implementation === 'implemented').length + 1);
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
        () => provider.execute('spreadsheet.missing'),
        error => error.code === 'MOBILE_COMMAND_NOT_FOUND',
    );
});

test('spreadsheet inventory collapses audited Desktop aliases without duplicate bindings', () => {
    const aliases = Object.fromEntries(inventory.commands
        .filter(command => command.aliasOf)
        .map(command => [command.id, command.aliasOf]));

    assert.deepEqual(aliases, {
        'spreadsheet.desktop.add-cell': 'spreadsheet.cell.insert',
        'spreadsheet.desktop.cell-merge': 'spreadsheet.cell.merge',
        'spreadsheet.desktop.cut': 'spreadsheet.clipboard.cut',
        'spreadsheet.desktop.delete-cell': 'spreadsheet.cell.delete',
        'spreadsheet.desktop.insertsmartart': 'spreadsheet.desktop.insert-smartart',
        'spreadsheet.desktop.insertsymbol': 'spreadsheet.desktop.insert-symbol',
        'spreadsheet.desktop.pagebreak': 'spreadsheet.desktop.page-break',
        'spreadsheet.desktop.pagemargins': 'spreadsheet.desktop.page-margins',
        'spreadsheet.desktop.pageorient': 'spreadsheet.desktop.page-orient',
        'spreadsheet.desktop.pagesize': 'spreadsheet.desktop.page-size',
        'spreadsheet.desktop.printarea': 'spreadsheet.desktop.print-area',
        'spreadsheet.desktop.recommended-chart': 'spreadsheet.insert.chart',
        'spreadsheet.desktop.save-2': 'spreadsheet.desktop.save',
        'spreadsheet.desktop.scale': 'spreadsheet.desktop.page-scale',
    });
});

test('spreadsheet closure commands invoke audited SDKJS bindings and aliases', () => {
    const calls = [];
    const api = new Proxy({
        asc_getCellInfo: () => ({ type: 'cell' }),
    }, {
        get(target, property) {
            if (property in target) return target[property];
            if (typeof property === 'string' && property.startsWith('asc_')) {
                return (...args) => calls.push([property, ...args]);
            }
            return undefined;
        },
    });
    const provider = createSpreadsheetCommandProvider({ inventory, getApi: () => api });

    for (const [id, method] of Object.entries(closureBindings)) {
        const command = inventory.commands.find(candidate => candidate.id === id);
        assert.equal(command.implementation, 'implemented', id);
        assert.equal(command.binding.kind, 'sdk', id);
        assert.equal(command.binding.method, method, id);
        assert.deepEqual(command.binding.operations, closureOperations[id], id);
        provider.execute(id, { args: ['payload', 7] });
    }

    for (const [id, operations] of Object.entries(closureOperations)) {
        for (const [operation, method] of Object.entries(operations)) {
            provider.execute(id, { operation, args: [operation] });
            assert.deepEqual(calls.at(-1), [method, operation], `${id}:${operation}`);
        }
    }

    for (const [id, method] of Object.entries(remainingSdkBindings)) {
        provider.execute(id, { args: [id] });
        assert.deepEqual(calls.at(-1), [method, id], id);
    }

    for (const [id, operations] of Object.entries(remainingSdkOperations)) {
        for (const [operation, method] of Object.entries(operations)) {
            provider.execute(id, { operation, args: [operation] });
            assert.deepEqual(calls.at(-1), [method, operation], `${id}:${operation}`);
        }
    }

    provider.execute('spreadsheet.desktop.add-cell', { value: 11 });
    provider.execute('spreadsheet.desktop.recommended-chart', { value: 'chart-settings' });
    provider.execute('spreadsheet.desktop.save-2');

    assert.deepEqual(calls.slice(-3), [
        ['asc_insertCells', 11],
        ['asc_addChartDrawingObject', 'chart-settings'],
        ['asc_Save'],
    ]);

    assert.throws(
        () => provider.execute('spreadsheet.desktop.insert-image', { operation: 'camera' }),
        error => error.code === 'MOBILE_COMMAND_OPERATION_NOT_SUPPORTED',
    );
});

test('spreadsheet provider executes SDK object operations and returns navigation intents', () => {
    const calls = [];
    const api = {
        asc_getCellInfo: () => ({ type: 'cell' }),
        asc_refreshAllPivots: (...args) => calls.push(['api', 'asc_refreshAllPivots', ...args]),
    };
    const provider = createSpreadsheetCommandProvider({ inventory, getApi: () => api });
    const target = new Proxy({}, {
        get(object, property) {
            if (typeof property === 'string') {
                return (...args) => calls.push(['target', property, ...args]);
            }
            return object[property];
        },
    });
    const originalPivot = {
        asc_set: (...args) => calls.push(['commitTarget', 'asc_set', ...args]),
        asc_refresh: (...args) => calls.push(['commitTarget', 'asc_refresh', ...args]),
    };

    provider.execute('spreadsheet.desktop.chart-data', { target });
    provider.execute('spreadsheet.desktop.chart-data', { target, operation: 'commit' });
    provider.execute('spreadsheet.desktop.pivot-grand-totals', {
        target,
        commitTarget: originalPivot,
        operation: 'columns',
        value: true,
    });
    provider.execute('spreadsheet.desktop.pivot-refresh', { target: originalPivot });
    provider.execute('spreadsheet.desktop.pivot-refresh', { target: originalPivot, operation: 'all' });
    assert.deepEqual(calls, [
        ['target', 'startEdit'],
        ['target', 'endEdit'],
        ['target', 'asc_setColGrandTotals', true],
        ['commitTarget', 'asc_set', api, target],
        ['commitTarget', 'asc_refresh', api],
        ['api', 'asc_refreshAllPivots'],
    ]);
    assert.deepEqual(provider.execute('spreadsheet.desktop.about'), {
        type: 'navigate',
        commandId: 'spreadsheet.desktop.about',
        target: 'more.command-search',
    });
    assert.deepEqual(provider.execute('spreadsheet.desktop.exit'), {
        type: 'host-command',
        commandId: 'spreadsheet.desktop.exit',
        action: 'go-back',
    });
    assert.deepEqual(provider.execute('spreadsheet.desktop.sparklinetab'), {
        type: 'navigate',
        commandId: 'spreadsheet.desktop.sparklinetab',
        target: 'more.command-search',
    });
    assert.deepEqual(provider.execute('spreadsheet.desktop.recent'), {
        type: 'host-command',
        commandId: 'spreadsheet.desktop.recent',
        action: 'open-recent',
    });
});

test('spreadsheet Mobile entry points execute mutating SDK commands through Runtime', async () => {
    const routedCommands = {
        'apps/spreadsheeteditor/mobile/src/controller/add/AddChart.jsx': [
            'spreadsheet.insert.chart',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/add/AddFilter.jsx': [
            'spreadsheet.desktop.auto-filter',
            'spreadsheet.desktop.sort-ascending',
            'spreadsheet.desktop.sort-descending',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/add/AddFunction.jsx': [
            'spreadsheet.desktop.insert-formula',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/add/AddImage.jsx': [
            'spreadsheet.desktop.insert-image',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/add/AddLink.jsx': [
            'spreadsheet.desktop.insert-link',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/add/AddShape.jsx': [
            'spreadsheet.desktop.insert-shape',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/edit/EditCell.jsx': [
            'spreadsheet.desktop.cell-borders',
            'spreadsheet.desktop.cell-style',
            'spreadsheet.desktop.fill-color',
            'spreadsheet.desktop.font-color',
            'spreadsheet.desktop.text-orientation',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/edit/EditChart.jsx': [
            'spreadsheet.desktop.object-backward',
            'spreadsheet.desktop.object-forward',
            'spreadsheet.object.delete',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/edit/EditLink.jsx': [
            'spreadsheet.desktop.insert-link',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/ContextMenu.jsx': [
            'spreadsheet.cell.autofill',
            'spreadsheet.clipboard.copy',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/DropdownList.jsx': [
            'spreadsheet.desktop.insert-formula',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/Encoding.jsx': [
            'spreadsheet.desktop.save-desktop',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/FilterOptions.jsx': [
            'spreadsheet.desktop.auto-filter',
            'spreadsheet.desktop.clear-filter',
            'spreadsheet.desktop.sort-ascending',
            'spreadsheet.desktop.sort-descending',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/settings/SpreadsheetSettings.jsx': [
            'spreadsheet.desktop.page-margins',
            'spreadsheet.desktop.page-orient',
            'spreadsheet.desktop.page-size',
            'spreadsheet.desktop.theme-colors',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/settings/Settings.jsx': [
            'spreadsheet.desktop.print',
            'spreadsheet.desktop.save',
        ],
        'apps/spreadsheeteditor/mobile/src/controller/settings/Download.jsx': [
            'spreadsheet.desktop.save-desktop',
        ],
    };

    for (const [sourcePath, commandIds] of Object.entries(routedCommands)) {
        const source = await readFile(new URL(sourcePath, editorRoot), 'utf8');
        for (const commandId of commandIds) {
            assert.ok(source.includes('executeSpreadsheetCommand('), sourcePath);
            assert.ok(source.includes(`'${commandId}'`) || source.includes(`"${commandId}"`), `${sourcePath}: ${commandId}`);
        }
    }
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

test('spreadsheet Runtime gates new SDK mutations while keeping view commands available', () => {
    const callbacks = new Map();
    const calls = [];
    const api = {
        asc_registerCallback: (name, callback) => callbacks.set(name, callback),
        asc_unregisterCallback: name => callbacks.delete(name),
        asc_Print: (...args) => calls.push(['print', ...args]),
        asc_changePageOrient: (...args) => calls.push(['page-orient', ...args]),
    };

    const runtime = initializeSpreadsheetEditorRuntime({ inventory, getApi: () => api });
    assert.equal(runtime.resolve('spreadsheet.desktop.print').available, true);
    assert.deepEqual(runtime.resolve('spreadsheet.desktop.page-orient'), {
        id: 'spreadsheet.desktop.page-orient',
        permission: 'edit',
        contexts: ['workbook'],
        mobilePath: 'settings.layout',
        mutates: true,
        available: false,
        reason: 'permission-denied',
    });
    runtime.execute('spreadsheet.desktop.print');

    updateSpreadsheetEditorPermissions({ edit: true });
    assert.equal(runtime.resolve('spreadsheet.desktop.page-orient').freezeReason, 'open-idle');
    assert.throws(
        () => runtime.execute('spreadsheet.desktop.page-orient', { args: [true, 2] }),
        error => error.code === 'MOBILE_COMMAND_SESSION_FROZEN',
    );

    callbacks.get('asc_onDocumentOpenStateChanged')({ phase: 'ready' });
    callbacks.get('asc_onTransportStateChanged')({ state: 'connected' });
    runtime.execute('spreadsheet.desktop.page-orient', { args: [true, 2] });
    assert.deepEqual(calls, [
        ['print'],
        ['page-orient', true, 2],
    ]);

    updateSpreadsheetEditorPermissions({ edit: false });
    assert.equal(runtime.resolve('spreadsheet.desktop.page-orient').reason, 'permission-denied');
    disposeSpreadsheetEditorRuntime();
});
