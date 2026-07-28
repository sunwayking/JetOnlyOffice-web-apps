/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {listSearchableWordCommands} from './wordCommandCatalog.mjs';
export {getWordSelectionContexts} from './wordSelectionContext.mjs';

const pathTargets = Object.freeze({
    edit: 'edit',
    insert: 'add',
    collaboration: 'coauth',
    settings: 'settings',
    more: 'settings',
    toolbar: 'editor',
    context: 'editor'
});

export function resolveWordCommandTarget(mobilePath) {
    return pathTargets[String(mobilePath).split('.')[0]] ?? 'settings';
}

export function searchAvailableWordCommands({runtime, locale = 'en', query = '', contexts = ['document']} = {}) {
    if (!runtime) {
        return [];
    }
    const normalizedQuery = String(query).trim().toLocaleLowerCase(locale);
    const contextSet = new Set(contexts);

    return listSearchableWordCommands(locale)
        .filter(command => command.contexts.some(context => contextSet.has(context)))
        .filter(command => runtime.resolve(command.id)?.available === true)
        .filter(command => !normalizedQuery || command.label.toLocaleLowerCase(locale).includes(normalizedQuery))
        .map(command => Object.freeze({
            id: command.id,
            label: command.label,
            mobilePath: command.mobilePath,
            target: resolveWordCommandTarget(command.mobilePath)
        }));
}
