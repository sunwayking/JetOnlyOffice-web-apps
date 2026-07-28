/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {createPdfMobileStateController} from '../src/lib/pdfMobileState.mjs';

function createStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

test('PDF Mobile state restores the active task and view only for the same document', () => {
    const storage = createStorage();
    const first = createPdfMobileStateController({storage});
    first.setDocumentKey('document-a');
    first.openTask('forms');
    first.saveViewState({page: 3, scroll: {x: 0, y: 240}, zoom: 110});

    const restored = createPdfMobileStateController({storage});
    assert.deepEqual(restored.restore('document-a'), {
        activeTask: 'forms',
        overlay: null,
        viewState: {page: 3, scroll: {x: 0, y: 240}, zoom: 110},
    });
    assert.deepEqual(restored.restore('document-b'), {
        activeTask: null,
        overlay: null,
        viewState: null,
    });
});

test('PDF Mobile back closes keyboard, overlay and panel before protecting the editor exit', () => {
    const exits = [];
    let keyboardOpen = true;
    const controller = createPdfMobileStateController({
        dismissKeyboard: () => {
            if (!keyboardOpen) return false;
            keyboardOpen = false;
            return true;
        },
        exitEditor: () => exits.push('exit'),
    });
    controller.openTask('signatures');
    controller.openOverlay('signature-appearance');
    controller.updateSession({save: {state: 'dirty'}});

    assert.equal(controller.handleBack().reason, 'keyboard');
    assert.equal(controller.handleBack().reason, 'overlay');
    assert.equal(controller.handleBack().reason, 'panel');
    assert.equal(controller.handleBack().reason, 'unconfirmed-save');
    assert.equal(controller.getState().overlay, 'exit-confirmation');
    assert.deepEqual(exits, []);

    controller.confirmExit(true);
    assert.deepEqual(exits, ['exit']);
});

test('PDF Mobile rotation captures, resizes and restores the editor in one animation frame', () => {
    const calls = [];
    const controller = createPdfMobileStateController({
        captureViewState: () => ({page: 7, scroll: {x: 12, y: 700}, zoom: 95}),
        resizeEditor: () => calls.push(['resize']),
        restoreViewState: state => calls.push(['restore', state]),
        scheduleFrame: callback => callback(),
    });

    controller.handleViewportChange();
    assert.deepEqual(calls, [
        ['resize'],
        ['restore', {page: 7, scroll: {x: 12, y: 700}, zoom: 95}],
    ]);
    assert.deepEqual(controller.getState().viewState, {
        page: 7,
        scroll: {x: 12, y: 700},
        zoom: 95,
    });
});

test('PDF Mobile state stays usable when browser session storage is unavailable', () => {
    const storage = {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
    };
    const controller = createPdfMobileStateController({storage});

    assert.doesNotThrow(() => controller.restore('document-a'));
    assert.doesNotThrow(() => controller.openTask('edit'));
    assert.equal(controller.getState().activeTask, 'edit');
});

test('PDF Mobile protects local changes and server-accepted changes until persistence is confirmed', () => {
    const exits = [];
    const controller = createPdfMobileStateController({exitEditor: () => exits.push('exit')});

    controller.updateDocumentModified(true);
    assert.equal(controller.handleBack().reason, 'unconfirmed-save');
    controller.closeOverlay();

    controller.updateDocumentModified(false);
    controller.updateSession({save: {state: 'accepted'}});
    assert.equal(controller.handleBack().reason, 'unconfirmed-save');
    controller.closeOverlay();

    controller.updateSession({save: {state: 'confirmed'}});
    assert.equal(controller.handleBack().reason, 'editor-exit');
    assert.deepEqual(exits, ['exit']);
});
