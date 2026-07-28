/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function resolvePdfLocale(locale = {}, navigatorLanguage = 'en') {
    return String(locale.currentLang || locale.defaultLang || navigatorLanguage).toLowerCase();
}

export function isPdfChineseLocale(locale, navigatorLanguage) {
    return resolvePdfLocale(locale, navigatorLanguage).startsWith('zh');
}
