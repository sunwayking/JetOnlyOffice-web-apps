/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import Framework7 from 'framework7/lite-bundle';
import Framework7React from 'framework7-react';
import 'framework7/css/bundle';
import '../../../common/Gateway.js';

import './less/app.less';
import PdfMobileApp from './view/PdfMobileApp.jsx';
import catalog from './commands/mobile-command-catalog.json';
import {
    resolvePdfPermissionProfile,
    resolvePdfRuntimePermissions,
} from './lib/pdfPermissionPolicy.mjs';
import {createPdfSdkBootstrap} from './lib/pdfSdkBootstrap.mjs';
import {
    createPdfUiCommandHandler,
    disposePdfEditorRuntime,
    getPdfCommandProvider,
    initializePdfEditorRuntime,
    updatePdfEditorPermissions,
} from './lib/pdfEditorRuntime.mjs';
import {createPdfMobileStateController} from './lib/pdfMobileState.mjs';

Framework7.use(Framework7React);

let editorApi = null;
let editorRuntime = null;
let runtimePermissions = resolvePdfPermissionProfile('view');
let documentContext = {key: 'anonymous', title: ''};

let sessionStorage = null;
try {
    sessionStorage = window.sessionStorage;
} catch {
    sessionStorage = null;
}

const mobileState = createPdfMobileStateController({
    storage: sessionStorage,
    dismissKeyboard: () => {
        const activeElement = document.activeElement;
        const editable = activeElement && (
            /^(INPUT|TEXTAREA|SELECT)$/.test(activeElement.tagName) ||
            activeElement.isContentEditable === true
        );
        if (!editable || typeof activeElement.blur !== 'function') return false;
        activeElement.blur();
        return true;
    },
    exitEditor: () => window.Common.Gateway.internalMessage('hardBack', true),
    captureViewState: () => getPdfCommandProvider()?.captureViewState() || null,
    resizeEditor: () => editorApi?.Resize(),
    restoreViewState: state => getPdfCommandProvider()?.restoreViewState(state),
    scheduleFrame: callback => window.requestAnimationFrame(callback),
});

const executePdfUiCommand = createPdfUiCommandHandler({
    openSettings: () => mobileState.openOverlay('settings'),
    openEditRights: () => mobileState.openOverlay('collaboration'),
    openPages: () => mobileState.openTask('pages'),
    openSearch: () => mobileState.openOverlay('command-search'),
    openComments: () => mobileState.openTask('comment'),
    openAbout: () => mobileState.openOverlay('about'),
    openSupport: () => mobileState.openOverlay('support'),
    openForms: () => mobileState.openTask('forms'),
    openEdit: () => mobileState.openTask('edit'),
    openSignatures: () => mobileState.openTask('signatures'),
    openChartLinks: () => mobileState.openOverlay('chart-links'),
    updateChartData: () => mobileState.openOverlay('chart-data'),
    closePanel: () => mobileState.closePanel(),
});

function resolvePermissions(options = {}) {
    if (typeof options.profile === 'string') {
        return resolvePdfPermissionProfile(options.profile);
    }
    return resolvePdfRuntimePermissions(options);
}

