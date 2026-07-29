/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    createPdfCommandProvider,
    PDF_TASK_SPACE_IDS,
} from '../src/lib/pdfCommandProvider.mjs';
import {
    filterPdfCommandSearchResults,
    normalizePdfParticipants,
    resolvePdfCommandInput,
    resolvePdfSelectionContext,
} from '../src/lib/pdfMobileUiModel.mjs';

const catalogUrl = new URL('../src/commands/mobile-command-catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));

const SDK_METHODS = Object.freeze([
    'Undo',
    'Redo',
    'put_TextPrBold',
    'put_TextPrItalic',
    'put_TextPrUnderline',
    'put_TextPrStrikeout',
    'put_TextPrBaseline',
    'asc_ChangeTextCase',
    'put_PrAlign',
    'asc_setRtlTextDirection',
    'asc_Save',
    'Copy',
    'Cut',
    'Paste',
    'asc_EditSelectAll',
    'ClearFormating',
    'FontSizeIn',
    'FontSizeOut',
    'IncreaseIndent',
    'DecreaseIndent',
    'asc_remove',
    'asc_setViewerTargetType',
    'SetRedactTool',
    'HasRedact',
    'asc_IsPermanentRedactionSupported',
    'asc_HasAppliedRedaction',
    'ApplyRedact',
    'AddRedactBySelect',
    'RedactPages',
    'RemoveAllRedact',
    'asc_findText',
    'asc_RedactAllSearchElements',
    'asc_addImage',
    'AddImageUrl',
    'StartAddShape',
    'AddTextArt',
    'put_Table',
    'asc_addComment',
    'SetMarkerFormat',
    'asc_StartDrawInk',
    'asc_StopInkDrawer',
    'asc_AddPage',
    'asc_RemovePage',
    'asc_RotatePage',
    'asc_CanRemovePages',
    'asc_CanRotatePages',
    'asc_CanPastePage',
    'groupShapes',
    'unGroupShapes',
    'shapes_bringToFront',
    'shapes_bringToBack',
    'shapes_bringForward',
    'shapes_bringBackward',
    'MergeCells',
    'asc_DistributeTableCells',
    'AddTextField',
    'AddDateField',
    'AddImageField',
    'AddCheckboxField',
    'AddRadiobuttonField',
    'AddComboboxField',
    'AddListboxField',
    'asc_ClearAllSpecialForms',
    'asc_MoveToFillingForm',
    'asc_SendForm',
    'AddSignatureField',
    'asc_IsSignatureAppearancePersistenceSupported',
    'asc_SetSignatureFieldAppearance',
    'asc_getSignatureFields',
    'asc_getSignatures',
    'asc_getRequestSignatures',
    'zoomFitToPage',
    'zoomFitToWidth',
    'zoomIn',
    'zoomOut',
    'zoom',
]);

function createExplicitApi(calls, callbacks = new Map()) {
    const api = {
        getSelectedElements: () => [{ type: 'pdf-page' }],
        getSelectedPages: () => [2],
        getCurrentPage: () => 3,
        asc_registerCallback(name, callback) {
            callbacks.set(name, callback);
        },
        asc_unregisterCallback(name, callback) {
            if (callbacks.get(name) === callback) callbacks.delete(name);
        },
    };
    for (const method of SDK_METHODS) {
        if (/^(?:asc_Can|asc_Is|asc_Has)/.test(method)) {
            api[method] = () => true;
            continue;
        }
        api[method] = (...args) => {
            calls.push([method, ...args]);
            return method.startsWith('asc_get') ? [] : undefined;
        };
    }
    return api;
}

test('PDF catalog exposes the six direct Mobile task spaces', () => {
    assert.deepEqual(PDF_TASK_SPACE_IDS, [
        'edit',
        'insert',
        'comment',
        'pages',
        'forms',
        'signatures',
    ]);
    assert.deepEqual(catalog.taskSpaces.map(taskSpace => taskSpace.id), PDF_TASK_SPACE_IDS);
    assert.ok(catalog.commands.length >= 24);

    const commandIds = new Set();
    for (const command of catalog.commands) {
        assert.match(command.id, /^pdf\./);
        assert.ok(PDF_TASK_SPACE_IDS.includes(command.taskSpace) || command.scope === 'global', command.id);
        assert.ok(['view', 'edit', 'comment', 'fillForms'].includes(command.permission), command.id);
        assert.equal(typeof command.binding.method, 'string', command.id);
        assert.ok(command.testIds.length > 0, command.id);
        assert.equal(commandIds.has(command.id), false, command.id);
        commandIds.add(command.id);
    }
});

test('PDF provider implements the shared editor adapter contract with real SDK calls', async () => {
    const calls = [];
    const callbacks = new Map();
    const api = createExplicitApi(calls, callbacks);
    let hasRedactionMarks = true;
    let completeSearch;
    api.HasRedact = () => hasRedactionMarks;
    api.ApplyRedact = () => {
        calls.push(['ApplyRedact']);
        hasRedactionMarks = false;
    };
    api.asc_findText = (settings, isNext, callback) => {
        calls.push(['asc_findText', settings, true]);
        assert.equal(isNext, true);
        completeSearch = callback;
        return 0;
    };
    api.asc_SetSignatureFieldAppearance = appearance => {
        calls.push(['asc_SetSignatureFieldAppearance', appearance]);
        return true;
    };
    const provider = createPdfCommandProvider({ catalog, getApi: () => api });

    for (const method of [
        'getSelectionSnapshot',
        'subscribeState',
        'getCommandDescriptors',
        'execute',
        'resolveContextMenu',
        'captureViewState',
        'restoreViewState',
    ]) assert.equal(typeof provider[method], 'function', method);

    provider.execute('pdf.edit.undo');
    provider.execute('pdf.redaction.mark', { value: true });
    provider.execute('pdf.redaction.selection');
    provider.execute('pdf.redaction.current-page');
    provider.execute('pdf.redaction.pages', { pages: [0, 2] });
    const redactSearch = provider.execute('pdf.redaction.search-all', {settings: {text: 'secret'}});
    assert.equal(calls.some(call => call[0] === 'asc_RedactAllSearchElements'), false);
    completeSearch(2);
    assert.equal(await redactSearch, 2);
    provider.execute('pdf.redaction.apply', {confirmed: true});
    provider.execute('pdf.insert.image-url', { urls: ['https://example.test/sign.png'] });
    provider.execute('pdf.comment.add', { comment: 'review' });
    provider.execute('pdf.pages.add', { index: 3 });
    provider.execute('pdf.pages.rotate', { angle: 90, pages: [3] });
    provider.execute('pdf.forms.text', { params: { required: true } });
    provider.execute('pdf.forms.signature');
    provider.execute('pdf.signatures.apply-appearance', {
        appearance: { fieldId: 'sig-1', mode: 'typed', text: 'Alice' },
    });

    assert.deepEqual(calls, [
        ['Undo'],
        ['SetRedactTool', true],
        ['AddRedactBySelect'],
        ['RedactPages', [3]],
        ['RedactPages', [0, 2]],
        ['asc_findText', {text: 'secret'}, true],
        ['asc_RedactAllSearchElements'],
        ['ApplyRedact'],
        ['AddImageUrl', ['https://example.test/sign.png']],
        ['asc_addComment', 'review'],
        ['asc_AddPage', 3],
        ['asc_RotatePage', 90, [3]],
        ['AddTextField', { required: true }],
        ['AddSignatureField', {}],
        ['asc_SetSignatureFieldAppearance', { fieldId: 'sig-1', mode: 'typed', text: 'Alice' }],
    ]);
    assert.deepEqual(provider.getSelectionSnapshot(), [{ type: 'pdf-page' }]);
    assert.equal(provider.getCommandDescriptors().length, catalog.commands.length);
});

test('PDF provider routes view settings through the Runtime command boundary', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    provider.execute('pdf.view.fit-page');
    provider.execute('pdf.view.fit-width');
    provider.execute('pdf.view.zoom', {value: 125});

    assert.deepEqual(calls, [
        ['zoomFitToPage'],
        ['zoomFitToWidth'],
        ['zoom', 125],
    ]);
    assert.throws(
        () => provider.execute('pdf.view.zoom', {value: Number.POSITIVE_INFINITY}),
        error => error.code === 'MOBILE_COMMAND_PAYLOAD_INVALID',
    );
});

