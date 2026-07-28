/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createEditorRuntime,
    executeActiveEditorCommand,
    getActiveEditorRuntime,
    setActiveEditorRuntime
} from './createEditorRuntime.mjs';

function createAdapter(overrides = {}) {
    const listeners = new Set();
    const commands = [
        {id: 'word.text.bold', permission: 'edit'},
        {id: 'word.review.track', permissionsAny: ['edit', 'review']},
        {id: 'common.comment.add', permission: 'comment'},
        {id: 'common.selection.copy', permission: 'view', mutates: false}
    ];

    return {
        emit(event) {
            listeners.forEach(listener => listener(event));
        },
        getSelectionSnapshot() {
            return {kind: 'text'};
        },
        subscribeState(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getCommandDescriptors() {
            return commands;
        },
        execute(commandId, payload) {
            return {commandId, payload};
        },
        resolveContextMenu() {
            return [];
        },
        captureViewState() {
            return {page: 1};
        },
        restoreViewState() {},
        dispose() {},
        ...overrides
    };
}

function markReady(adapter) {
    adapter.emit({type: 'transport', state: 'connected'});
    adapter.emit({type: 'document-open', phase: 'ready'});
}

test('executes a mapped command and exposes the editor selection', () => {
    const adapter = createAdapter();
    const runtime = createEditorRuntime({
        adapter,
        permissions: {edit: true, comment: true}
    });
    markReady(adapter);

    assert.deepEqual(runtime.getSelection(), {kind: 'text'});
    assert.deepEqual(runtime.execute('word.text.bold', {value: true}), {
        commandId: 'word.text.bold',
        payload: {value: true}
    });
});

test('rejects restricted commands in the shared layer', () => {
    const adapter = createAdapter();
    const runtime = createEditorRuntime({
        adapter,
        permissions: {edit: false, comment: true}
    });
    markReady(adapter);

    assert.deepEqual(runtime.resolve('word.text.bold'), {
        id: 'word.text.bold',
        permission: 'edit',
        available: false,
        reason: 'permission-denied'
    });
    assert.throws(
        () => runtime.execute('word.text.bold', {value: true}),
        error => error.code === 'MOBILE_COMMAND_PERMISSION_DENIED'
    );
    assert.doesNotThrow(() => runtime.execute('common.comment.add', {text: 'ok'}));
});

test('enforces the five permission profiles instead of relying on hidden buttons', () => {
    const profiles = [
        {name: 'full-edit', permissions: {edit: true, comment: true}, bold: true, review: true, comment: true},
        {name: 'review-only', permissions: {review: true}, bold: false, review: true, comment: false},
        {name: 'comment-only', permissions: {comment: true}, bold: false, review: false, comment: true},
        {name: 'fill-forms-only', permissions: {fillForms: true}, bold: false, review: false, comment: false},
        {name: 'view-only', permissions: {}, bold: false, review: false, comment: false}
    ];

    profiles.forEach(profile => {
        const adapter = createAdapter();
        const runtime = createEditorRuntime({
            adapter,
            permissions: profile.permissions
        });
        markReady(adapter);
        assert.equal(runtime.resolve('word.text.bold').available, profile.bold, profile.name);
        assert.equal(runtime.resolve('word.review.track').available, profile.review, profile.name);
        assert.equal(runtime.resolve('common.comment.add').available, profile.comment, profile.name);
    });
});

test('permissionsAny remains fail-closed unless at least one declared permission is granted', () => {
    const deniedAdapter = createAdapter();
    const deniedRuntime = createEditorRuntime({
        adapter: deniedAdapter,
        permissions: {comment: true}
    });
    markReady(deniedAdapter);

    assert.deepEqual(deniedRuntime.resolve('word.review.track'), {
        id: 'word.review.track',
        permissionsAny: ['edit', 'review'],
        available: false,
        reason: 'permission-denied'
    });
    assert.throws(
        () => deniedRuntime.execute('word.review.track'),
        error => error.code === 'MOBILE_COMMAND_PERMISSION_DENIED' &&
            error.details.permission === undefined &&
            error.details.permissionsAny.join(',') === 'edit,review'
    );
});

test('rejects malformed composite permission descriptors instead of allowing them by default', () => {
    for (const permissionsAny of [[], ['edit', 'edit'], ['edit', '']]) {
        assert.throws(
            () => createEditorRuntime({
                adapter: createAdapter({
                    getCommandDescriptors: () => [{id: 'word.invalid', permissionsAny}]
                })
            }),
            error => error.code === 'MOBILE_COMMAND_DESCRIPTOR_INVALID'
        );
    }

    assert.throws(
        () => createEditorRuntime({
            adapter: createAdapter({
                getCommandDescriptors: () => [{
                    id: 'word.ambiguous',
                    permission: 'edit',
                    permissionsAny: ['review']
                }]
            })
        }),
        error => error.code === 'MOBILE_COMMAND_DESCRIPTOR_INVALID'
    );
});

test('freezes mutations until transport reconciliation while keeping safe commands available', () => {
    const adapter = createAdapter();
    const runtime = createEditorRuntime({
        adapter,
        permissions: {edit: true, comment: true}
    });

    assert.equal(runtime.resolve('word.text.bold').reason, 'session-frozen');
    assert.throws(
        () => runtime.execute('word.text.bold', {value: true}),
        error => error.code === 'MOBILE_COMMAND_SESSION_FROZEN'
    );
    assert.equal(runtime.resolve('common.selection.copy').available, true);

    adapter.emit({type: 'transport', state: 'connected'});
    assert.equal(runtime.resolve('word.text.bold').reason, 'session-frozen');
    adapter.emit({type: 'document-open', phase: 'ready'});
    assert.equal(runtime.resolve('word.text.bold').available, true);

    for (const state of ['reconnecting', 'reconciling', 'closed']) {
        adapter.emit({type: 'transport', state});
        assert.equal(runtime.resolve('word.text.bold').reason, 'session-frozen', state);
        assert.doesNotThrow(() => runtime.execute('common.selection.copy'), state);
    }

    adapter.emit({type: 'transport', state: 'connected', reconnected: true});
    assert.equal(runtime.resolve('word.text.bold').available, true);
});

test('distinguishes retryable and blocking save failures', () => {
    const adapter = createAdapter();
    const runtime = createEditorRuntime({adapter, permissions: {edit: true}});
    markReady(adapter);

    adapter.emit({type: 'server-save', state: 'retryable-failed', reason: 'timeout'});
    assert.equal(runtime.resolve('word.text.bold').available, true);

    adapter.emit({type: 'server-save', state: 'blocking-failed', reason: 'permission-revoked'});
    assert.equal(runtime.resolve('word.text.bold').reason, 'session-frozen');
    assert.throws(
        () => runtime.execute('word.text.bold', {value: true}),
        error => error.code === 'MOBILE_COMMAND_SESSION_FROZEN'
    );
    assert.doesNotThrow(() => runtime.execute('common.selection.copy'));
});

test('reduces SDK facts without timers or generic action inference', () => {
    const adapter = createAdapter();
    const runtime = createEditorRuntime({adapter, permissions: {edit: true}});
    const sessions = [];
    const unsubscribe = runtime.subscribe(session => sessions.push(session));

    adapter.emit({type: 'document-open', phase: 'loading', progress: {current: 2, total: 5}});
    adapter.emit({type: 'transport', state: 'reconnecting', attempt: 2});
    adapter.emit({
        type: 'server-save',
        state: 'accepted',
        scope: 'coauthoring-server',
        index: 7,
        time: 42
    });

    assert.equal(sessions.length, 4);
    assert.deepEqual(runtime.getSession(), {
        open: {phase: 'loading', progress: {current: 2, total: 5}},
        transport: {state: 'reconnecting', attempt: 2},
        save: {
            state: 'accepted',
            scope: 'coauthoring-server',
            index: 7,
            time: 42
        }
    });

    unsubscribe();
    adapter.emit({type: 'transport', state: 'connected'});
    assert.equal(sessions.length, 4);
});

test('dispose detaches the adapter and fails closed', () => {
    let detached = false;
    let disposed = false;
    const adapter = createAdapter({
        subscribeState() {
            return () => {
                detached = true;
            };
        },
        dispose() {
            disposed = true;
        }
    });
    const runtime = createEditorRuntime({adapter, permissions: {edit: true}});

    runtime.dispose();

    assert.equal(detached, true);
    assert.equal(disposed, true);
    assert.throws(
        () => runtime.execute('word.text.bold', {value: true}),
        error => error.code === 'MOBILE_RUNTIME_DISPOSED'
    );
});

test('publishes one active runtime for shared Mobile controllers', () => {
    const runtime = createEditorRuntime({
        adapter: createAdapter(),
        permissions: {edit: true}
    });

    setActiveEditorRuntime(runtime);
    assert.equal(getActiveEditorRuntime(), runtime);
    setActiveEditorRuntime(null);
    assert.equal(getActiveEditorRuntime(), null);
});

test('shared controllers cannot bypass a missing or restricted active runtime', () => {
    setActiveEditorRuntime(null);
    assert.throws(
        () => executeActiveEditorCommand('common.comment.add', {text: 'blocked'}),
        error => error.code === 'MOBILE_RUNTIME_UNAVAILABLE'
    );

    const adapter = createAdapter();
    const runtime = createEditorRuntime({adapter, permissions: {comment: false}});
    markReady(adapter);
    setActiveEditorRuntime(runtime);

    assert.throws(
        () => executeActiveEditorCommand('common.comment.add', {text: 'blocked'}),
        error => error.code === 'MOBILE_COMMAND_PERMISSION_DENIED'
    );
    setActiveEditorRuntime(null);
});
