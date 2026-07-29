/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const selectionDefinitions = Object.freeze([
    ['slide', ['slide']],
    ['paragraph', ['text', 'paragraph']],
    ['image', ['image', 'object']],
    ['table', ['table', 'object']],
    ['shape', ['shape', 'object']],
    ['chart', ['chart', 'object']],
    ['hyperlink', ['hyperlink']],
]);

const isLocked = value => typeof value?.get_Locked === 'function' && value.get_Locked();

export function describePresentationSelection(selection = [], types = {}) {
    const contexts = [];
    const values = Object.fromEntries(selectionDefinitions.map(([name]) => [name, null]));
    let locked = false;

    for (const item of selection) {
        const type = item?.get_ObjectType?.();
        const value = item?.get_ObjectValue?.() ?? null;
        const definition = selectionDefinitions.find(([name]) => types[name] === type);
        if (!definition) continue;

        const [name, tokens] = definition;
        if (values[name] === null) values[name] = value;
        for (const token of tokens) {
            if (!contexts.includes(token)) contexts.push(token);
        }
        locked = locked || isLocked(value);
    }

    return {contexts, locked, values};
}

export function createPresentationFocusInterface(store, types) {
    const describe = () => describePresentationSelection(store._focusObjects, types);
    return {
        filterFocusObjects: () => describe().contexts,
        getSlideObject: () => describe().values.slide,
        getParagraphObject: () => describe().values.paragraph,
        getImageObject: () => describe().values.image,
        getTableObject: () => describe().values.table,
        getShapeObject: () => describe().values.shape,
        getChartObject: () => describe().values.chart,
        getLinkObject: () => describe().values.hyperlink,
    };
}

const iconItem = (event, icon) => ({event, icon});
const textItem = (event, caption) => ({event, caption});

const contextActions = Object.freeze({
    addcomment: Object.freeze({kind: 'notification', event: 'addcomment'}),
    addlink: Object.freeze({kind: 'panel', target: 'add-link'}),
    chart: Object.freeze({kind: 'panel', target: 'edit'}),
    delete: Object.freeze({kind: 'sdkjs', method: 'asc_Remove'}),
    edit: Object.freeze({kind: 'panel', target: 'edit'}),
    editdata: Object.freeze({kind: 'sdkjs', method: 'asc_editChartInFrameEditor'}),
    image: Object.freeze({kind: 'panel', target: 'edit'}),
    replaceimage: Object.freeze({kind: 'panel', target: 'edit'}),
    shape: Object.freeze({kind: 'panel', target: 'edit'}),
});

export function resolvePresentationContextAction(action) {
    return contextActions[action] ?? null;
}

export function buildPresentationContextMenu({
    api,
    labels,
    permissions,
    selection,
    hasComments,
}) {
    const contexts = new Set(selection.contexts);
    const hasText = contexts.has('text');
    const hasObject = contexts.has('object');
    const hasLink = contexts.has('hyperlink');
    const hasChart = contexts.has('chart');
    const hasImage = contexts.has('image') && !hasChart;
    const hasShape = contexts.has('shape') && !hasChart;
    const canCopy = permissions.canCopy !== false && api.can_CopyCut();
    const canMutate = permissions.isEdit && !permissions.isDisconnected &&
        !permissions.isVersionHistoryMode && !selection.locked;
    const items = [];

    if (canCopy && (hasText || hasObject)) items.push(iconItem('copy', 'icon-copy'));
    if (canCopy && canMutate && (hasText || hasObject)) {
        items.push(iconItem('cut', 'icon-cut'));
    }
    if (canMutate && (hasText || hasObject)) {
        items.push(iconItem('paste', 'icon-paste'));
        items.push(textItem('delete', labels.menuDelete));
        items.push(textItem('edit', labels.menuEdit));
        if (hasChart) {
            items.push(textItem('chart', labels.menuChart));
            items.push(textItem('editdata', labels.menuEditData));
        } else if (hasImage) {
            items.push(textItem('image', labels.menuImage));
            items.push(textItem('replaceimage', labels.menuReplaceImage));
        } else if (hasShape) {
            items.push(textItem('shape', labels.menuShape));
        }
        if (hasText && !hasLink && !hasChart) {
            items.push(textItem('addlink', labels.menuAddLink));
        }
    }
    if (permissions.canViewComments && hasComments) {
        items.push(textItem('viewcomment', labels.menuViewComment));
    }
    if (canMutate && hasText && !hasChart && permissions.canCoAuthoring && permissions.canComments &&
        api.can_AddQuotedComment() !== false) {
        items.push(textItem('addcomment', labels.menuAddComment));
    }
    if (hasLink) items.push(textItem('openlink', labels.menuOpenLink));

    return items;
}
