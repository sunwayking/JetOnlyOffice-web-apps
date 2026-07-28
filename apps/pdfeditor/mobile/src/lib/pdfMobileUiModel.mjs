/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const CONTEXT_COMMANDS = Object.freeze({
    page: Object.freeze([
        'pdf.redaction.current-page',
        'pdf.pages.add',
        'pdf.pages.rotate',
        'pdf.pages.remove',
    ]),
    annotation: Object.freeze([
        'pdf.comment.add',
        'pdf.annotation.marker',
        'pdf.annotation.ink-start',
        'pdf.annotation.ink-stop',
    ]),
    field: Object.freeze([
        'pdf.forms.clear',
        'pdf.signatures.fields',
        'pdf.signatures.requested',
    ]),
    selection: Object.freeze([
        'pdf.redaction.selection',
        'pdf.comment.add',
        'pdf.annotation.marker',
    ]),
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