test('PDF provider resolves only catalogued context commands', () => {
    const provider = createPdfCommandProvider({catalog, getApi: () => createExplicitApi([])});

    assert.deepEqual(provider.resolveContextMenu({commands: [
        'pdf.pages.rotate',
        'pdf.unknown',
        'pdf.pages.rotate',
        'pdf.pages.remove',
    ]}), ['pdf.pages.rotate', 'pdf.pages.remove']);
});

test('PDF Mobile selection, participants and command search derive from live SDK facts', () => {
    const Asc = {c_oAscTypeSelectElement: {Field: 1, Annot: 2, PdfPage: 3}};
    const selection = [{get_ObjectType: () => Asc.c_oAscTypeSelectElement.PdfPage}];
    assert.deepEqual(resolvePdfSelectionContext(selection, Asc), {
        kind: 'page',
        commands: [
            'pdf.clipboard.copy',
            'pdf.pages.cut',
            'pdf.pages.paste-before',
            'pdf.pages.paste-after',
            'pdf.redaction.current-page',
            'pdf.pages.add',
            'pdf.pages.rotate',
            'pdf.pages.remove',
        ],
    });
    assert.deepEqual(resolvePdfSelectionContext([{}], {}), {
        kind: 'selection',
        commands: [
            'pdf.clipboard.copy',
            'pdf.clipboard.cut',
            'pdf.clipboard.paste',
            'pdf.redaction.selection',
            'pdf.comment.add',
            'pdf.annotation.marker',
        ],
    });

    const participants = normalizePdfParticipants({
        alice: {
            asc_getIdOriginal: () => 'alice',
            asc_getUserName: () => 'Alice',
            asc_getView: () => false,
        },
        guest: {
            asc_getId: () => 'guest',
            asc_getUserName: () => '',
            asc_getView: () => true,
        },
    });
    assert.deepEqual(participants, [
        {id: 'alice', name: 'Alice', view: false},
        {id: 'guest', name: 'Guest', view: true},
    ]);

    const results = filterPdfCommandSearchResults({
        commands: catalog.commands,
        query: 'zoom',
        labelFor: command => command.id === 'pdf.view.zoom' ? 'Zoom' : command.id,
        resolve: commandId => ({available: commandId === 'pdf.view.zoom'}),
    });
    assert.deepEqual(results.map(command => command.id), ['pdf.view.zoom']);

    assert.deepEqual(resolvePdfCommandInput('pdf.redaction.pages', true), {
        commandId: 'pdf.redaction.pages',
        inputMode: 'text',
        label: '页码或范围',
        multiline: false,
        placeholder: '例如 1, 3-5',
        type: 'text',
    });
    assert.deepEqual(resolvePdfCommandInput('pdf.comment.add', false), {
        commandId: 'pdf.comment.add',
        inputMode: 'text',
        label: 'Comment',
        multiline: true,
        placeholder: 'Enter a comment',
        type: 'text',
    });
    assert.equal(resolvePdfCommandInput('pdf.edit.undo', true), null);
});

