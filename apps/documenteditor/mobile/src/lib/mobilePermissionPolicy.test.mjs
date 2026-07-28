/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    resolveMobileForceView,
    resolveWordRuntimePermissions
} from './mobilePermissionPolicy.mjs';

test('Mobile editing is enabled by default and honors every explicit force-view source', () => {
    assert.equal(resolveMobileForceView(), false);
    assert.equal(resolveMobileForceView({mobile: {forceView: true}}), true);
    assert.equal(resolveMobileForceView({mobileForceView: true}), true);
    assert.equal(resolveMobileForceView({}, {mobileForceView: true}), true);
    assert.equal(resolveMobileForceView({mobileForceView: null, mobile: {forceView: true}}), true);
});

test('force-view denies every mutation permission before Runtime publication', () => {
    const storeAppOptions = {
        isEdit: true,
        isReviewOnly: false,
        isForm: false,
        canReview: true,
        canComments: true,
        canFillForms: true
    };
    const permissions = {edit: true};

    assert.deepEqual(resolveWordRuntimePermissions({storeAppOptions, permissions, forceView: true}), {
        edit: false,
        review: false,
        comment: false,
        fillForms: false
    });
    assert.deepEqual(resolveWordRuntimePermissions({storeAppOptions, permissions, forceView: false}), {
        edit: true,
        review: true,
        comment: true,
        fillForms: true
    });
});

test('form sessions expose form filling without general document editing', () => {
    assert.deepEqual(resolveWordRuntimePermissions({
        storeAppOptions: {
            isEdit: true,
            isReviewOnly: false,
            isForm: true,
            canReview: false,
            canComments: false,
            canFillForms: true
        },
        permissions: {edit: true},
        forceView: false
    }), {
        edit: false,
        review: false,
        comment: false,
        fillForms: true
    });
});
