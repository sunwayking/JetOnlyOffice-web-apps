import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildPresentationContextMenu,
    createPresentationFocusInterface,
    describePresentationSelection,
    resolvePresentationContextAction,
} from '../src/lib/presentationUiModel.mjs';

const types = Object.freeze({
    slide: 1,
    paragraph: 2,
    image: 3,
    table: 4,
    shape: 5,
    chart: 6,
    hyperlink: 7,
});

const selected = (type, value = {}) => ({
    get_ObjectType: () => type,
    get_ObjectValue: () => value,
});

test('presentation selection model exposes every editable canvas context', () => {
    const slide = {get_LockDelete: () => false};
    const paragraph = {get_Locked: () => false};
    const chart = {get_Locked: () => true};
    const selection = [
        selected(types.slide, slide),
        selected(types.paragraph, paragraph),
        selected(types.chart, chart),
        selected(types.hyperlink, {}),
    ];

    assert.deepEqual(describePresentationSelection(selection, types), {
        contexts: ['slide', 'text', 'paragraph', 'chart', 'object', 'hyperlink'],
        locked: true,
        values: {
            slide,
            paragraph,
            image: null,
            table: null,
            shape: null,
            chart,
            hyperlink: {},
        },
    });
});

test('presentation focus interface follows store selection without stale copies', () => {
    const store = {_focusObjects: [selected(types.image, {id: 'image-1'})]};
    const focus = createPresentationFocusInterface(store, types);

    assert.deepEqual(focus.filterFocusObjects(), ['image', 'object']);
    assert.equal(focus.getImageObject().id, 'image-1');
    assert.equal(focus.getChartObject(), null);

    store._focusObjects = [selected(types.chart, {id: 'chart-2'})];
    assert.deepEqual(focus.filterFocusObjects(), ['chart', 'object']);
    assert.equal(focus.getChartObject().id, 'chart-2');
});

test('presentation context menu is permission and lock aware for text and objects', () => {
    const labels = {
        menuAddComment: 'Add comment',
        menuAddLink: 'Add link',
        menuChart: 'Chart',
        menuDelete: 'Delete',
        menuEdit: 'Edit',
        menuEditData: 'Edit data',
        menuImage: 'Image',
        menuOpenLink: 'Open link',
        menuReplaceImage: 'Replace image',
        menuShape: 'Shape',
        menuViewComment: 'View comment',
    };
    const api = {
        can_CopyCut: () => true,
        can_AddQuotedComment: () => true,
    };
    const editable = {
        canComments: true,
        canCoAuthoring: true,
        canCopy: true,
        canViewComments: true,
        isDisconnected: false,
        isEdit: true,
        isVersionHistoryMode: false,
    };
    const selection = describePresentationSelection([
        selected(types.paragraph, {get_Locked: () => false}),
        selected(types.hyperlink, {}),
    ], types);

    assert.deepEqual(buildPresentationContextMenu({
        api,
        labels,
        permissions: editable,
        selection,
        hasComments: true,
    }).map(item => item.event), [
        'copy', 'cut', 'paste', 'delete', 'edit', 'viewcomment', 'addcomment', 'openlink',
    ]);

    const locked = describePresentationSelection([
        selected(types.chart, {get_Locked: () => true}),
    ], types);
    assert.deepEqual(buildPresentationContextMenu({
        api,
        labels,
        permissions: editable,
        selection: locked,
        hasComments: false,
    }).map(item => item.event), ['copy']);
});

test('presentation context menu follows Android object-specific actions', () => {
    const labels = {
        menuAddComment: 'Add comment',
        menuAddLink: 'Add link',
        menuChart: 'Chart',
        menuDelete: 'Delete',
        menuEdit: 'Edit',
        menuEditData: 'Edit data',
        menuImage: 'Image',
        menuOpenLink: 'Open link',
        menuReplaceImage: 'Replace image',
        menuShape: 'Shape',
        menuViewComment: 'View comment',
    };
    const permissions = {
        canComments: true,
        canCoAuthoring: true,
        canCopy: true,
        canViewComments: true,
        isDisconnected: false,
        isEdit: true,
        isVersionHistoryMode: false,
    };
    const menuEvents = (selection, canCopy = true) => buildPresentationContextMenu({
        api: {
            can_AddQuotedComment: () => true,
            can_CopyCut: () => canCopy,
        },
        labels,
        permissions,
        selection: describePresentationSelection(selection, types),
        hasComments: false,
    }).map(item => item.event);

    assert.deepEqual(menuEvents([
        selected(types.shape, {get_Locked: () => false}),
        selected(types.paragraph, {get_Locked: () => false}),
    ], false), ['paste', 'delete', 'edit', 'shape', 'addlink', 'addcomment']);
    assert.deepEqual(menuEvents([
        selected(types.image, {get_Locked: () => false}),
    ]), ['copy', 'cut', 'paste', 'delete', 'edit', 'image', 'replaceimage']);
    assert.deepEqual(menuEvents([
        selected(types.chart, {get_Locked: () => false}),
    ]), ['copy', 'cut', 'paste', 'delete', 'edit', 'chart', 'editdata']);
});

test('presentation chart text keeps the chart menu free of comment actions', () => {
    const labels = {
        menuAddComment: 'Add comment',
        menuAddLink: 'Add link',
        menuChart: 'Chart',
        menuDelete: 'Delete',
        menuEdit: 'Edit',
        menuEditData: 'Edit data',
        menuImage: 'Image',
        menuOpenLink: 'Open link',
        menuReplaceImage: 'Replace image',
        menuShape: 'Shape',
        menuViewComment: 'View comment',
    };
    const selection = describePresentationSelection([
        selected(types.chart, {get_Locked: () => false}),
        selected(types.paragraph, {get_Locked: () => false}),
    ], types);
    const events = buildPresentationContextMenu({
        api: {
            can_CopyCut: () => true,
            can_AddQuotedComment: () => true,
        },
        labels,
        permissions: {
            canComments: true,
            canCoAuthoring: true,
            canCopy: true,
            canViewComments: true,
            isDisconnected: false,
            isEdit: true,
            isVersionHistoryMode: false,
        },
        selection,
        hasComments: false,
    }).map(item => item.event);

    assert.deepEqual(events, ['copy', 'cut', 'paste', 'delete', 'edit', 'chart', 'editdata']);
});

test('presentation context actions resolve to real panels, SDKJS methods, or notifications', () => {
    assert.deepEqual(resolvePresentationContextAction('delete'), {kind: 'sdkjs', method: 'asc_Remove'});
    assert.deepEqual(resolvePresentationContextAction('editdata'), {kind: 'sdkjs', method: 'asc_editChartInFrameEditor'});
    assert.deepEqual(resolvePresentationContextAction('shape'), {kind: 'panel', target: 'edit'});
    assert.deepEqual(resolvePresentationContextAction('replaceimage'), {kind: 'panel', target: 'edit'});
    assert.deepEqual(resolvePresentationContextAction('addlink'), {kind: 'panel', target: 'add-link'});
    assert.deepEqual(resolvePresentationContextAction('addcomment'), {kind: 'notification', event: 'addcomment'});
    assert.equal(resolvePresentationContextAction('unknown'), null);
});
