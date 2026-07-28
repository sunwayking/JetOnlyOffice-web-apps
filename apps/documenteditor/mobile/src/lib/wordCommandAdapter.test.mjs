/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {createWordCommandAdapter} from './wordCommandAdapter.mjs';

function createApi() {
    const callbacks = new Map();
    const calls = [];

    return {
        callbacks,
        calls,
        asc_registerCallback(name, callback) {
            callbacks.set(name, callback);
        },
        asc_unregisterCallback(name, callback) {
            if (callbacks.get(name) === callback) {
                callbacks.delete(name);
            }
        },
        getSelectedElements() {
            return ['selection'];
        },
        put_TextPrBold(value) {
            calls.push(['bold', value]);
        },
        put_PrAlign(value) {
            calls.push(['align', value]);
        },
        put_Table(columns, rows, style) {
            calls.push(['table', columns, rows, style]);
        },
        asc_addComment(comment) {
            calls.push(['comment', comment]);
        },
        Copy() {
            calls.push(['copy']);
            return true;
        }
    };
}

test('maps the Word tracer commands to real SDK methods', () => {
    const api = createApi();
    const adapter = createWordCommandAdapter({getApi: () => api});
    const comment = {text: 'review'};

    adapter.execute('word.text.bold', {value: true});
    adapter.execute('word.paragraph.align', {value: 'center'});
    adapter.execute('word.table.insert', {columns: 3, rows: 2, style: 'default'});
    adapter.execute('common.comment.add', {comment});
    adapter.execute('common.selection.copy');

    assert.deepEqual(api.calls, [
        ['bold', true],
        ['align', 2],
        ['table', 3, 2, 'default'],
        ['comment', comment],
        ['copy']
    ]);
    assert.deepEqual(adapter.getSelectionSnapshot(), ['selection']);
});

test('describes every tracer command and rejects unknown command ids', () => {
    const adapter = createWordCommandAdapter({getApi: createApi});

    assert.deepEqual(
        adapter.getCommandDescriptors().map(command => [command.id, command.permission]),
        [
            ['word.text.bold', 'edit'],
            ['word.paragraph.align', 'edit'],
            ['word.table.insert', 'edit'],
            ['common.comment.add', 'comment'],
            ['common.selection.copy', 'view']
        ]
    );
    assert.throws(
        () => adapter.execute('word.unknown'),
        error => error.code === 'MOBILE_COMMAND_NOT_FOUND'
    );
});

test('forwards only explicit SDK lifecycle facts and unregisters them', () => {
    const api = createApi();
    const adapter = createWordCommandAdapter({getApi: () => api});
    const events = [];
    const unsubscribe = adapter.subscribeState(event => events.push(event));

    api.callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
    api.callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    api.callbacks.get('asc_onServerSaveStateChanged')({state: 'confirmed', changesIndex: 3});

    assert.deepEqual(events, [
        {type: 'document-open', phase: 'ready'},
        {type: 'transport', state: 'connected'},
        {type: 'server-save', state: 'confirmed', changesIndex: 3}
    ]);

    unsubscribe();
    assert.equal(api.callbacks.size, 0);
});
