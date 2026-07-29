/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildSpreadsheetContextMenuItems,
    createSpreadsheetFocusInterface,
    getSpreadsheetTabHighlightWidth,
    getSpreadsheetSelectionTokens,
    includesSpreadsheetPanel,
    isSpreadsheetObjectSelection,
    orderSpreadsheetPanels,
    resolveSpreadsheetContextMenuAction,
} from '../src/lib/spreadsheetUiModel.mjs';

const selectionTypes = Object.freeze({
    RangeCells: 1,
    RangeRow: 2,
    RangeCol: 3,
    RangeMax: 4,
    RangeImage: 5,
    RangeShape: 6,
    RangeChart: 7,
    RangeChartText: 8,
    RangeShapeText: 9,
    RangeSlicer: 10,
});
const selectElementTypes = Object.freeze({Image: 11, Paragraph: 12});

const cellInfo = (type, hyperlink = null) => ({
    asc_getHyperlink: () => hyperlink,
    asc_getSelectionType: () => type,
});

test('Spreadsheet UI model separates cell, text and object selection contexts', () => {
    assert.deepEqual(getSpreadsheetSelectionTokens(cellInfo(selectionTypes.RangeCells), selectionTypes), ['cell']);
    assert.deepEqual(getSpreadsheetSelectionTokens(cellInfo(selectionTypes.RangeRow, {}), selectionTypes), ['cell', 'hyperlink']);
    assert.deepEqual(getSpreadsheetSelectionTokens(cellInfo(selectionTypes.RangeImage), selectionTypes), ['object', 'image']);
    assert.deepEqual(getSpreadsheetSelectionTokens(cellInfo(selectionTypes.RangeShape), selectionTypes), ['object', 'shape']);
    assert.deepEqual(getSpreadsheetSelectionTokens(cellInfo(selectionTypes.RangeChart), selectionTypes), ['object', 'chart']);
    assert.deepEqual(getSpreadsheetSelectionTokens(cellInfo(selectionTypes.RangeChartText), selectionTypes), ['object', 'chart', 'text']);
    assert.deepEqual(getSpreadsheetSelectionTokens(cellInfo(selectionTypes.RangeSlicer), selectionTypes), ['object', 'slicer']);
    assert.equal(isSpreadsheetObjectSelection(cellInfo(selectionTypes.RangeImage), selectionTypes), true);
    assert.equal(isSpreadsheetObjectSelection(cellInfo(selectionTypes.RangeShapeText), selectionTypes), true);
    assert.equal(isSpreadsheetObjectSelection(cellInfo(selectionTypes.RangeCells), selectionTypes), false);
});

test('Spreadsheet focus interface resolves chart, shape, image and paragraph values', () => {
    const paragraph = {};
    const chart = {get_ChartProperties: () => ({type: 'chart'}), get_ShapeProperties: () => ({type: 'shape'})};
    const image = {};
    const store = {
        _cellInfo: cellInfo(selectionTypes.RangeCells),
        _focusObjects: [
            {get_ObjectType: () => selectElementTypes.Paragraph, get_ObjectValue: () => paragraph},
            {get_ObjectType: () => selectElementTypes.Image, get_ObjectValue: () => chart},
            {get_ObjectType: () => selectElementTypes.Image, get_ObjectValue: () => image},
        ],
    };
    const focus = createSpreadsheetFocusInterface(store, {selectionTypes, selectElementTypes});

    assert.deepEqual(focus.getSelections(), ['cell']);
    assert.equal(focus.getParagraphObject(), paragraph);
    assert.equal(focus.getChartObject(), chart);
    assert.equal(focus.getShapeObject(), null);
    assert.equal(focus.getImageObject(), image);
});