test('PDF redaction search serializes work and is cancelled by provider disposal', async () => {
    const calls = [];
    let completeSearch;
    const api = createExplicitApi(calls);
    api.asc_findText = (settings, isNext, callback) => {
        completeSearch = callback;
        return 0;
    };
    const provider = createPdfCommandProvider({catalog, getApi: () => api});
    const first = provider.execute('pdf.redaction.search-all', {settings: {text: 'first'}});

    assert.throws(
        () => provider.execute('pdf.redaction.search-all', {settings: {text: 'second'}}),
        error => error.code === 'MOBILE_COMMAND_BUSY',
    );
    provider.dispose();
    await assert.rejects(first, error => error.code === 'MOBILE_ADAPTER_DISPOSED');
    completeSearch(1);
    assert.equal(calls.some(call => call[0] === 'asc_RedactAllSearchElements'), false);
});

test('PDF provider fails closed for missing SDK bindings and invalid payloads', () => {
    const api = createExplicitApi([]);
    delete api.asc_ClearAllSpecialForms;
    const provider = createPdfCommandProvider({ catalog, getApi: () => api });

    assert.throws(
        () => provider.execute('pdf.forms.clear'),
        error => error.code === 'MOBILE_COMMAND_BINDING_UNAVAILABLE' &&
            error.details.method === 'asc_ClearAllSpecialForms',
    );
    assert.throws(
        () => provider.execute('pdf.pages.rotate', { angle: 45, pages: [0] }),
        error => error.code === 'MOBILE_COMMAND_PAYLOAD_INVALID',
    );
    assert.throws(
        () => provider.execute('pdf.insert.image-url', { urls: [] }),
        error => error.code === 'MOBILE_COMMAND_PAYLOAD_INVALID',
    );
    assert.throws(
        () => provider.execute('pdf.redaction.apply'),
        error => error.code === 'MOBILE_REDACTION_CONFIRMATION_REQUIRED',
    );
    assert.throws(
        () => provider.execute('pdf.redaction.search-all', {}),
        error => error.code === 'MOBILE_COMMAND_PAYLOAD_INVALID',
    );
});

