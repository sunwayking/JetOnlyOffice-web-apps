/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function resolveMobileForceView(customization = {}, editorConfig = {}) {
    return customization.mobileForceView ??
        editorConfig.mobileForceView ??
        customization.mobile?.forceView ??
        false;
}

export function resolveWordRuntimePermissions({storeAppOptions, permissions, forceView}) {
    const mutationsAllowed = forceView !== true;
    return {
        edit: mutationsAllowed && !storeAppOptions.isForm && storeAppOptions.isEdit &&
            permissions.edit !== false && !storeAppOptions.isReviewOnly,
        review: mutationsAllowed && storeAppOptions.canReview,
        comment: mutationsAllowed && storeAppOptions.canComments,
        fillForms: mutationsAllowed && storeAppOptions.canFillForms
    };
}
