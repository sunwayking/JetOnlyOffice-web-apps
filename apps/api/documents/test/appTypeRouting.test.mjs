/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const apiSource = await readFile(new URL('../api.js', import.meta.url), 'utf8');

function createEditorFrame({fileType, width, height}) {
    let editorFrame = null;
    const placeholder = {
        parentNode: {
            replaceChild(next) {
                editorFrame = next;
            },
        },
    };
    const document = {
        body: {style: {}},
        currentScript: null,
        createElement(tagName) {
            return {
                contentWindow: {postMessage() {}},
                setAttribute() {},
                style: {},
                tagName,
            };
        },
        getElementById: id => id === 'editor' ? placeholder : null,
        getElementsByTagName: tagName => tagName === 'script'
            ? [{src: 'https://office.example/web-apps/apps/api/documents/api.js'}]
            : [],
    };
    const localStorage = {
        getItem: () => null,
        removeItem() {},
        setItem() {},
    };
    const window = {
        addEventListener() {},
        alert() {},
        innerHeight: height,
        innerWidth: width,
        JSON,
        localStorage,
        location: {origin: 'https://host.example', search: ''},
        removeEventListener() {},
    };
    window.parent = window;

    vm.runInNewContext(apiSource, {
        console,
        document,
        localStorage,
        window,
    });

    new window.DocsAPI.DocEditor('editor', {
        type: 'mobile',
        document: {
            fileType,
            isForm: fileType === 'pdf' ? false : undefined,
            key: 'route-test',
            title: 'Route test',
            url: `https://files.example/route-test.${fileType}`,
        },
        editorConfig: {customization: {}},
    });

    return editorFrame;
}

test('Mobile editor routing keeps phones on Mobile and sends 600px-short-edge tablets to Desktop', () => {
    const editors = {
        docx: 'documenteditor',
        pdf: 'pdfeditor',
        pptx: 'presentationeditor',
        xlsx: 'spreadsheeteditor',
    };
    const viewports = [
        {height: 844, pathType: 'mobile', width: 390},
        {height: 390, pathType: 'mobile', width: 844},
        {height: 960, pathType: 'mobile', width: 599},
        {height: 599, pathType: 'mobile', width: 960},
        {height: 960, pathType: 'main', width: 600},
        {height: 600, pathType: 'main', width: 960},
    ];

    for (const [fileType, editor] of Object.entries(editors)) {
        for (const {height, pathType, width} of viewports) {
            const iframe = createEditorFrame({fileType, width, height});
            assert.match(
                iframe.src,
                new RegExp(`/apps/${editor}/${pathType}/index\\.html`),
                `${fileType}/${width}x${height}`,
            );
        }
    }
});
