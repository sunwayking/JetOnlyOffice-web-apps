/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {createPdfSdkBootstrap} from '../src/lib/pdfSdkBootstrap.mjs';

class SetterRecord {
    put_Id(value) { this.id = value; }
    put_Url(value) { this.url = value; }
    put_DirectUrl(value) { this.directUrl = value; }
    put_Title(value) { this.title = value; }
    put_Format(value) { this.format = value; }
    put_VKey(value) { this.vkey = value; }
    put_Options(value) { this.options = value; }
    put_UserInfo(value) { this.userInfo = value; }
    put_CallbackUrl(value) { this.callbackUrl = value; }
    put_Token(value) { this.token = value; }
    put_Permissions(value) { this.permissions = value; }
    put_EncryptedInfo(value) { this.encryptedInfo = value; }
    put_Lang(value) { this.lang = value; }
    put_Mode(value) { this.mode = value; }
    put_SupportsOnSaveDocument(value) { this.supportsOnSaveDocument = value; }
    put_Wopi(value) { this.wopi = value; }
    put_CoEditingMode(value) { this.coEditingMode = value; }
    put_Shardkey(value) { this.shardkey = value; }
    put_FullName(value) { this.fullName = value; }
    put_IsAnonymousUser(value) { this.isAnonymous = value; }
}

function createFixture() {
    const gatewayHandlers = new Map();
    const gatewayCalls = [];
    const apiCallbacks = new Map();
    const apiCalls = [];
    const api = {
        SetDrawingFreeze: value => apiCalls.push(['freeze', value]),
        Resize: () => apiCalls.push(['resize']),
        zoomFitToWidth: () => apiCalls.push(['fit-width']),
        asc_registerCallback: (name, callback) => apiCallbacks.set(name, callback),
        asc_setLocale: value => apiCalls.push(['locale', value]),
        asc_setDocInfo: value => apiCalls.push(['doc-info', value]),
        asc_getEditorPermissions: () => apiCalls.push(['get-permissions']),
        asc_setPdfViewer: value => apiCalls.push(['pdf-viewer', value]),
        asc_setViewMode: value => apiCalls.push(['view-mode', value]),
        asc_setCanSendChanges: value => apiCalls.push(['send-changes', value]),
        asc_setRestriction: value => apiCalls.push(['restriction', value]),
        asc_LoadDocument: () => apiCalls.push(['load-document']),
        isDocumentModified: () => true,
        asc_coAuthoringDisconnect: () => apiCalls.push(['disconnect']),
        asc_DownloadAs: data => apiCalls.push(['download-as', data]),
    };
    const Asc = {
        PDFEditorApi: function PdfEditorApi(config) {
            apiCalls.push(['create-api', config]);
            return api;
        },
        asc_CUserInfo: SetterRecord,
        asc_CDocInfo: SetterRecord,
        c_oLicenseResult: {Success: 1, Error: 2, SuccessLimit: 3, Connections: 4},
        c_oRights: {Edit: 1, Review: 2, Comment: 3, View: 4},
        c_oAscRestrictionType: {None: 0, OnlyForms: 1, View: 2, OnlyComments: 3},
    };
    const gateway = {
        on: (name, callback) => gatewayHandlers.set(name, callback),
        appReady: () => gatewayCalls.push(['app-ready']),
        documentReady: () => gatewayCalls.push(['document-ready']),
        sendInfo: value => gatewayCalls.push(['send-info', value]),
        setDocumentModified: value => gatewayCalls.push(['modified', value]),
        downloadAs: (...args) => gatewayCalls.push(['download', ...args]),
        internalMessage: (...args) => gatewayCalls.push(['internal', ...args]),
    };
    const bridgeCalls = [];
    const bridge = {
        attachEditorApi: (...args) => bridgeCalls.push(['attach', ...args]),
        setDocumentContext: value => bridgeCalls.push(['document-context', value]),
        restoreEditorState: () => bridgeCalls.push(['restore-editor-state']),
        handleBack: () => bridgeCalls.push(['back']),
        updatePermissions: value => bridgeCalls.push(['permissions', value]),
        updateDocumentModified: value => bridgeCalls.push(['document-modified', value]),
        reportBootstrapError: error => bridgeCalls.push(['error', error]),
    };
    return {
        window: {Asc, Common: {Locale: {isCurrentLangRtl: false}}, document: {}},
        gateway,
        gatewayHandlers,
        gatewayCalls,
        api,
        apiCallbacks,
        apiCalls,
        bridge,
        bridgeCalls,
    };
}

