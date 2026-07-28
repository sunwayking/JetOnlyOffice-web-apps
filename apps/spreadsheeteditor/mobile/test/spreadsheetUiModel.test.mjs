/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildSpreadsheetContextMenuItems,
    createSpreadsheetFocusInterface,
    getSpreadsheetSelectionTokens,
    isSpreadsheetObjectSelection,
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
    assert.deepEqual(getSpreadsheetSelectionTokens(cellInfo(selectionTypes.RangeChartText), selectionTypes), ['text']);
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
    assert.equal(focus.getShapeObject(), chart);
    assert.equal(focus.getImageObject(), image);
});

const menuLabels = Object.freeze({
    menuAddComment: 'Add comment',
    menuAutofill: 'Autofill',
    menuOpenLink: 'Open link',
    menuViewComment: 'View comment',
});

const menuEvents = options => buildSpreadsheetContextMenuItems({
    cellInfo: cellInfo(selectionTypes.RangeCells),
    selectionTypes,
    labels: menuLabels,
    canCopy: true,
    canCutPaste: true,
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
        'copy',
        'cut',
        'paste',
        'addcomment',
        'autofillCells',
    ]);

    const comment = {asc_getSolved: () => false};
    assert.deepEqual(menuEvents({
        cellInfo: {
            ...cellInfo(selectionTypes.RangeCells, {}),
            asc_getComments: () => [comment],
        },
    }), ['copy', 'cut', 'paste', 'openlink', 'viewcomment']);
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
    }), ['copy', 'cut', 'paste']);
    assert.deepEqual(menuEvents({canCopy: false, canCutPaste: false, canAddComments: false}), []);
});
