/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const CONTEXT_COMMANDS = Object.freeze({
    page: Object.freeze([
        'pdf.clipboard.copy',
        'pdf.pages.cut',
        'pdf.pages.paste-before',
        'pdf.pages.paste-after',
        'pdf.redaction.current-page',
        'pdf.pages.add',
        'pdf.pages.rotate',
        'pdf.pages.remove',
    ]),
    annotation: Object.freeze([
        'pdf.clipboard.copy',
        'pdf.clipboard.cut',
        'pdf.clipboard.paste',
        'pdf.comment.add',
        'pdf.annotation.marker',
        'pdf.annotation.ink-start',
        'pdf.annotation.ink-stop',
        'pdf.annotation.remove-selected',
    ]),
    field: Object.freeze([
        'pdf.clipboard.copy',
        'pdf.clipboard.cut',
        'pdf.clipboard.paste',
        'pdf.forms.clear',
        'pdf.signatures.fields',
        'pdf.signatures.requested',
    ]),
    selection: Object.freeze([
        'pdf.clipboard.copy',
        'pdf.clipboard.cut',
        'pdf.clipboard.paste',
        'pdf.redaction.selection',
        'pdf.comment.add',
        'pdf.annotation.marker',
    ]),
});

const COMMAND_INPUTS = Object.freeze({
    'pdf.redaction.pages': Object.freeze({
        inputMode: 'text',
        label: Object.freeze(['Page or range', '页码或范围']),
        multiline: false,
        placeholder: Object.freeze(['For example 1, 3-5', '例如 1, 3-5']),
        type: 'text',
    }),
    'pdf.redaction.search-all': Object.freeze({
        inputMode: 'search',
        label: Object.freeze(['Search results', '搜索结果']),
        multiline: false,
        placeholder: Object.freeze(['Enter text to find', '输入要查找的文字']),
        type: 'search',
    }),
    'pdf.insert.image-url': Object.freeze({
        inputMode: 'url',
        label: Object.freeze(['Image link', '图片链接']),
        multiline: false,
        placeholder: Object.freeze(['https://example.com/image.png', 'https://example.com/image.png']),
        type: 'url',
    }),
    'pdf.comment.add': Object.freeze({
        inputMode: 'text',
        label: Object.freeze(['Comment', '评论']),
        multiline: true,
        placeholder: Object.freeze(['Enter a comment', '输入评论']),
        type: 'text',
    }),
    'pdf.signatures.apply-appearance': Object.freeze({
        inputMode: 'text',
        label: Object.freeze(['Signature text', '签名文字']),
        multiline: false,
        placeholder: Object.freeze(['Enter signature text', '输入签名文字']),
        type: 'text',
    }),
});

const callFirst = (value, methods) => {
    for (const method of methods) {
        if (typeof value?.[method] !== 'function') continue;
        try {
            const result = value[method]();
            if (result !== undefined && result !== null && result !== '') return result;
        } catch {
            // Ignore malformed participant/selection facts and continue with fallbacks.
        }
    }
    return undefined;
};

export function resolvePdfSelectionContext(selection, Asc = {}) {
    const items = Array.isArray(selection) ? selection : [];
    const types = new Set(items.map(item => callFirst(item, ['get_ObjectType', 'GetObjectType'])));
    const constants = Asc.c_oAscTypeSelectElement || {};
    let kind = 'selection';

    if ((constants.Field !== undefined && types.has(constants.Field)) || types.has('field')) kind = 'field';
    else if ((constants.Annot !== undefined && types.has(constants.Annot)) ||
        types.has('annot') || types.has('annotation')) kind = 'annotation';
    else if ((constants.PdfPage !== undefined && types.has(constants.PdfPage)) ||
        types.has('pdf-page') || types.has('page')) kind = 'page';

    return {kind, commands: [...CONTEXT_COMMANDS[kind]]};
}

export function normalizePdfParticipants(users) {
    const values = Array.isArray(users)
        ? users
        : users && typeof users === 'object' ? Object.values(users) : [];

    return values.filter(Boolean).map((user, index) => {
        const id = callFirst(user, ['asc_getIdOriginal', 'asc_getId']) ?? user.id ?? `participant-${index + 1}`;
        const name = callFirst(user, ['asc_getUserName']) ?? user.name ?? 'Guest';
        const view = callFirst(user, ['asc_getView']) ?? user.view;
        return {
            id: String(id),
            name: String(name || 'Guest'),
            view: view === true,
        };
    });
}

export function filterPdfCommandSearchResults({commands, query, labelFor, resolve}) {
    const needle = String(query || '').trim().toLocaleLowerCase();
    if (!needle || !Array.isArray(commands)) return [];

    return commands.filter(command => {
        const resolution = typeof resolve === 'function' ? resolve(command.id) : {available: true};
        if (!resolution?.available) return false;
        const label = typeof labelFor === 'function' ? labelFor(command) : command.id;
        return `${label} ${command.id}`.toLocaleLowerCase().includes(needle);
    });
}

export function resolvePdfCommandInput(commandId, chinese = false) {
    const descriptor = COMMAND_INPUTS[commandId];
    if (!descriptor) return null;
    const localeIndex = chinese ? 1 : 0;
    return {
        commandId,
        inputMode: descriptor.inputMode,
        label: descriptor.label[localeIndex],
        multiline: descriptor.multiline,
        placeholder: descriptor.placeholder[localeIndex],
        type: descriptor.type,
    };
}
