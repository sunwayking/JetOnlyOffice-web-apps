/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const targetByRoot = Object.freeze({
    add: Object.freeze({kind: 'panel', panel: 'add', route: '/adding-page/'}),
    coauth: Object.freeze({kind: 'panel', panel: 'coauth', route: null}),
    context: Object.freeze({kind: 'editor', panel: null, route: null}),
    edit: Object.freeze({kind: 'panel', panel: 'edit', route: '/editing-page/'}),
    history: Object.freeze({kind: 'panel', panel: 'history', route: null}),
    toolbar: Object.freeze({kind: 'editor', panel: null, route: null}),
});

const settingsRouteBySection = Object.freeze({
    layout: '/presentation-settings/',
});

const commandSearchTarget = Object.freeze({
    kind: 'route',
    panel: 'settings',
    route: '/command-search/',
});

const normalizeFormat = format => String(format || '').trim().toLowerCase();

const formatLabel = id => String(id || '')
    .split('.')
    .at(-1)
    .replace(/-/g, ' ')
    .replace(/^./, value => value.toUpperCase());

export function resolvePresentationCommandTarget(mobilePath) {
    const path = String(mobilePath || '');
    const [root, section] = path.split('.');
    if (root === 'more' && section === 'command-search') return commandSearchTarget;
    if (root === 'settings') {
        return Object.freeze({
            kind: 'route',
            panel: 'settings',
            route: settingsRouteBySection[section] ?? '/settings-page/',
        });
    }
    return targetByRoot[root] ?? null;
}
export function searchAvailablePresentationCommands({
    runtime,
    commands = [],
    contexts = ['presentation'],
    format = '',
    query = '',
    locale = 'en',
    labelFor = command => formatLabel(command.id),
} = {}) {
    if (!runtime || typeof runtime.resolve !== 'function') return [];

    const contextSet = new Set(['presentation', ...contexts]);
    const normalizedFormat = normalizeFormat(format);
    const normalizedQuery = String(query).trim().toLocaleLowerCase(locale);

    return commands
        .filter(command => command?.implementation === 'implemented')
        .filter(command => command.mobilePath !== 'more.command-search')
        .filter(command => !command.contexts?.length || command.contexts.some(context => contextSet.has(context)))
        .filter(command => {
            if (!normalizedFormat || !command.formats?.length) return true;
            return command.formats.some(value => normalizeFormat(value) === normalizedFormat);
        })
        .map(command => ({command, resolved: runtime.resolve(command.id)}))
        .filter(({resolved}) => resolved?.available === true)
        .map(({command}) => ({
            command,
            label: String(labelFor(command) || formatLabel(command.id)),
            target: resolvePresentationCommandTarget(command.mobilePath),
        }))
        .filter(({target}) => target !== null)
        .filter(({label}) => !normalizedQuery || label.toLocaleLowerCase(locale).includes(normalizedQuery))
        .map(({command, label, target}) => Object.freeze({
            id: command.id,
            label,
            mobilePath: command.mobilePath,
            target,
        }));
}
