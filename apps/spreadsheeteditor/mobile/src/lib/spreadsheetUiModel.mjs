/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const unique = values => Array.from(new Set(values));

const selectionTypeOf = cellInfo => cellInfo?.asc_getSelectionType?.();

const isCellSelection = (cellInfo, selectionTypes) => [
    selectionTypes.RangeCells,
    selectionTypes.RangeRow,
    selectionTypes.RangeCol,
    selectionTypes.RangeMax,
].includes(selectionTypeOf(cellInfo));

export function isSpreadsheetObjectSelection(cellInfo, selectionTypes) {
    const type = selectionTypeOf(cellInfo);
    return [
        selectionTypes.RangeImage,
        selectionTypes.RangeShape,
        selectionTypes.RangeChart,
        selectionTypes.RangeChartText,
        selectionTypes.RangeShapeText,
        selectionTypes.RangeSlicer,
    ].some(candidate => candidate !== undefined && candidate === type);
}

export function getSpreadsheetSelectionTokens(cellInfo, selectionTypes) {
    if (!cellInfo) return [];
    const type = selectionTypeOf(cellInfo);
    const tokens = [];

    if ([
        selectionTypes.RangeCells,
        selectionTypes.RangeRow,
        selectionTypes.RangeCol,
        selectionTypes.RangeMax,
    ].includes(type)) {
        tokens.push('cell');
    }
    if (type === selectionTypes.RangeChartText || type === selectionTypes.RangeShapeText) {
        tokens.push('text');
    }
    if (cellInfo.asc_getHyperlink?.()) {
        tokens.push('hyperlink');
    }

    return unique(tokens);
}

export function createSpreadsheetFocusInterface(store, {selectionTypes, selectElementTypes}) {
    const values = () => (store._focusObjects || []).map(item => ({
        type: item.get_ObjectType(),
        value: item.get_ObjectValue(),
    }));
    const firstValue = predicate => values().find(predicate)?.value ?? null;

    return Object.freeze({
        getSelections: () => getSpreadsheetSelectionTokens(store._cellInfo, selectionTypes),
        getParagraphObject: () => firstValue(item => item.type === selectElementTypes.Paragraph),
        getChartObject: () => firstValue(item => typeof item.value?.get_ChartProperties === 'function' && item.value.get_ChartProperties()),
        getShapeObject: () => firstValue(item => typeof item.value?.get_ShapeProperties === 'function' && item.value.get_ShapeProperties()),
        getImageObject: () => firstValue(item => item.type === selectElementTypes.Image &&
            !item.value?.get_ChartProperties?.() && !item.value?.get_ShapeProperties?.()),
    });
}

export function buildSpreadsheetContextMenuItems({
    cellInfo,
    selectionTypes,
    labels,
    canCopy,
    canCutPaste,
    canViewComments,
    canAddComments,
    isResolvedComments,
    isDisconnected,
    isVersionHistoryMode,
    isLocked,
    isCellEdited,
    canFillHandle,
}) {
    if (!cellInfo) return [];

    const comments = cellInfo.asc_getComments?.() || [];
    const firstCommentSolved = comments[0]?.asc_getSolved?.() === true;
    const cellSelection = isCellSelection(cellInfo, selectionTypes);
    const items = [];

    if (canCopy) items.push({event: 'copy', icon: 'icon-copy'});

    const mutationsAllowed = !isDisconnected && !isVersionHistoryMode && !isLocked;
    if (mutationsAllowed && canCutPaste) {
        items.push({event: 'cut', icon: 'icon-cut'});
        items.push({event: 'paste', icon: 'icon-paste'});
    }

    if (cellSelection && cellInfo.asc_getHyperlink?.()) {
        items.push({caption: labels.menuOpenLink, event: 'openlink'});
    }

    if (canViewComments && comments.length > 0 &&
        ((!firstCommentSolved && !isResolvedComments) || isResolvedComments)) {
        items.push({caption: labels.menuViewComment, event: 'viewcomment'});
    }

    if (mutationsAllowed && cellSelection && !isCellEdited && canAddComments && comments.length === 0) {
        items.push({caption: labels.menuAddComment, event: 'addcomment'});
    }

    if (mutationsAllowed && canFillHandle) {
        items.push({caption: labels.menuAutofill, event: 'autofillCells'});
    }

    return items;
}