test('PDF provider applies permanent redaction only after SDK-confirmed marks and explicit consent', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    let hasRedactionMarks = false;
    api.HasRedact = () => hasRedactionMarks;
    api.ApplyRedact = () => {
        calls.push(['ApplyRedact']);
        hasRedactionMarks = false;
    };
    let hasAppliedRedaction = true;
    api.asc_HasAppliedRedaction = () => hasAppliedRedaction;
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    assert.throws(
        () => provider.execute('pdf.redaction.apply', {confirmed: true}),
        error => error.code === 'MOBILE_REDACTION_MARKS_UNAVAILABLE',
    );
    assert.deepEqual(calls, []);

    hasRedactionMarks = true;
    provider.execute('pdf.redaction.apply', {confirmed: true});
    assert.deepEqual(calls, [['ApplyRedact']]);

    hasRedactionMarks = true;
    api.ApplyRedact = () => calls.push(['ApplyRedact']);
    assert.throws(
        () => provider.execute('pdf.redaction.apply', {confirmed: true}),
        error => error.code === 'MOBILE_REDACTION_APPLY_UNCONFIRMED',
    );

    hasRedactionMarks = true;
    hasAppliedRedaction = false;
    api.ApplyRedact = () => {
        calls.push(['ApplyRedact']);
        hasRedactionMarks = false;
    };
    assert.throws(
        () => provider.execute('pdf.redaction.apply', {confirmed: true}),
        error => error.code === 'MOBILE_REDACTION_PERSISTENCE_UNCONFIRMED',
    );
});

test('PDF provider fails closed when the SDK cannot remove redacted content', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    api.asc_IsPermanentRedactionSupported = () => false;
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    for (const commandId of [
        'pdf.redaction.mark',
        'pdf.redaction.selection',
        'pdf.redaction.current-page',
        'pdf.redaction.apply',
        'pdf.redaction.pages',
        'pdf.redaction.search-all',
    ]) {
        assert.deepEqual(provider.resolveCapability(commandId), {
            available: false,
            reason: 'permanent-redaction-unavailable',
        }, commandId);
    }
    assert.deepEqual(provider.resolveCapability('pdf.redaction.discard'), {available: true});
    assert.throws(
        () => provider.execute('pdf.redaction.apply', {confirmed: true}),
        error => error.code === 'MOBILE_COMMAND_CAPABILITY_UNAVAILABLE' &&
            error.details.reason === 'permanent-redaction-unavailable',
    );
    assert.deepEqual(calls, []);
});