const menuLabels = Object.freeze({
    menuAddLink: 'Add link',
    menuAddComment: 'Add comment',
    menuAutofill: 'Autofill',
    menuChart: 'Chart',
    menuClear: 'Clear',
    menuCopy: 'Copy',
    menuCut: 'Cut',
    menuDelete: 'Delete',
    menuEdit: 'Edit',
    menuHide: 'Hide',
    menuImage: 'Image',
    menuInsertAbove: 'Insert above',
    menuInsertLeft: 'Insert left',
    menuMerge: 'Merge',
    menuOpenLink: 'Open link',
    menuPaste: 'Paste',
    menuReplaceImage: 'Replace image',
    menuShape: 'Shape',
    menuShow: 'Show',
    menuViewComment: 'View comment',
});

const menuEvents = options => buildSpreadsheetContextMenuItems({
    cellInfo: cellInfo(selectionTypes.RangeCells),
    selectionTypes,
    labels: menuLabels,
    canCopy: true,
    canCutPaste: true,
    canMutate: true,
    canViewComments: true,
    canAddComments: true,
    isResolvedComments: false,
    isDisconnected: false,
    isVersionHistoryMode: false,
    isLocked: false,
    isCellEdited: false,
    canFillHandle: false,
    ...options,
}).map(item => item.event);

test('Spreadsheet context menu exposes editable cell actions without duplicating comments', () => {
    assert.deepEqual(menuEvents({canFillHandle: true}), [
        'cut',
        'copy',
        'paste',
        'delete',
        'edit',
        'clear',
        'merge',
        'addlink',
        'addcomment',
        'autofillCells',
    ]);

    const comment = {asc_getSolved: () => false};
    assert.deepEqual(menuEvents({
        cellInfo: {
            ...cellInfo(selectionTypes.RangeCells, {}),
            asc_getComments: () => [comment],
        },
    }), ['cut', 'copy', 'paste', 'delete', 'edit', 'clear', 'merge', 'openlink', 'editlink', 'viewcomment']);
});

test('Spreadsheet context menu matches Android row, column, chart, image, and shape actions', () => {
    assert.deepEqual(menuEvents({cellInfo: cellInfo(selectionTypes.RangeCol)}), [
        'cut', 'copy', 'paste', 'delete', 'edit', 'clear', 'insert-left', 'hide', 'show', 'addlink', 'addcomment',
    ]);
    assert.deepEqual(menuEvents({cellInfo: cellInfo(selectionTypes.RangeRow)}), [
        'cut', 'copy', 'paste', 'delete', 'edit', 'clear', 'insert-above', 'hide', 'show', 'addlink', 'addcomment',
    ]);
    assert.deepEqual(menuEvents({cellInfo: cellInfo(selectionTypes.RangeChart)}), [
        'cut', 'copy', 'delete', 'edit', 'chart',
    ]);
    assert.deepEqual(menuEvents({cellInfo: cellInfo(selectionTypes.RangeImage)}), [
        'cut', 'copy', 'paste', 'delete', 'edit', 'image', 'replace-image',
    ]);
    assert.deepEqual(menuEvents({cellInfo: cellInfo(selectionTypes.RangeShape)}), [
        'cut', 'copy', 'paste', 'delete', 'edit', 'shape',
    ]);
});

test('Spreadsheet context menu blocks mutations while locked, disconnected, or in history', () => {
    for (const blockedState of [
        {isLocked: true},
        {isDisconnected: true},
        {isVersionHistoryMode: true},
    ]) {
        assert.deepEqual(menuEvents({...blockedState, canFillHandle: true}), ['copy']);
    }
});

test('Spreadsheet context menu limits comments and links to cell selections and permissions', () => {
    assert.deepEqual(menuEvents({
        cellInfo: cellInfo(selectionTypes.RangeChart),
        canAddComments: false,
    }), ['cut', 'copy', 'delete', 'edit', 'chart']);
    assert.deepEqual(menuEvents({canCopy: false, canCutPaste: false, canMutate: false, canAddComments: false}), []);
    assert.deepEqual(menuEvents({canCopy: false, canCutPaste: false, canAddComments: false}), [
        'delete', 'edit', 'clear', 'merge', 'addlink',
    ]);
});

