import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createPresentationUiStateAdapter,
    createPresentationViewStateAdapter,
    createPresentationViewportController,
} from '../src/lib/presentationViewState.mjs';

test('Presentation view state restores the current slide, object selection, panel route, and scroll', () => {
    const selection = {CurPage: 4, slideSelection: {selectedObjects: ['shape-7']}};
    const restored = [];
    const logicDocument = {
        SetSelectionState(value) {
            restored.push(['selection', value]);
        },
        Document_UpdateSelectionState() {
            restored.push(['selection-updated']);
        },
    };
    const api = {
        getCurrentPage: () => 4,
        getSelectionState: () => selection,
        goToPage: page => restored.push(['slide', page]),
        private_GetLogicDocument: () => logicDocument,
    };
    const ui = {
        panel: 'edit',
        route: '/edit-text-line-spacing/',
        scroll: {x: 8, y: 320},
    };
    const adapter = createPresentationViewStateAdapter({
        getApi: () => api,
        getZoom: () => 125,
        restoreZoom: zoom => restored.push(['zoom', zoom]),
        captureUiState: () => ui,
        restoreUiState: state => restored.push(['ui', state]),
    });

    assert.deepEqual(adapter.capture(), {slide: 4, zoom: 125, selection, ui});
    adapter.restore({slide: 4, zoom: 125, selection, ui});
    assert.deepEqual(restored, [
        ['zoom', 125],
        ['slide', 4],
        ['selection', selection],
        ['selection-updated'],
        ['ui', ui],
    ]);
});

test('Presentation UI state navigates after reopening its panel and restores scroll after routing', () => {
    const calls = [];
    const scrollElement = {scrollLeft: 10, scrollTop: 220};
    const router = {
        currentRoute: {url: '/editing-page/'},
        navigate(route) {
            calls.push(['navigate', route]);
            this.currentRoute = {url: route};
        },
    };
    const scheduled = [];
    const adapter = createPresentationUiStateAdapter({
        getActivePanel: () => 'edit',
        openPanel: panel => calls.push(['open', panel]),
        getRouter: panel => panel === 'edit' ? router : null,
        getScrollElement: panel => panel === 'edit' ? scrollElement : null,
        scheduleFrame: callback => scheduled.push(callback),
    });

    assert.deepEqual(adapter.capture(), {
        panel: 'edit',
        route: '/editing-page/',
        scroll: {x: 10, y: 220},
    });

    adapter.restore({
        panel: 'edit',
        route: '/edit-text-line-spacing/',
        scroll: {x: 18, y: 640},
    });
    assert.deepEqual(calls, [['open', 'edit']]);

    scheduled.shift()();
    assert.deepEqual(calls, [
        ['open', 'edit'],
        ['navigate', '/edit-text-line-spacing/'],
    ]);
    scheduled.shift()();
    assert.deepEqual({x: scrollElement.scrollLeft, y: scrollElement.scrollTop}, {x: 18, y: 640});
});

test('Presentation viewport changes capture before resize and restore in the next animation frame', () => {
    const calls = [];
    const state = {slide: 2, selection: {CurPage: 2}};
    const scheduled = [];
    const controller = createPresentationViewportController({
        captureViewState: () => {
            calls.push(['capture']);
            return state;
        },
        closeTransientUi: () => calls.push(['close-transient-ui']),
        resizeEditor: () => calls.push(['resize']),
        restoreViewState: value => calls.push(['restore', value]),
        scheduleFrame: callback => scheduled.push(callback),
    });

    controller.handleViewportChange();
    assert.deepEqual(calls, [['capture'], ['close-transient-ui']]);
    scheduled.shift()();
    assert.deepEqual(calls, [
        ['capture'],
        ['close-transient-ui'],
        ['resize'],
        ['restore', state],
    ]);
});