test('PDF provider separates certificate signatures from form fields and fails closed on unpersisted appearance', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    api.asc_getSignatures = () => ['certificate'];
    api.asc_getSignatureFields = () => ['field'];
    api.asc_getRequestSignatures = () => ['requested'];
    api.asc_IsSignatureAppearancePersistenceSupported = () => false;
    api.asc_SetSignatureFieldAppearance = () => false;
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    assert.deepEqual(provider.execute('pdf.signatures.certificates'), ['certificate']);
    assert.deepEqual(provider.execute('pdf.signatures.fields'), ['field']);
    assert.deepEqual(provider.execute('pdf.signatures.requested'), ['requested']);
    assert.deepEqual(provider.resolveCapability('pdf.signatures.apply-appearance'), {
        available: false,
        reason: 'signature-appearance-persistence-unavailable',
    });
    assert.throws(
        () => provider.execute('pdf.signatures.apply-appearance', {
            appearance: {fieldId: 'sig-1', mode: 'typed', text: 'Alice'},
        }),
        error => error.code === 'MOBILE_COMMAND_CAPABILITY_UNAVAILABLE' &&
            error.details.reason === 'signature-appearance-persistence-unavailable',
    );
});

test('PDF provider reports SDK capability gaps and preserves page, scroll and zoom across resize', () => {
    const callbacks = new Map();
    const calls = [];
    const api = createExplicitApi(calls, callbacks);
    api.getCurrentPage = () => 4;
    api.getCurScroll = () => ({x: 32, y: 640});
    api.goToPage = page => calls.push(['goToPage', page]);
    api.scrollToXY = (x, y) => calls.push(['scrollToXY', x, y]);
    api.zoom = value => calls.push(['zoom', value]);
    api.Resize = () => calls.push(['Resize']);
    delete api.asc_ClearAllSpecialForms;
    const provider = createPdfCommandProvider({catalog, getApi: () => api});
    const detach = provider.subscribeState(() => {});

    callbacks.get('asc_onZoomChange')(125, 0);
    assert.deepEqual(provider.captureViewState(), {
        page: 4,
        scroll: {x: 32, y: 640},
        zoom: 125,
    });
    provider.restoreViewState({page: 4, scroll: {x: 32, y: 640}, zoom: 125});
    assert.deepEqual(calls.slice(-3), [
        ['goToPage', 4],
        ['zoom', 125],
        ['scrollToXY', 32, 640],
    ]);
    assert.deepEqual(provider.resolveCapability('pdf.forms.clear'), {
        available: false,
        reason: 'sdk-binding-unavailable',
        missingMethods: ['asc_ClearAllSpecialForms'],
    });
    detach();
});

test('PDF provider publishes real lifecycle and signature facts and detaches cleanly', () => {
    const callbacks = new Map();
    const api = {
        asc_registerCallback: (name, callback) => callbacks.set(name, callback),
        asc_unregisterCallback: (name, callback) => {
            if (callbacks.get(name) === callback) callbacks.delete(name);
        },
        asc_getRequestSignatures: () => [{guid: 'sig-1'}],
    };
    const provider = createPdfCommandProvider({ catalog, getApi: () => api });
    const events = [];
    const detach = provider.subscribeState(event => events.push(event));

    callbacks.get('asc_onDocumentOpenStateChanged')({ phase: 'render-first-page' });
    callbacks.get('asc_onTransportStateChanged')({ state: 'connected' });
    callbacks.get('asc_onServerSaveStateChanged')({ state: 'accepted', scope: 'coauthoring-server' });
    callbacks.get('asc_onSignatureFieldClick')({ id: 'sig-1' }, 120, 48);
    callbacks.get('asc_onUpdateSignatures')([{id: 'certificate-1'}]);
    callbacks.get('asc_onUpdateSignatureFields')([{ guid: 'sig-1' }]);

    assert.deepEqual(events, [
        { type: 'document-open', phase: 'render-first-page' },
        { type: 'transport', state: 'connected' },
        { type: 'server-save', state: 'accepted', scope: 'coauthoring-server' },
        { type: 'signature-field', signature: { id: 'sig-1' }, width: 120, height: 48 },
        {type: 'certificate-signature-state', certificates: [{id: 'certificate-1'}]},
        { type: 'signature-field-state', fields: [{ guid: 'sig-1' }], requested: [{ guid: 'sig-1' }] },
    ]);

    detach();
    assert.equal(callbacks.size, 0);
    provider.dispose();
    assert.throws(
        () => provider.execute('pdf.edit.undo'),
        error => error.code === 'MOBILE_ADAPTER_DISPOSED',
    );
});

