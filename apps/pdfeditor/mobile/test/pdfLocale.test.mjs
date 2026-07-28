/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {isPdfChineseLocale, resolvePdfLocale} from '../src/lib/pdfLocale.mjs';

test('URL-derived current locale takes precedence over the build default', () => {
    assert.equal(resolvePdfLocale({currentLang: 'zh', defaultLang: 'en'}, 'en-US'), 'zh');
    assert.equal(isPdfChineseLocale({currentLang: 'zh', defaultLang: 'en'}, 'en-US'), true);
    assert.equal(isPdfChineseLocale({currentLang: 'en', defaultLang: 'zh'}, 'zh-CN'), false);
});
