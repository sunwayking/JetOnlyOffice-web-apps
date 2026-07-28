/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function getWordGraphicContexts(value) {
    if (value?.get_ChartProperties?.()) {
        return ['shape', 'chart'];
    }
    if (value?.get_ShapeProperties?.()) {
        return ['shape'];
    }
    return ['image'];
}

export function getWordSelectionContexts(selection = [], asc = globalThis.Asc) {
    const contexts = new Set(['document']);
    const types = asc?.c_oAscTypeSelectElement ?? {};
    const typeContexts = new Map([
        [types.Header, ['header']],
        [types.Paragraph, ['text', 'paragraph']],
        [types.Text, ['text']],
        [types.Table, ['table']],
        [types.Hyperlink, ['hyperlink']],
        [types.SpellCheck, ['spellcheck']]
    ].filter(([type]) => type !== undefined));

    selection.forEach(item => {
        const type = item?.get_ObjectType?.();
        const selectedContexts = type === types.Image
            ? getWordGraphicContexts(item?.get_ObjectValue?.())
            : typeContexts.get(type);
        selectedContexts?.forEach(context => contexts.add(context));
    });
    return [...contexts];
}
