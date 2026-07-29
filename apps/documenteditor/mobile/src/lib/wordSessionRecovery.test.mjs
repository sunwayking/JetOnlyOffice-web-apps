/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {requestWordSessionReopen} from './wordSessionRecovery.mjs';

test('reopens a confirmed clean Word session without a discard prompt', () => {
    let reloads = 0;
    let prompts = 0;

    const reopened = requestWordSessionReopen({
        getApi: () => ({isDocumentModified: () => false}),
        confirmDiscard: () => {
            prompts += 1;
            return false;
        },
        reload: () => {
            reloads += 1;
        }
    });

    assert.equal(reopened, true);
    assert.equal(prompts, 0);
    assert.equal(reloads, 1);
});

test('does not abandon modified Word content without explicit confirmation', () => {
    let reloads = 0;

    const reopened = requestWordSessionReopen({
        getApi: () => ({isDocumentModified: () => true}),
        confirmDiscard: () => false,
        reload: () => {
            reloads += 1;
        }
    });

    assert.equal(reopened, false);
    assert.equal(reloads, 0);
});

test('reopens modified Word content only after explicit confirmation', () => {
    let reloads = 0;

    const reopened = requestWordSessionReopen({
        getApi: () => ({isDocumentModified: () => true}),
        confirmDiscard: () => true,
        reload: () => {
            reloads += 1;
        }
    });

    assert.equal(reopened, true);
    assert.equal(reloads, 1);
});

test('fails closed when the editor content state cannot be read', () => {
    let reloads = 0;

    const reopened = requestWordSessionReopen({
        getApi: () => {
            throw new Error('editor unavailable');
        },
        reload: () => {
            reloads += 1;
        }
    });

    assert.equal(reopened, false);
    assert.equal(reloads, 0);
});