window.JetOnlyOfficePdfMobile = Object.freeze({
    attachEditorApi(api, options = {}) {
        disposePdfEditorRuntime();
        editorApi = api || null;
        runtimePermissions = resolvePermissions(options);
        editorRuntime = editorApi ? initializePdfEditorRuntime({
            catalog,
            getApi: () => editorApi,
            permissions: runtimePermissions,
            executeUiCommand: executePdfUiCommand,
        }) : null;
        window.dispatchEvent(new CustomEvent('jetonlyoffice:pdf-api-ready', {
            detail: {api: editorApi, permissions: runtimePermissions, runtime: editorRuntime},
        }));
    },
    updatePermissions(options = {}) {
        runtimePermissions = resolvePermissions(options);
        updatePdfEditorPermissions(runtimePermissions);
        window.dispatchEvent(new CustomEvent('jetonlyoffice:pdf-permissions-changed', {
            detail: {permissions: runtimePermissions},
        }));
    },
    getEditorApi() {
        return editorApi;
    },
    getRuntimePermissions() {
        return runtimePermissions;
    },
    getRuntime() {
        return editorRuntime;
    },
    setDocumentContext(context = {}) {
        documentContext = {
            key: String(context.key || 'anonymous'),
            title: String(context.title || ''),
        };
        mobileState.restore(documentContext.key);
    },
    getDocumentContext() {
        return {...documentContext};
    },
    getUiState() {
        return mobileState.getState();
    },
    subscribeUiState(subscriber) {
        return mobileState.subscribe(subscriber);
    },
    openTask(taskId) {
        mobileState.openTask(taskId);
    },
    closePanel() {
        mobileState.closePanel();
    },
    openOverlay(overlayId) {
        mobileState.openOverlay(overlayId);
    },
    closeOverlay() {
        mobileState.closeOverlay();
    },
    resolveCommand(commandId) {
        if (!editorRuntime) return {available: false, reason: 'editor-api-unavailable'};
        const runtimeResolution = editorRuntime.resolve(commandId);
        if (!runtimeResolution?.available) return runtimeResolution;
        const capability = getPdfCommandProvider()?.resolveCapability(commandId);
        return capability?.available === false
            ? {...runtimeResolution, ...capability, available: false}
            : runtimeResolution;
    },
    executeCommand(commandId, payload) {
        if (!editorRuntime) {
            const error = new Error('PDF editor Runtime is not available');
            error.code = 'MOBILE_EDITOR_API_UNAVAILABLE';
            throw error;
        }
        return editorRuntime.execute(commandId, payload);
    },
    getSelection() {
        return editorRuntime?.getSelection() || [];
    },
    resolveContextMenu(context) {
        const provider = getPdfCommandProvider();
        if (!provider || !editorRuntime) return [];
        return provider.resolveContextMenu(context).filter(commandId => (
            editorRuntime.resolve(commandId)?.available === true &&
            provider.resolveCapability(commandId)?.available !== false
        ));
    },
    updateSession(session) {
        mobileState.updateSession(session);
    },
    updateDocumentModified(modified) {
        mobileState.updateDocumentModified(modified);
    },
    restoreEditorState() {
        const viewState = mobileState.getState().viewState;
        if (viewState) getPdfCommandProvider()?.restoreViewState(viewState);
    },
    handleViewportChange() {
        mobileState.handleViewportChange();
    },
    handleBack() {
        return mobileState.handleBack();
    },
    confirmExit(confirmed) {
        mobileState.confirmExit(confirmed);
    },
    dispose() {
        disposePdfEditorRuntime();
        editorApi = null;
        editorRuntime = null;
        mobileState.dispose();
    },
    reportBootstrapError(error) {
        window.dispatchEvent(new CustomEvent('jetonlyoffice:pdf-bootstrap-error', {
            detail: {error},
        }));
    },
});

const root = createRoot(document.getElementById('app'));
root.render(<PdfMobileApp bridge={window.JetOnlyOfficePdfMobile} />);

createPdfSdkBootstrap({
    window,
    gateway: window.Common.Gateway,
    bridge: window.JetOnlyOfficePdfMobile,
}).start().catch(() => {});

const historyBoundary = {...(window.history.state || {}), jetOnlyOfficePdfMobile: true};
window.history.replaceState(historyBoundary, '');
window.history.pushState({...historyBoundary, boundary: true}, '');

const onPopState = () => {
    const result = window.JetOnlyOfficePdfMobile.handleBack();
    if (result.handled) window.history.pushState({...historyBoundary, boundary: true}, '');
};
const onOrientationChange = () => window.JetOnlyOfficePdfMobile.handleViewportChange();
window.addEventListener('popstate', onPopState);
window.addEventListener('orientationchange', onOrientationChange);
const onPageHide = event => {
    if (event.persisted) return;
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('orientationchange', onOrientationChange);
    window.removeEventListener('pagehide', onPageHide);
    window.JetOnlyOfficePdfMobile.dispose();
};
window.addEventListener('pagehide', onPageHide);
