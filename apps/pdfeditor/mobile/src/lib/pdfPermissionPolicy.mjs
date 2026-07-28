/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function resolvePdfRuntimePermissions({appOptions = {}, permissions = {}, forceView = false} = {}) {
    const mutationsAllowed = forceView !== true;
    return {
        edit: mutationsAllowed && appOptions.isEdit === true && appOptions.isReviewOnly !== true &&
            appOptions.isForm !== true && permissions.edit !== false,
        review: mutationsAllowed && appOptions.canReview === true,
        comment: mutationsAllowed && appOptions.canComments === true,
        fillForms: mutationsAllowed && appOptions.canFillForms === true,
    };
}

export function resolvePdfPermissionProfile(profile) {
    const profiles = {
        edit: {edit: true, review: true, comment: true, fillForms: true},
        review: {edit: false, review: true, comment: true, fillForms: false},
        comment: {edit: false, review: false, comment: true, fillForms: false},
        fillForms: {edit: false, review: false, comment: false, fillForms: true},
        view: {edit: false, review: false, comment: false, fillForms: false},
    };
    return {...(profiles[profile] || profiles.view)};
}
