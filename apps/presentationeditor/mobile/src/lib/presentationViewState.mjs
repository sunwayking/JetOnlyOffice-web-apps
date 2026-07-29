/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const finiteScroll = value => value && Number.isFinite(value.x) && Number.isFinite(value.y)
    ? {x: value.x, y: value.y}
    : null;

const finiteZoom = value => Number.isFinite(value) && value > 0 ? value : null;

const restoreSelection = (api, selection) => {
    if (!selection) return;
    if (typeof api.setSelectionState === 'function') {
        api.setSelectionState(selection);
        return;
    }

    const logicDocument = api.private_GetLogicDocument?.();
    if (typeof logicDocument?.SetSelectionState !== 'function') return;
    logicDocument.SetSelectionState(selection);
    logicDocument.Document_UpdateSelectionState?.();
};

export function createPresentationViewStateAdapter({
    getApi,
    getZoom = () => null,
    restoreZoom = () => {},
    captureUiState = () => null,
    restoreUiState = () => {},
} = {}) {
    if (typeof getApi !== 'function') throw new TypeError('Presentation view state requires getApi');

    return Object.freeze({
        capture() {
            const api = getApi();
            if (!api) return null;
            const slide = typeof api.getCurrentPage === 'function' ? api.getCurrentPage() : null;
            const zoom = finiteZoom(getZoom());
            const selection = typeof api.getSelectionState === 'function' ? api.getSelectionState() : null;
            const ui = captureUiState();
            if (!Number.isInteger(slide) && !zoom && !selection && !ui) return null;
            return {
                ...(Number.isInteger(slide) && slide >= 0 ? {slide} : {}),
                ...(zoom ? {zoom} : {}),
                ...(selection ? {selection} : {}),
                ...(ui ? {ui} : {}),
            };
        },
        restore(state) {
            if (!state || typeof state !== 'object') return;
            const api = getApi();
            if (!api) return;
            const zoom = finiteZoom(state.zoom);
            if (zoom) restoreZoom(zoom);
            if (Number.isInteger(state.slide) && state.slide >= 0 && typeof api.goToPage === 'function') {
                api.goToPage(state.slide);
            }
            restoreSelection(api, state.selection);
            if (state.ui) restoreUiState(state.ui);
        },
    });
}

export function createPresentationUiStateAdapter({
    getActivePanel,
    openPanel,
    getRouter,
    getScrollElement,
    scheduleFrame = callback => globalThis.requestAnimationFrame(callback),
} = {}) {
    return Object.freeze({
        capture() {
            const panel = getActivePanel?.() ?? null;
            if (!panel) return null;
            const router = getRouter?.(panel) ?? null;
            const scrollElement = getScrollElement?.(panel) ?? null;
            const route = router?.currentRoute?.url ?? null;
            const scroll = scrollElement
                ? finiteScroll({x: scrollElement.scrollLeft, y: scrollElement.scrollTop})
                : null;
            return {
                panel,
                ...(route ? {route} : {}),
                ...(scroll ? {scroll} : {}),
            };
        },
        restore(state) {
            if (!state?.panel) return;
            openPanel?.(state.panel);
            scheduleFrame(() => {
                const router = getRouter?.(state.panel) ?? null;
                if (state.route && router?.currentRoute?.url !== state.route) {
                    router?.navigate?.(state.route);
                }
                scheduleFrame(() => {
                    const scrollElement = getScrollElement?.(state.panel) ?? null;
                    const scroll = finiteScroll(state.scroll);
                    if (!scrollElement || !scroll) return;
                    scrollElement.scrollLeft = scroll.x;
                    scrollElement.scrollTop = scroll.y;
                });
            });
        },
    });
}

export function createPresentationViewportController({
    captureViewState,
    closeTransientUi,
    resizeEditor,
    restoreViewState,
    scheduleFrame = callback => globalThis.requestAnimationFrame(callback),
} = {}) {
    return Object.freeze({
        handleViewportChange() {
            const state = captureViewState?.() ?? null;
            closeTransientUi?.();
            scheduleFrame(() => {
                resizeEditor?.();
                if (state) restoreViewState?.(state);
            });
        },
    });
}

let activeUiStateAdapter = null;

export function registerPresentationUiStateAdapter(adapter) {
    if (!adapter || typeof adapter.capture !== 'function' || typeof adapter.restore !== 'function') {
        throw new TypeError('Presentation UI state adapter must implement capture and restore');
    }
    activeUiStateAdapter = adapter;
    return () => {
        if (activeUiStateAdapter === adapter) activeUiStateAdapter = null;
    };
}

export function captureRegisteredPresentationUiState() {
    return activeUiStateAdapter?.capture() ?? null;
}

export function restoreRegisteredPresentationUiState(state) {
    activeUiStateAdapter?.restore(state);
}
