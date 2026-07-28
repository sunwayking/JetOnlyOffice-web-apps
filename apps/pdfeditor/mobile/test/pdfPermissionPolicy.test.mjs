/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    resolvePdfPermissionProfile,
    resolvePdfRuntimePermissions,
} from '../src/lib/pdfPermissionPolicy.mjs';

test('PDF exposes the five release permission profiles', () => {
    assert.deepEqual(resolvePdfPermissionProfile('edit'), {
        edit: true,
        review: true,
        comment: true,
        fillForms: true,
    });
    assert.deepEqual(resolvePdfPermissionProfile('review'), {
        edit: false,
        review: true,
        comment: true,
        fillForms: false,
    });
    assert.deepEqual(resolvePdfPermissionProfile('comment'), {
        edit: false,
        review: false,
        comment: true,
        fillForms: false,
    });
    assert.deepEqual(resolvePdfPermissionProfile('fillForms'), {
        edit: false,
        review: false,
        comment: false,
        fillForms: true,
    });
    assert.deepEqual(resolvePdfPermissionProfile('view'), {
        edit: false,
        review: false,
        comment: false,
        fillForms: false,
    });
});

test('PDF permission policy denies every mutation in force-view mode', () => {
    const input = {
        appOptions: {
            isEdit: true,
            isReviewOnly: false,
            isForm: false,
            canReview: true,
            canComments: true,
            canFillForms: true,
        },
        permissions: {edit: true},
    };
    assert.deepEqual(resolvePdfRuntimePermissions({...input, forceView: true}), resolvePdfPermissionProfile('view'));
    assert.deepEqual(resolvePdfRuntimePermissions({...input, forceView: false}), resolvePdfPermissionProfile('edit'));
});

test('PDF form sessions allow filling without general PDF editing', () => {
    assert.deepEqual(resolvePdfRuntimePermissions({
        appOptions: {
            isEdit: true,
            isForm: true,
            canFillForms: true,
        },
        permissions: {edit: true},
    }), resolvePdfPermissionProfile('fillForms'));
});