test('Spreadsheet context menu actions resolve to Runtime commands or existing Mobile panels', () => {
    const constants = {
        cleanAll: 11,
        deleteCellsLeft: 21,
        deleteColumns: 22,
        deleteRows: 23,
        insertColumns: 31,
        insertRows: 32,
        merge: 41,
    };
    const resolve = (action, type, options) => resolveSpreadsheetContextMenuAction({
        action,
        cellInfo: cellInfo(type),
        selectionTypes,
        constants,
        canDeleteComments: options?.canDeleteComments,
    });

    assert.deepEqual(resolve('copy', selectionTypes.RangeCells), {
        kind: 'command', commandId: 'spreadsheet.clipboard.copy',
    });
    assert.deepEqual(resolve('clear', selectionTypes.RangeCells), {
        kind: 'command', commandId: 'spreadsheet.cell.clear', payload: {args: [11, true]},
    });
    assert.deepEqual(resolve('clear', selectionTypes.RangeCells, {canDeleteComments: true}), {
        kind: 'command', commandId: 'spreadsheet.cell.clear', payload: {args: [11, false]},
    });
    assert.deepEqual(resolve('delete', selectionTypes.RangeCells), {
        kind: 'command', commandId: 'spreadsheet.cell.delete', payload: {value: 21},
    });
    assert.deepEqual(resolve('delete', selectionTypes.RangeCol), {
        kind: 'command', commandId: 'spreadsheet.cell.delete', payload: {value: 22},
    });
    assert.deepEqual(resolve('delete', selectionTypes.RangeRow), {
        kind: 'command', commandId: 'spreadsheet.cell.delete', payload: {value: 23},
    });
    assert.deepEqual(resolve('delete', selectionTypes.RangeChart), {
        kind: 'command', commandId: 'spreadsheet.object.delete',
    });
    assert.deepEqual(resolve('insert-left', selectionTypes.RangeCol), {
        kind: 'command', commandId: 'spreadsheet.cell.insert', payload: {value: 31},
    });
    assert.deepEqual(resolve('insert-above', selectionTypes.RangeRow), {
        kind: 'command', commandId: 'spreadsheet.cell.insert', payload: {value: 32},
    });
    assert.deepEqual(resolve('hide', selectionTypes.RangeCol), {
        kind: 'command', commandId: 'spreadsheet.column.hide',
    });
    assert.deepEqual(resolve('show', selectionTypes.RangeRow), {
        kind: 'command', commandId: 'spreadsheet.row.show',
    });
    assert.deepEqual(resolve('merge', selectionTypes.RangeCells), {
        kind: 'command', commandId: 'spreadsheet.cell.merge', payload: {value: 41},
    });
    assert.deepEqual(resolve('autofillCells', selectionTypes.RangeCells), {
        kind: 'command', commandId: 'spreadsheet.cell.autofill',
    });
    assert.deepEqual(resolve('chart', selectionTypes.RangeChart), {kind: 'route', target: 'edit'});
    assert.deepEqual(resolve('replace-image', selectionTypes.RangeImage), {kind: 'route', target: 'edit'});
    assert.deepEqual(resolve('addlink', selectionTypes.RangeCells), {kind: 'route', target: 'add-link'});
    assert.equal(resolve('insert-left', selectionTypes.RangeCells), null);
});

test('Spreadsheet panel helpers keep targeted panels reachable and RTL ordering immutable', () => {
    assert.equal(includesSpreadsheetPanel(undefined, 'shape'), true);
    assert.equal(includesSpreadsheetPanel(['shape'], 'shape'), true);
    assert.equal(includesSpreadsheetPanel(['image', 'shape'], 'shape'), true);
    assert.equal(includesSpreadsheetPanel('function', 'shape'), false);

    const panels = [{id: 'chart'}, {id: 'shape'}];
    assert.deepEqual(orderSpreadsheetPanels(panels, 'ltr'), panels);
    assert.deepEqual(orderSpreadsheetPanels(panels, 'rtl'), [{id: 'shape'}, {id: 'chart'}]);
    assert.deepEqual(panels, [{id: 'chart'}, {id: 'shape'}]);
    assert.equal(getSpreadsheetTabHighlightWidth(4), '25%');
    assert.equal(getSpreadsheetTabHighlightWidth(0), '0%');
});