test('PDF Mobile has an independent route and deterministic build entry', async () => {
    const [apiSource, buildConfig, packageConfig, appSource, shellSource] = await Promise.all([
        readFile(new URL('../../../api/documents/api.js', import.meta.url), 'utf8'),
        readFile(new URL('../../../../build/pdfeditor.json', import.meta.url), 'utf8'),
        readFile(new URL('../../../../vendor/framework7-react/package.json', import.meta.url), 'utf8'),
        readFile(new URL('../src/app.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/view/PdfMobileApp.jsx', import.meta.url), 'utf8'),
    ]);

    assert.match(apiSource, /appType\s*=\s*'pdf'/);
    assert.match(buildConfig, /"mobile"\s*:/);
    assert.match(packageConfig, /"deploy-pdf"\s*:/);
    assert.match(appSource, /window\.JetOnlyOfficePdfMobile/);
    assert.match(appSource, /event\.persisted/);
    assert.match(shellSource, /PDF_TASK_SPACE_IDS\.map/);
    assert.match(appSource, /resolveContextMenu/);
    assert.match(shellSource, /asc_onAuthParticipantsChanged/);
    assert.match(shellSource, /asc_onParticipantsChanged/);
    assert.match(shellSource, /<Search/);
    assert.match(shellSource, /<Person2/);
    assert.match(shellSource, /<Gear/);
    assert.doesNotMatch(appSource + shellSource, /setTimeout|setInterval/);
});

test('PDF provider enforces live SDK page capabilities at the execution boundary', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    api.asc_CanRemovePages = () => false;
    api.asc_CanRotatePages = () => false;
    api.asc_CanPastePage = () => false;
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    for (const commandId of [
        'pdf.pages.remove',
        'pdf.pages.rotate',
        'pdf.pages.paste-before',
        'pdf.pages.paste-after',
    ]) {
        assert.deepEqual(provider.resolveCapability(commandId), {
            available: false,
            reason: 'sdk-capability-denied',
        }, commandId);
        assert.throws(
            () => provider.execute(commandId, commandId === 'pdf.pages.rotate' ? {angle: 90} : undefined),
            error => error.code === 'MOBILE_COMMAND_CAPABILITY_UNAVAILABLE' &&
                error.details.commandId === commandId,
            commandId,
        );
    }
    assert.deepEqual(calls, []);
});

test('PDF provider exposes form filling navigation, clearing and submission through SDK bindings', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    provider.execute('pdf.forms.previous');
    provider.execute('pdf.forms.next');
    provider.execute('pdf.forms.clear');
    provider.execute('pdf.forms.submit');

    assert.deepEqual(calls, [
        ['asc_MoveToFillingForm', false],
        ['asc_MoveToFillingForm', true],
        ['asc_ClearAllSpecialForms'],
        ['asc_SendForm'],
    ]);
    assert.equal(
        provider.getCommandDescriptors().find(command => command.id === 'pdf.forms.clear').permission,
        'fillForms',
    );
});