test('PDF bootstrap opens a real Gateway document and publishes Runtime permissions', async () => {
    const fixture = createFixture();
    const bootstrap = createPdfSdkBootstrap({
        window: fixture.window,
        gateway: fixture.gateway,
        bridge: fixture.bridge,
        loadScripts: async () => {},
    });
    assert.equal(await bootstrap.start(), fixture.api);
    assert.deepEqual(fixture.gatewayCalls, [['app-ready']]);
    assert.deepEqual(fixture.bridgeCalls, [['attach', fixture.api, {profile: 'view'}]]);

    fixture.gatewayHandlers.get('init')({
        config: {
            mode: 'edit',
            lang: 'zh-CN',
            callbackUrl: 'https://host.test/callback',
            user: {id: 'user-1', fullname: 'Alice'},
        },
    });
    fixture.gatewayHandlers.get('opendocument')({
        doc: {
            key: 'doc-1',
            url: 'https://host.test/document.pdf',
            title: 'Document.pdf',
            fileType: 'pdf',
            permissions: {edit: true, comment: true, fillForms: true},
        },
    });
    assert.equal(fixture.apiCalls.some(call => call[0] === 'doc-info'), true);
    assert.equal(fixture.apiCalls.some(call => call[0] === 'get-permissions'), true);
    assert.deepEqual(fixture.bridgeCalls[1], ['document-context', {
        key: 'doc-1',
        title: 'Document.pdf',
    }]);

    fixture.apiCallbacks.get('asc_onGetEditorPermissions')({
        asc_getLicenseType: () => 1,
        asc_getRights: () => 1,
    });
    assert.equal(bootstrap.isPermissionsInitialized(), true);
    assert.equal(fixture.bridgeCalls[2][0], 'permissions');
    assert.deepEqual(fixture.bridgeCalls[2][1].appOptions, {
        isEdit: true,
        isReviewOnly: false,
        isForm: false,
        canReview: false,
        canComments: true,
        canFillForms: true,
    });
    assert.equal(fixture.apiCalls.some(call => call[0] === 'restriction' && call[1] === 0), true);
    assert.equal(fixture.apiCalls.some(call => call[0] === 'load-document'), true);

    fixture.apiCallbacks.get('asc_onDocumentContentReady')();
    assert.equal(fixture.bridgeCalls.some(call => call[0] === 'restore-editor-state'), true);
    assert.deepEqual(fixture.gatewayCalls.slice(-2), [
        ['send-info', {mode: 'edit'}],
        ['document-ready'],
    ]);
    fixture.apiCallbacks.get('asc_onDocumentModifiedChanged')();
    assert.deepEqual(fixture.gatewayCalls.at(-1), ['modified', true]);
    assert.deepEqual(fixture.bridgeCalls.at(-1), ['document-modified', true]);
    fixture.gatewayHandlers.get('requestclose')();
    assert.deepEqual(fixture.bridgeCalls.at(-1), ['back']);
});

test('PDF bootstrap keeps comment-only sessions editable under the SDK restriction', async () => {
    const fixture = createFixture();
    const bootstrap = createPdfSdkBootstrap({
        window: fixture.window,
        gateway: fixture.gateway,
        bridge: fixture.bridge,
        loadScripts: async () => {},
    });
    await bootstrap.start();
    fixture.gatewayHandlers.get('init')({config: {mode: 'edit', user: {}}});
    fixture.gatewayHandlers.get('opendocument')({doc: {
        key: 'doc-1',
        fileType: 'pdf',
        permissions: {edit: false, review: false, comment: true, fillForms: false},
    }});

    fixture.apiCallbacks.get('asc_onGetEditorPermissions')({
        asc_getLicenseType: () => 1,
        asc_getRights: () => 3,
    });

    assert.deepEqual(fixture.bridgeCalls.at(-1)[1].appOptions, {
        isEdit: false,
        isReviewOnly: false,
        isForm: false,
        canReview: false,
        canComments: true,
        canFillForms: false,
    });
    assert.equal(fixture.apiCalls.some(call => call[0] === 'pdf-viewer' && call[1] === false), true);
    assert.equal(fixture.apiCalls.some(call => call[0] === 'view-mode' && call[1] === false), true);
    assert.equal(fixture.apiCalls.some(call => call[0] === 'restriction' && call[1] === 3), true);
});

test('PDF bootstrap degrades non-editing licenses to view without blocking document load', async () => {
    const fixture = createFixture();
    const bootstrap = createPdfSdkBootstrap({
        window: fixture.window,
        gateway: fixture.gateway,
        bridge: fixture.bridge,
        loadScripts: async () => {},
    });
    await bootstrap.start();
    fixture.gatewayHandlers.get('init')({config: {mode: 'edit', user: {}}});
    fixture.gatewayHandlers.get('opendocument')({doc: {
        key: 'doc-1',
        fileType: 'pdf',
        permissions: {edit: true, review: true, comment: true, fillForms: true},
    }});

    fixture.apiCallbacks.get('asc_onGetEditorPermissions')({
        asc_getLicenseType: () => 4,
        asc_getRights: () => 1,
    });

    assert.deepEqual(fixture.bridgeCalls.at(-1)[1].appOptions, {
        isEdit: false,
        isReviewOnly: false,
        isForm: false,
        canReview: false,
        canComments: false,
        canFillForms: false,
    });
    assert.equal(fixture.apiCalls.some(call => call[0] === 'restriction' && call[1] === 2), true);
    assert.equal(fixture.apiCalls.some(call => call[0] === 'load-document'), true);
});

test('PDF bootstrap fails closed on rejected licenses and revoked rights', async () => {
    const fixture = createFixture();
    const bootstrap = createPdfSdkBootstrap({
        window: fixture.window,
        gateway: fixture.gateway,
        bridge: fixture.bridge,
        loadScripts: async () => {},
    });
    await bootstrap.start();
    fixture.gatewayHandlers.get('init')({config: {mode: 'edit', user: {}}});
    fixture.gatewayHandlers.get('opendocument')({doc: {
        key: 'doc-1',
        fileType: 'pdf',
        permissions: {edit: true},
    }});
    fixture.apiCallbacks.get('asc_onGetEditorPermissions')({
        asc_getLicenseType: () => 2,
        asc_getRights: () => 1,
    });
    assert.equal(fixture.bridgeCalls.at(-1)[0], 'error');
    assert.equal(fixture.bridgeCalls.at(-1)[1].code, 'MOBILE_PDF_LICENSE_REJECTED');
    assert.equal(fixture.apiCalls.some(call => call[0] === 'load-document'), false);

    fixture.gatewayHandlers.get('processrightschange')({enabled: false});
    assert.deepEqual(fixture.bridgeCalls.at(-1), ['permissions', {profile: 'view'}]);
    assert.equal(fixture.apiCalls.at(-1)[0], 'disconnect');
});
