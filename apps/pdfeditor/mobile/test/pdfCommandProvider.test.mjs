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

const catalogUrl = new URL('../src/commands/mobile-command-catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));

const SDK_METHODS = Object.freeze([
    'Undo',
    'Redo',
    'SetRedactTool',
    'HasRedact',
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
    'AddTextField',
    'AddDateField',
    'AddImageField',
    'AddCheckboxField',
    'AddRadiobuttonField',
    'AddComboboxField',
    'AddListboxField',
    'asc_ClearAllSpecialForms',
    'AddSignatureField',
    'asc_SetSignatureFieldAppearance',
    'asc_getSignatureFields',
    'asc_getSignatures',
    'asc_getRequestSignatures',
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
        assert.ok(PDF_TASK_SPACE_IDS.includes(command.taskSpace), command.id);
        assert.ok(['view', 'edit', 'comment', 'fillForms'].includes(command.permission), command.id);
        assert.equal(typeof command.binding.method, 'string', command.id);
        assert.ok(command.testIds.length > 0, command.id);
        assert.equal(commandIds.has(command.id), false, command.id);
        commandIds.add(command.id);
    }
});

test('PDF provider implements the shared editor adapter contract with real SDK calls', () => {
    const calls = [];
    const callbacks = new Map();
    const api = createExplicitApi(calls, callbacks);
    let hasRedactionMarks = true;
    api.HasRedact = () => hasRedactionMarks;
    api.ApplyRedact = () => {
        calls.push(['ApplyRedact']);
        hasRedactionMarks = false;
    };
    api.asc_findText = settings => {
        calls.push(['asc_findText', settings, true]);
        return 2;
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
    provider.execute('pdf.redaction.search-all', {settings: {text: 'secret'}});
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
});

test('PDF provider separates certificate signatures from form fields and fails closed on unpersisted appearance', () => {
    const calls = [];
    const api = createExplicitApi(calls);
    api.asc_getSignatures = () => ['certificate'];
    api.asc_getSignatureFields = () => ['field'];
    api.asc_getRequestSignatures = () => ['requested'];
    api.asc_SetSignatureFieldAppearance = () => false;
    const provider = createPdfCommandProvider({catalog, getApi: () => api});

    assert.deepEqual(provider.execute('pdf.signatures.certificates'), ['certificate']);
    assert.deepEqual(provider.execute('pdf.signatures.fields'), ['field']);
    assert.deepEqual(provider.execute('pdf.signatures.requested'), ['requested']);
    assert.throws(
        () => provider.execute('pdf.signatures.apply-appearance', {
            appearance: {fieldId: 'sig-1', mode: 'typed', text: 'Alice'},
        }),
        error => error.code === 'MOBILE_SIGNATURE_APPEARANCE_NOT_PERSISTED',
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
    assert.doesNotMatch(appSource + shellSource, /setTimeout|setInterval/);
});
