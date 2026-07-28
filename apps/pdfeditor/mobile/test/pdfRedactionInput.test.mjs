/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {parsePdfPageRange} from '../src/lib/pdfRedactionInput.mjs';

test('PDF redaction page ranges are converted to unique zero-based indexes', () => {
    assert.deepEqual(parsePdfPageRange('1, 3-5, 5', 8), [0, 2, 3, 4]);
});

test('PDF redaction page ranges reject invalid and descending ranges', () => {
    for (const value of ['', '0', '5-3', '1-two', '1,,2']) {
        assert.throws(
            () => parsePdfPageRange(value, 8),
            error => error.code === 'MOBILE_PDF_PAGE_RANGE_INVALID',
            value,
        );
    }
});

test('PDF redaction page ranges reject unsafe or out-of-document bounds before expansion', () => {
    for (const [value, pageCount] of [
        ['1-999999999', 20],
        ['1-9007199254740992', 20],
        ['21', 20],
        ['1-2', 0],
        ['1-2', Number.POSITIVE_INFINITY],
    ]) {
        assert.throws(
            () => parsePdfPageRange(value, pageCount),
            error => error.code === 'MOBILE_PDF_PAGE_RANGE_INVALID',
            `${value}/${pageCount}`,
        );
    }
});
