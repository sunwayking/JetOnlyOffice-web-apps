/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/view/PdfMobileApp.jsx', import.meta.url), 'utf8');

test('PDF Mobile renders four bilingual, closable full-width information overlays', () => {
    for (const overlay of ['about', 'support', 'chart-links', 'chart-data']) {
        assert.match(source, new RegExp(`uiState\\.overlay === '${overlay}'`));
    }

    assert.match(source, /className="pdf-global-panel pdf-information-panel"/);
    assert.match(source, /onClick=\{\(\) => bridge\.closeOverlay\(\)\}/);
    for (const label of ['About', '关于', 'Support', '支持', 'Chart links', '图表链接', 'Chart data', '图表数据']) {
        assert.ok(source.includes(label), `missing overlay label: ${label}`);
    }
});

test('PDF Mobile about and support panels expose only resolved product and URL facts', () => {
    assert.match(source, /const PRODUCT_NAME = 'JetOnlyOffice PDF'/);
    assert.match(source, /\{\{PRODUCT_VERSION\}\}/);
    assert.match(source, /isUnresolvedBuildToken/);
    assert.match(source, /customization\?\.feedback\?\.url/);
    assert.match(source, /\{\{SUPPORT_URL\}\}/);
    assert.match(source, /https:\/\/support\.onlyoffice\.com/);
    assert.match(source, /resolveHttpUrl/);
    assert.match(source, /supportUrl \? \(/);
    assert.match(source, /<button[^>]*disabled[^>]*>/);
});

test('PDF Mobile chart panels show selected SDK link facts and gate the real edit-data command', () => {
    assert.match(source, /get_ChartProperties/);
    assert.match(source, /getExternalReference/);
    assert.match(source, /asc_getSource/);
    assert.match(source, /bridge\.getSelection\(\)/);
    assert.match(source, /bridge\.resolveCommand\('pdf\.chart\.edit-data'\)/);
    assert.match(source, /disabled=\{!chartEditDataResolution\?\.available\}/);
    assert.match(source, /runCommand\('pdf\.chart\.edit-data'\)/);
    assert.match(source, /No linked data source available for the selected chart/);
    assert.match(source, /所选图表没有可用的链接数据源/);
});
