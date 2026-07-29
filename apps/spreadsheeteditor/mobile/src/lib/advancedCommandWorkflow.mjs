/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const workflowError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const readValue = (value, getters, fallback = null) => {
    for (const getter of getters) {
        if (typeof value?.[getter] === 'function') return value[getter]();
    }
    return fallback;
};

const requireText = (value, code, message) => {
    const normalized = String(value || '').trim();
    if (!normalized) throw workflowError(code, message);
    return normalized;
};

export function createSpreadsheetAdvancedWorkflow({
    executeCommand,
    getApi,
    createDefinedName = value => new Asc.asc_CDefName(value.name, value.range, value.scope, value.type),
    createPivotProperties = () => new Asc.CT_pivotTableDefinition(),
    createSparklineProperties = () => new Asc.sparklineGroup(),
    definedNamesListMode = typeof Asc !== 'undefined' ? Asc.c_oAscGetDefinedNamesList?.All : undefined,
} = {}) {
    if (typeof executeCommand !== 'function') {
        throw new TypeError('createSpreadsheetAdvancedWorkflow requires executeCommand');
    }
    if (typeof getApi !== 'function') {
        throw new TypeError('createSpreadsheetAdvancedWorkflow requires getApi');
    }

    const requireApi = () => {
        const api = getApi();
        if (!api) throw workflowError('MOBILE_EDITOR_API_UNAVAILABLE', 'Spreadsheet editor API is not available');
        return api;
    };
    const currentCellInfo = () => requireApi().asc_getCellInfo?.();
    const currentPivot = () => {
        const pivot = currentCellInfo()?.asc_getPivotTableInfo?.();
        if (!pivot) throw workflowError('MOBILE_PIVOT_SELECTION_REQUIRED', 'Select a cell in a pivot table');
        return pivot;
    };
    const currentSparkline = () => {
        const sparkline = currentCellInfo()?.asc_getSparklineInfo?.();
        if (!sparkline) throw workflowError('MOBILE_SPARKLINE_SELECTION_REQUIRED', 'Select a cell containing a sparkline');
        return sparkline;
    };
    const buildDefinedName = input => createDefinedName({
        name: requireText(input?.name, 'MOBILE_NAMED_RANGE_NAME_REQUIRED', 'A name is required'),
        range: requireText(input?.range, 'MOBILE_NAMED_RANGE_REFERENCE_REQUIRED', 'A cell reference is required'),
        scope: input?.scope ?? null,
        ...(input?.type === undefined ? {} : {type: input.type}),
    });
    const pivotPayload = (value, configure) => {
        const target = createPivotProperties();
        configure?.(target);
        return {
        target,
        commitTarget: currentPivot(),
        value,
        };
    };

    return Object.freeze({
        listNamedRanges() {
            return (requireApi().asc_getDefinedNames?.(definedNamesListMode) || []).map(raw => ({
                raw,
                name: readValue(raw, ['asc_getName'], ''),
                range: readValue(raw, ['asc_getRef', 'asc_getRange'], ''),
                scope: readValue(raw, ['asc_getScope']),
                type: readValue(raw, ['asc_getType']),
            }));
        },
        addNamedRange(input) {
            return executeCommand('spreadsheet.desktop.named-ranges', {args: [buildDefinedName(input)]});
        },
        editNamedRange(original, input) {
            if (!original) throw workflowError('MOBILE_NAMED_RANGE_SELECTION_REQUIRED', 'Select a named range to edit');
            return executeCommand('spreadsheet.desktop.named-ranges', {
                operation: 'edit',
                args: [original, buildDefinedName(input)],
            });
        },
        deleteNamedRange(original) {
            if (!original) throw workflowError('MOBILE_NAMED_RANGE_SELECTION_REQUIRED', 'Select a named range to delete');
            return executeCommand('spreadsheet.desktop.named-ranges', {operation: 'delete', args: [original]});
        },
        listSheetViews() {
            return (requireApi().asc_getNamedSheetViews?.() || []).map(raw => ({
                raw,
                name: readValue(raw, ['asc_getName'], ''),
                active: readValue(raw, ['asc_getIsActive'], false) === true,
            }));
        },
        activateSheetView(view) {
            const name = view ? readValue(view, ['asc_getName'], view.name) : null;
            return executeCommand('spreadsheet.desktop.sheet-view', {value: name});
        },
        createSheetView() {
            return executeCommand('spreadsheet.desktop.sheet-view', {operation: 'create', args: [null, true]});
        },
        deleteSheetView(view) {
            if (!view) throw workflowError('MOBILE_SHEET_VIEW_SELECTION_REQUIRED', 'Select a sheet view to delete');
            return executeCommand('spreadsheet.desktop.sheet-view', {operation: 'delete', args: [[view]]});
        },
        changeOutline({group, rows}) {
            return executeCommand(group
                ? 'spreadsheet.desktop.cell-group'
                : 'spreadsheet.desktop.cell-ungroup', {value: rows === true});
        },
        fillCells(fillType) {
            if (fillType === undefined || fillType === null) {
                throw workflowError('MOBILE_FILL_TYPE_REQUIRED', 'Select a fill direction');
            }
            return executeCommand('spreadsheet.desktop.number-fill', {value: fillType});
        },
        setPivotBlankRows(value) {
            return executeCommand('spreadsheet.desktop.pivot-blank-rows', pivotPayload(value === true));
        },
        setPivotGrandTotals({rows, columns}) {
            return executeCommand('spreadsheet.desktop.pivot-grand-totals', pivotPayload(rows === true, properties => {
                properties.asc_setRowGrandTotals?.(rows === true);
                properties.asc_setColGrandTotals?.(columns === true);
            }));
        },
        setPivotLayout(layout) {
            const settings = {
                compact: {outline: true, compact: true},
                outline: {outline: true, compact: false},
                tabular: {outline: false, compact: false},
            }[layout];
            if (!settings) throw workflowError('MOBILE_PIVOT_LAYOUT_INVALID', `Unsupported pivot layout: ${layout}`);
            return executeCommand('spreadsheet.desktop.pivot-layout', pivotPayload(settings.outline, properties => {
                properties.asc_setOutline?.(settings.outline);
                properties.asc_setCompact?.(settings.compact);
            }));
        },
        setPivotSubtotals(position) {
            if (!['none', 'top', 'bottom'].includes(position)) {
                throw workflowError('MOBILE_PIVOT_SUBTOTALS_INVALID', `Unsupported pivot subtotal position: ${position}`);
            }
            const enabled = position !== 'none';
            return executeCommand('spreadsheet.desktop.pivot-subtotals', pivotPayload(enabled, properties => {
                properties.asc_setDefaultSubtotal?.(enabled);
                if (enabled) properties.asc_setSubtotalTop?.(position === 'top');
            }));
        },
        refreshPivot(scope = 'current') {
            const pivot = currentPivot();
            return executeCommand('spreadsheet.desktop.pivot-refresh', scope === 'all'
                ? {target: pivot, operation: 'all'}
                : {target: pivot});
        },
        setSparklineType(type) {
            if (![0, 1, 2].includes(type)) {
                throw workflowError('MOBILE_SPARKLINE_TYPE_INVALID', `Unsupported sparkline type: ${type}`);
            }
            const sparkline = currentSparkline();
            const id = readValue(sparkline, ['asc_getId']);
            if (id === null || id === undefined) {
                throw workflowError('MOBILE_SPARKLINE_ID_UNAVAILABLE', 'The selected sparkline does not have an identifier');
            }
            const properties = createSparklineProperties();
            properties.asc_setType(type);
            return executeCommand('spreadsheet.sparkline.type', {args: [id, properties]});
        },
    });
}