test('PDF provider binds core editing, page, object and view commands to the real SDK API', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    api.getSelectedElements = () => [{get_ObjectType: () => 'annotation'}];
    api.getCurrentPage = () => 2;
    api.getCountPages = () => 5;
    api.goToPage = page => calls.push(['goToPage', page]);
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    provider.execute('pdf.file.save');
    provider.execute('pdf.clipboard.copy');
    provider.execute('pdf.clipboard.cut');
    provider.execute('pdf.clipboard.paste');
    provider.execute('pdf.edit.select-all');
    provider.execute('pdf.edit.clear-formatting');
    provider.execute('pdf.edit.font-size-increase');
    provider.execute('pdf.edit.font-size-decrease');
    provider.execute('pdf.edit.indent-increase');
    provider.execute('pdf.edit.indent-decrease');
    provider.execute('pdf.edit.select-tool');
    provider.execute('pdf.edit.hand-tool');
    provider.execute('pdf.pages.copy');
    provider.execute('pdf.pages.cut');
    provider.execute('pdf.pages.paste-before');
    provider.execute('pdf.pages.paste-after');
    provider.execute('pdf.pages.first');
    provider.execute('pdf.pages.previous');
    provider.execute('pdf.pages.next');
    provider.execute('pdf.pages.last');
    provider.execute('pdf.annotation.remove-selected');
    provider.execute('pdf.object.group');
    provider.execute('pdf.object.ungroup');
    provider.execute('pdf.object.bring-front');
    provider.execute('pdf.object.bring-back');
    provider.execute('pdf.object.bring-forward');
    provider.execute('pdf.object.bring-backward');
    provider.execute('pdf.table.merge-cells');
    provider.execute('pdf.table.distribute-rows');
    provider.execute('pdf.table.distribute-columns');
    provider.execute('pdf.view.zoom-in');
    provider.execute('pdf.view.zoom-out');

    assert.deepEqual(calls, [
        ['asc_Save'],
        ['Copy'],
        ['Cut'],
        ['Paste'],
        ['asc_EditSelectAll'],
        ['ClearFormating'],
        ['FontSizeIn'],
        ['FontSizeOut'],
        ['IncreaseIndent'],
        ['DecreaseIndent'],
        ['asc_setViewerTargetType', 'select'],
        ['asc_setViewerTargetType', 'hand'],
        ['Copy'],
        ['Cut'],
        ['Paste', true],
        ['Paste', false],
        ['goToPage', 0],
        ['goToPage', 1],
        ['goToPage', 3],
        ['goToPage', 4],
        ['asc_remove'],
        ['groupShapes'],
        ['unGroupShapes'],
        ['shapes_bringToFront'],
        ['shapes_bringToBack'],
        ['shapes_bringForward'],
        ['shapes_bringBackward'],
        ['MergeCells'],
        ['asc_DistributeTableCells', false],
        ['asc_DistributeTableCells', true],
        ['zoomIn'],
        ['zoomOut'],
    ]);
});

test('PDF provider removes selected content only for an explicit annotation selection', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    let selection = [{}];
    api.getSelectedElements = () => selection;
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    assert.deepEqual(provider.resolveCapability('pdf.annotation.remove-selected'), {
        available: false,
        reason: 'annotation-selection-required',
    });
    assert.throws(
        () => provider.execute('pdf.annotation.remove-selected'),
        error => error.code === 'MOBILE_COMMAND_CAPABILITY_UNAVAILABLE' &&
            error.details.reason === 'annotation-selection-required',
    );
    assert.deepEqual(calls, []);

    selection = [{get_ObjectType: () => 'annotation'}];
    assert.deepEqual(provider.resolveCapability('pdf.annotation.remove-selected'), {available: true});
    provider.execute('pdf.annotation.remove-selected');
    assert.deepEqual(calls, [['asc_remove']]);
});

test('PDF provider exposes Desktop text formatting and specialized form presets', () => {
    const calls = [];
    const provider = createPdfCommandProvider({catalog, getApi: () => createExplicitApi(calls)});

    provider.execute('pdf.edit.bold', {enabled: true});
    provider.execute('pdf.edit.italic', {enabled: false});
    provider.execute('pdf.edit.underline', {enabled: true});
    provider.execute('pdf.edit.strikeout', {enabled: false});
    provider.execute('pdf.edit.superscript', {baseline: 2});
    provider.execute('pdf.edit.subscript', {baseline: 1});
    provider.execute('pdf.edit.change-case', {value: 0});
    provider.execute('pdf.edit.horizontal-align', {value: 0});
    provider.execute('pdf.edit.text-direction', {rtl: true});
    provider.execute('pdf.forms.email');
    provider.execute('pdf.forms.phone');
    provider.execute('pdf.forms.credit-card');
    provider.execute('pdf.forms.zip-code');

    assert.deepEqual(calls, [
        ['put_TextPrBold', true],
        ['put_TextPrItalic', false],
        ['put_TextPrUnderline', true],
        ['put_TextPrStrikeout', false],
        ['put_TextPrBaseline', 2],
        ['put_TextPrBaseline', 1],
        ['asc_ChangeTextCase', 0],
        ['put_PrAlign', 0],
        ['asc_setRtlTextDirection', true],
        ['AddTextField', {reg: '\\S+@\\S+\\.\\S+', placeholder: 'user_name@email.com'}],
        ['AddTextField', {mask: '(999)999-9999', placeholder: '(999)999-9999'}],
        ['AddTextField', {mask: '9999-9999-9999-9999', placeholder: '9999-9999-9999-9999'}],
        ['AddTextField', {mask: '99999-9999', placeholder: '99999-9999'}],
    ]);
});

