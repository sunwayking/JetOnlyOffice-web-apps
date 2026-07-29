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
    if (type === selectionTypes.RangeImage) tokens.push('object', 'image');
    if (type === selectionTypes.RangeShape) tokens.push('object', 'shape');
    if (type === selectionTypes.RangeChart) tokens.push('object', 'chart');
    if (type === selectionTypes.RangeSlicer) tokens.push('object', 'slicer');
    if (type === selectionTypes.RangeChartText) tokens.push('object', 'chart', 'text');
    if (type === selectionTypes.RangeShapeText) tokens.push('object', 'shape', 'text');
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
        getShapeObject: () => firstValue(item => !item.value?.get_ChartProperties?.() &&
            typeof item.value?.get_ShapeProperties === 'function' && item.value.get_ShapeProperties()),
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
    canMutate,
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
    const selectionType = selectionTypeOf(cellInfo);
    const cellSelection = isCellSelection(cellInfo, selectionTypes);
    const chartSelection = selectionType === selectionTypes.RangeChart || selectionType === selectionTypes.RangeChartText;
    const imageSelection = selectionType === selectionTypes.RangeImage;
    const shapeSelection = selectionType === selectionTypes.RangeShape || selectionType === selectionTypes.RangeShapeText;
    const objectSelection = chartSelection || imageSelection || shapeSelection || selectionType === selectionTypes.RangeSlicer;
    const items = [];

    const mutationsAllowed = !isDisconnected && !isVersionHistoryMode && !isLocked;
    const editingAllowed = mutationsAllowed && canMutate;
    if (editingAllowed && canCutPaste) {
        items.push({caption: labels.menuCut, event: 'cut'});
    }
    if (canCopy) items.push({caption: labels.menuCopy, event: 'copy'});
    if (editingAllowed && canCutPaste && !chartSelection) {
        items.push({caption: labels.menuPaste, event: 'paste'});
    }

    if (editingAllowed && (cellSelection || objectSelection)) {
        items.push({caption: labels.menuDelete, event: 'delete'});
        items.push({caption: labels.menuEdit, event: 'edit'});

        if (cellSelection) {
            items.push({caption: labels.menuClear, event: 'clear'});
            if (selectionType === selectionTypes.RangeCells || selectionType === selectionTypes.RangeMax) {
                items.push({caption: labels.menuMerge, event: 'merge'});
            }
            if (selectionType === selectionTypes.RangeCol) {
                items.push({caption: labels.menuInsertLeft, event: 'insert-left'});
                items.push({caption: labels.menuHide, event: 'hide'});
                items.push({caption: labels.menuShow, event: 'show'});
            }
            if (selectionType === selectionTypes.RangeRow) {
                items.push({caption: labels.menuInsertAbove, event: 'insert-above'});
                items.push({caption: labels.menuHide, event: 'hide'});
                items.push({caption: labels.menuShow, event: 'show'});
            }
        } else if (chartSelection) {
            items.push({caption: labels.menuChart, event: 'chart'});
        } else if (imageSelection) {
            items.push({caption: labels.menuImage, event: 'image'});
            items.push({caption: labels.menuReplaceImage, event: 'replace-image'});
        } else if (shapeSelection) {
            items.push({caption: labels.menuShape, event: 'shape'});
        }
    }

    if (cellSelection && cellInfo.asc_getHyperlink?.()) {
        items.push({caption: labels.menuOpenLink, event: 'openlink'});
        if (editingAllowed) {
            items.push({caption: labels.menuEditLink, event: 'editlink'});
        }
    } else if (editingAllowed && cellSelection) {
        items.push({caption: labels.menuAddLink, event: 'addlink'});
    }

    if (canViewComments && comments.length > 0 &&
        ((!firstCommentSolved && !isResolvedComments) || isResolvedComments)) {
        items.push({caption: labels.menuViewComment, event: 'viewcomment'});
    }

    if (editingAllowed && cellSelection && !isCellEdited && canAddComments && comments.length === 0) {
        items.push({caption: labels.menuAddComment, event: 'addcomment'});
    }

    if (editingAllowed && canFillHandle) {
        items.push({caption: labels.menuAutofill, event: 'autofillCells'});
    }

    return items;
}

export function resolveSpreadsheetContextMenuAction({
    action,
    cellInfo,
    selectionTypes,
    constants,
    canDeleteComments = false,
}) {
    const selectionType = selectionTypeOf(cellInfo);
    const command = (commandId, payload) => ({
        kind: 'command',
        commandId,
        ...(payload === undefined ? {} : {payload}),
    });

    if (action === 'copy') return command('spreadsheet.clipboard.copy');
    if (action === 'cut') return command('spreadsheet.clipboard.cut');
    if (action === 'paste') return command('spreadsheet.clipboard.paste');

    if (action === 'delete') {
        if (isSpreadsheetObjectSelection(cellInfo, selectionTypes)) {
            return command('spreadsheet.object.delete');
        }
        const deleteOption = selectionType === selectionTypes.RangeCol
            ? constants.deleteColumns
            : selectionType === selectionTypes.RangeRow
                ? constants.deleteRows
                : constants.deleteCellsLeft;
        return isCellSelection(cellInfo, selectionTypes)
            ? command('spreadsheet.cell.delete', {value: deleteOption})
            : null;
    }

    if (action === 'clear' && isCellSelection(cellInfo, selectionTypes)) {
        return command('spreadsheet.cell.clear', {
            args: [constants.cleanAll, !canDeleteComments],
        });
    }
    if (action === 'merge' && isCellSelection(cellInfo, selectionTypes)) {
        return command('spreadsheet.cell.merge', {value: constants.merge});
    }
    if (action === 'autofillCells' && isCellSelection(cellInfo, selectionTypes)) {
        return command('spreadsheet.cell.autofill');
    }
    if (action === 'insert-left' && selectionType === selectionTypes.RangeCol) {
        return command('spreadsheet.cell.insert', {value: constants.insertColumns});
    }
    if (action === 'insert-above' && selectionType === selectionTypes.RangeRow) {
        return command('spreadsheet.cell.insert', {value: constants.insertRows});
    }
    if (action === 'hide' && selectionType === selectionTypes.RangeCol) {
        return command('spreadsheet.column.hide');
    }
    if (action === 'show' && selectionType === selectionTypes.RangeCol) {
        return command('spreadsheet.column.show');
    }
    if (action === 'hide' && selectionType === selectionTypes.RangeRow) {
        return command('spreadsheet.row.hide');
    }
    if (action === 'show' && selectionType === selectionTypes.RangeRow) {
        return command('spreadsheet.row.show');
    }

    if (['edit', 'chart', 'image', 'shape', 'replace-image'].includes(action)) {
        return {kind: 'route', target: 'edit'};
    }
    if (action === 'addlink') return {kind: 'route', target: 'add-link'};
    if (action === 'editlink') return {kind: 'route', target: 'edit-link'};
    return null;
}

export function includesSpreadsheetPanel(showPanels, panel) {
    if (!showPanels) return true;
    if (Array.isArray(showPanels)) return showPanels.includes(panel);
    return showPanels === panel;
}

export function orderSpreadsheetPanels(panels, directionMode) {
    return directionMode === 'rtl' ? [...panels].reverse() : panels;
}

export function getSpreadsheetTabHighlightWidth(panelCount) {
    return panelCount > 0 ? `${100 / panelCount}%` : '0%';
}
