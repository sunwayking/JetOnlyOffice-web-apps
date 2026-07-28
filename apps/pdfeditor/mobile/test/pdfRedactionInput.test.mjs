/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {parsePdfPageRange} from '../src/lib/pdfRedactionInput.mjs';

test('PDF redaction page ranges are converted to unique zero-based indexes', () => {
    assert.deepEqual(parsePdfPageRange('1, 3-5, 5'), [0, 2, 3, 4]);
});

test('PDF redaction page ranges reject invalid and descending ranges', () => {
    for (const value of ['', '0', '5-3', '1-two', '1,,2']) {
        assert.throws(
            () => parsePdfPageRange(value),
            error => error.code === 'MOBILE_PDF_PAGE_RANGE_INVALID',
            value,
        );
    }
});
