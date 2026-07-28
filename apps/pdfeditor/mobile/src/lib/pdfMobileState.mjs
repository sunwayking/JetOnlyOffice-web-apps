/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {PDF_TASK_SPACE_IDS} from './pdfCommandProvider.mjs';

const SCHEMA_VERSION = 1;
const STORAGE_PREFIX = 'jetonlyoffice:pdf-mobile-session:';
const UNSAVED_STATES = new Set([
    'dirty',
    'pending',
    'requesting',
    'saving',
    'retrying',
    'accepted',
    'retryable-failed',
    'blocking-failed',
    'conflict',
]);

const emptyState = () => ({
    activeTask: null,
    overlay: null,
    viewState: null,
});

const validViewState = value => {
    if (!value || typeof value !== 'object') return null;
    const page = Number.isInteger(value.page) && value.page >= 0 ? value.page : null;
    const zoom = Number.isFinite(value.zoom) && value.zoom > 0 ? value.zoom : null;
    const scroll = Number.isFinite(value.scroll?.x) && Number.isFinite(value.scroll?.y)
        ? {x: value.scroll.x, y: value.scroll.y}
        : null;
    if (page === null && zoom === null && scroll === null) return null;
    return {
        ...(page === null ? {} : {page}),
        ...(scroll === null ? {} : {scroll}),
        ...(zoom === null ? {} : {zoom}),
    };
};

export function createPdfMobileStateController({
    storage = null,
    dismissKeyboard = () => false,
    exitEditor = () => {},
    captureViewState = () => null,
    resizeEditor = () => {},
    restoreViewState = () => {},
    scheduleFrame = callback => globalThis.requestAnimationFrame(callback),
} = {}) {
    const subscribers = new Set();
    let state = emptyState();
    let session = {save: {state: 'idle'}};
    let documentModified = false;
    let documentKey = null;
    let disposed = false;

    const storageKey = () => documentKey === null
        ? null
        : `${STORAGE_PREFIX}${encodeURIComponent(documentKey)}`;
    const snapshot = () => ({...state, viewState: state.viewState ? {...state.viewState} : null});
    const publish = () => {
        if (disposed) return;
        const value = snapshot();
        subscribers.forEach(subscriber => subscriber(value));
    };
    const persist = () => {
        const key = storageKey();
        if (!storage || !key) return;
        try {
            storage.setItem(key, JSON.stringify({
                schemaVersion: SCHEMA_VERSION,
                activeTask: state.activeTask,
                viewState: state.viewState,
            }));
        } catch {
            // Session continuity is best-effort when browser storage is blocked.
        }
    };
    const update = next => {
        state = {...state, ...next};
        persist();
        publish();
    };

    return Object.freeze({
        getState: snapshot,
        subscribe(subscriber) {
            if (typeof subscriber !== 'function') throw new TypeError('PDF Mobile state subscriber must be a function');
            subscribers.add(subscriber);
            subscriber(snapshot());
            return () => subscribers.delete(subscriber);
        },
        setDocumentKey(key) {
            documentKey = String(key || 'anonymous');
        },
        restore(key) {
            documentKey = String(key || 'anonymous');
            documentModified = false;
            state = emptyState();
            try {
                const value = storage?.getItem(storageKey());
                if (value) {
                    const parsed = JSON.parse(value);
                    if (parsed.schemaVersion === SCHEMA_VERSION) {
                        state.activeTask = PDF_TASK_SPACE_IDS.includes(parsed.activeTask) ? parsed.activeTask : null;
                        state.viewState = validViewState(parsed.viewState);
                    }
                }
            } catch {
                state = emptyState();
            }
            publish();
            return snapshot();
        },
        openTask(taskId) {
            if (!PDF_TASK_SPACE_IDS.includes(taskId)) throw new TypeError(`Unknown PDF task space: ${taskId}`);
            update({activeTask: taskId, overlay: null});
        },
        closePanel() {
            if (state.activeTask !== null) update({activeTask: null});
        },
        openOverlay(overlay) {
            if (typeof overlay !== 'string' || !overlay) throw new TypeError('PDF overlay id must be a string');
            update({overlay});
        },
        closeOverlay() {
            if (state.overlay !== null) update({overlay: null});
        },
        saveViewState(value) {
            update({viewState: validViewState(value)});
        },
        updateSession(value) {
            session = value && typeof value === 'object' ? value : session;
        },
        updateDocumentModified(value) {
            documentModified = value === true;
        },
        handleBack() {
            if (dismissKeyboard() === true) return {handled: true, reason: 'keyboard'};
            if (state.overlay !== null) {
                update({overlay: null});
                return {handled: true, reason: 'overlay'};
            }
            if (state.activeTask !== null) {
                update({activeTask: null});
                return {handled: true, reason: 'panel'};
            }
            if (documentModified || UNSAVED_STATES.has(session.save?.state)) {
                update({overlay: 'exit-confirmation'});
                return {handled: true, reason: 'unconfirmed-save'};
            }
            exitEditor();
            return {handled: false, reason: 'editor-exit'};
        },
        confirmExit(confirmed) {
            if (confirmed === true) exitEditor();
        },
        handleViewportChange() {
            const viewState = validViewState(captureViewState());
            update({viewState});
            scheduleFrame(() => {
                if (disposed) return;
                resizeEditor();
                if (viewState) restoreViewState(viewState);
            });
        },
        dispose() {
            disposed = true;
            subscribers.clear();
        },
    });
}

export default createPdfMobileStateController;