test('PDF provider rejects malformed text formatting payloads before calling the SDK', () => {
    const calls = [];
    const provider = createPdfCommandProvider({catalog, getApi: () => createExplicitApi(calls)});
    const invalidPayloads = [
        ['pdf.edit.bold', undefined],
        ['pdf.edit.bold', {}],
        ['pdf.edit.bold', []],
        ['pdf.edit.bold', {enabled: 'false'}],
        ['pdf.edit.italic', {enabled: 1}],
        ['pdf.edit.underline', {enabled: null}],
        ['pdf.edit.strikeout', {enabled: 'true'}],
        ['pdf.edit.superscript', {baseline: 1}],
        ['pdf.edit.superscript', {baseline: 3}],
        ['pdf.edit.subscript', {baseline: 2}],
        ['pdf.edit.subscript', {baseline: -1}],
        ['pdf.edit.change-case', {}],
        ['pdf.edit.change-case', {value: -1}],
        ['pdf.edit.change-case', {value: 5}],
        ['pdf.edit.change-case', {value: '0'}],
        ['pdf.edit.horizontal-align', {}],
        ['pdf.edit.horizontal-align', {value: 4}],
        ['pdf.edit.horizontal-align', {value: 1.5}],
        ['pdf.edit.text-direction', {}],
        ['pdf.edit.text-direction', {rtl: 'true'}],
    ];

    for (const [commandId, payload] of invalidPayloads) {
        assert.throws(
            () => provider.execute(commandId, payload),
            error => error.code === 'MOBILE_COMMAND_PAYLOAD_INVALID' &&
                error.details.commandId === commandId,
            commandId,
        );
    }
    assert.deepEqual(calls, []);
});

test('PDF provider accepts every locked text formatting enum value', () => {
    const calls = [];
    const provider = createPdfCommandProvider({catalog, getApi: () => createExplicitApi(calls)});
    const validPayloads = [
        ['pdf.edit.bold', {enabled: false}, ['put_TextPrBold', false]],
        ['pdf.edit.italic', {enabled: true}, ['put_TextPrItalic', true]],
        ['pdf.edit.underline', {enabled: false}, ['put_TextPrUnderline', false]],
        ['pdf.edit.strikeout', {enabled: true}, ['put_TextPrStrikeout', true]],
        ...[0, 2].map(baseline => ['pdf.edit.superscript', {baseline}, ['put_TextPrBaseline', baseline]]),
        ...[0, 1].map(baseline => ['pdf.edit.subscript', {baseline}, ['put_TextPrBaseline', baseline]]),
        ...[0, 1, 2, 3, 4].map(value => ['pdf.edit.change-case', {value}, ['asc_ChangeTextCase', value]]),
        ...[0, 1, 2, 3].map(value => ['pdf.edit.horizontal-align', {value}, ['put_PrAlign', value]]),
        ...[false, true].map(rtl => ['pdf.edit.text-direction', {rtl}, ['asc_setRtlTextDirection', rtl]]),
    ];

    for (const [commandId, payload, expected] of validPayloads) {
        provider.execute(commandId, payload);
        assert.deepEqual(calls.at(-1), expected, commandId);
    }
    assert.equal(calls.length, validPayloads.length);
});
