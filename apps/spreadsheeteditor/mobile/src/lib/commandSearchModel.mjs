/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const explicitNavigationDestinations = Object.freeze({
    'spreadsheet.desktop.about': {option: 'settings', panel: 'about'},
    'spreadsheet.desktop.accounting-style': {option: 'edit', panel: 'root'},
    'spreadsheet.desktop.advancedsearch': {option: 'search', panel: 'search'},
    'spreadsheet.desktop.auto-filter': {option: 'add', panel: 'root'},
    'spreadsheet.desktop.autosum': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.charttab': {option: 'edit', panel: 'root'},
    'spreadsheet.desktop.clear-style': {option: 'edit', panel: 'root'},
    'spreadsheet.desktop.delete-cell': {option: 'edit', panel: 'root'},
    'spreadsheet.desktop.draw': {option: 'edit', panel: 'root'},
    'spreadsheet.desktop.export-pdf': {option: 'settings', panel: 'download'},
    'spreadsheet.desktop.formula-datetime': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.formula-financial': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.formula-logical': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.formula-math': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.formula-more': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.formula-recent': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.formula-reference': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.formula-textdata': {option: 'add', panel: 'function'},
    'spreadsheet.desktop.freeze-panes': {option: 'settings', panel: 'spreadsheet-settings'},
    'spreadsheet.desktop.help': {option: 'settings', panel: 'root'},
    'spreadsheet.desktop.history': {option: 'history', panel: 'version-history'},
    'spreadsheet.desktop.id-context-menu-item-add-comment': {option: 'coauth', panel: 'root'},
    'spreadsheet.desktop.id-context-menu-item-view-add-comment': {option: 'coauth', panel: 'root'},
    'spreadsheet.desktop.info': {option: 'settings', panel: 'spreadsheet-info'},
    'spreadsheet.desktop.interface-theme': {option: 'settings', panel: 'theme'},
    'spreadsheet.desktop.number-fill': {option: 'command-search', panel: 'advanced.fill-series'},
    'spreadsheet.desktop.opts': {option: 'settings', panel: 'application-settings'},
    'spreadsheet.desktop.print': {option: 'execute', panel: 'execute'},
    'spreadsheet.desktop.printarea': {option: 'settings', panel: 'spreadsheet-settings'},
    'spreadsheet.desktop.printpreview': {option: 'settings', panel: 'root'},
    'spreadsheet.desktop.printtitles': {option: 'settings', panel: 'spreadsheet-settings'},
    'spreadsheet.desktop.protect': {option: 'settings', panel: 'spreadsheet-settings'},
    'spreadsheet.desktop.rename': {option: 'command-search', panel: 'advanced.rename'},
    'spreadsheet.desktop.replace': {option: 'search', panel: 'search'},
    'spreadsheet.desktop.review': {option: 'coauth', panel: 'root'},
    'spreadsheet.desktop.rights': {option: 'coauth', panel: 'root'},
    'spreadsheet.desktop.save-copy': {option: 'settings', panel: 'download'},
    'spreadsheet.desktop.save-desktop': {option: 'settings', panel: 'download'},
    'spreadsheet.desktop.saveas': {option: 'settings', panel: 'download'},
    'spreadsheet.desktop.scale': {option: 'settings', panel: 'spreadsheet-settings'},
    'spreadsheet.desktop.search': {option: 'search', panel: 'search'},
    'spreadsheet.desktop.sort-ascending': {option: 'add', panel: 'root'},
    'spreadsheet.desktop.sort-descending': {option: 'add', panel: 'root'},
    'spreadsheet.desktop.support': {option: 'settings', panel: 'root'},
    'spreadsheet.desktop.tabledesign': {option: 'edit', panel: 'root'},
    'spreadsheet.desktop.view': {option: 'settings', panel: 'spreadsheet-settings'},
});

const directlyExecutableCommandIds = new Set([
    'spreadsheet.desktop.back',
    'spreadsheet.desktop.calculate',
    'spreadsheet.desktop.cancel',
    'spreadsheet.desktop.clear-filter',
    'spreadsheet.desktop.close-editor',
    'spreadsheet.desktop.cut',
    'spreadsheet.desktop.edit',
    'spreadsheet.desktop.exit',
    'spreadsheet.desktop.file-exit',
    'spreadsheet.desktop.file-open',
    'spreadsheet.desktop.new',
    'spreadsheet.desktop.recent',
    'spreadsheet.desktop.save',
    'spreadsheet.desktop.save-2',
    'spreadsheet.desktop.select-all',
    'spreadsheet.desktop.suggest',
]);

const advancedCommandIds = new Map([
    ['spreadsheet.desktop.import-data', 'advanced.import-data'],
    ['spreadsheet.desktop.id-context-menu-item-add-named-range', 'advanced.named-ranges'],
    ['spreadsheet.desktop.id-toolbar-btn-closeview', 'advanced.sheet-view'],
    ['spreadsheet.desktop.id-toolbar-btn-createview', 'advanced.sheet-view'],
    ['spreadsheet.desktop.named-ranges', 'advanced.named-ranges'],
    ['spreadsheet.desktop.pivot', 'advanced.pivot'],
    ['spreadsheet.desktop.pivot-blank-rows', 'advanced.pivot'],
    ['spreadsheet.desktop.pivot-grand-totals', 'advanced.pivot'],
    ['spreadsheet.desktop.pivot-layout', 'advanced.pivot'],
    ['spreadsheet.desktop.pivot-refresh', 'advanced.pivot'],
    ['spreadsheet.desktop.pivot-subtotals', 'advanced.pivot'],
    ['spreadsheet.desktop.sheet-view', 'advanced.sheet-view'],
    ['spreadsheet.desktop.cell-group', 'advanced.outline'],
    ['spreadsheet.desktop.cell-ungroup', 'advanced.outline'],
    ['spreadsheet.desktop.sparklinetab', 'advanced.sparkline'],
    ['spreadsheet.sparkline.type', 'advanced.sparkline'],
]);

export const spreadsheetAdvancedPanelIds = Object.freeze([
    'advanced.fill-series',
    'advanced.import-data',
    'advanced.named-ranges',
    'advanced.outline',
    'advanced.pivot',
    'advanced.rename',
    'advanced.sheet-view',
    'advanced.sparkline',
]);

export const spreadsheetCommandDestinationPanels = Object.freeze({
    add: Object.freeze(['root', 'function']),
    coauth: Object.freeze(['root']),
    'command-search': spreadsheetAdvancedPanelIds,
    edit: Object.freeze(['root']),
    execute: Object.freeze(['execute']),
    history: Object.freeze(['version-history']),
    search: Object.freeze(['search']),
    settings: Object.freeze([
        'about',
        'application-settings',
        'download',
        'root',
        'spreadsheet-info',
        'spreadsheet-settings',
        'theme',
    ]),
});

const humanize = id => id
    .replace(/^spreadsheet\.(desktop\.)?/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());

const localize = (command, commandLabels) => {
    const localized = commandLabels && typeof commandLabels === 'object'
        ? commandLabels[command.id]
        : null;
    return localized || command.label || humanize(command.id);
};

export function isSpreadsheetCommandDestinationReachable(destination) {
    return Boolean(destination
        && spreadsheetCommandDestinationPanels[destination.option]?.includes(destination.panel));
}

export function getSpreadsheetCommandDestination(command) {
    if (!command || command.implementation !== 'implemented') return null;

    if (directlyExecutableCommandIds.has(command.id)) {
        return {option: 'execute', panel: 'execute', commandId: command.id};
    }

    const explicit = explicitNavigationDestinations[command.id];
    if (explicit) return {...explicit, commandId: command.id};

    const advancedPanel = advancedCommandIds.get(command.id);
    if (advancedPanel) {
        return {option: 'command-search', panel: advancedPanel, commandId: command.id};
    }

    const [option] = (command.mobilePath || '').split('.');
    if (option === 'edit') return {option: 'edit', panel: 'root', commandId: command.id};
    if (option === 'add') return {option: 'add', panel: 'root', commandId: command.id};
    if (option === 'settings') return {option: 'settings', panel: 'spreadsheet-settings', commandId: command.id};
    return null;
}

export function searchSpreadsheetCommands({
    inventory,
    query = '',
    contexts = [],
    commandLabels,
    resolveCommand,
} = {}) {
    if (!inventory || !Array.isArray(inventory.commands)) return [];
    const normalizedQuery = String(query).trim().toLocaleLowerCase();
    const activeContexts = new Set(contexts);

    return inventory.commands
        .filter(command => command.implementation === 'implemented')
        .filter(command => command.id.startsWith('spreadsheet.desktop.'))
        .filter(command => !activeContexts.size || command.contexts.some(context => activeContexts.has(context)))
        .map(command => {
            const resolution = typeof resolveCommand === 'function'
                ? resolveCommand(command.id)
                : {available: true};
            return {
                ...command,
                label: localize(command, commandLabels),
                resolution,
                disabled: resolution?.available !== true,
                destination: getSpreadsheetCommandDestination(command),
            };
        })
        .filter(command => command.resolution?.reason !== 'permission-denied')
        .filter(command => {
            if (!normalizedQuery) return true;
            const haystack = `${command.id} ${command.label} ${command.mobilePath}`.toLocaleLowerCase();
            return haystack.includes(normalizedQuery);
        })
        .sort((left, right) => Number(left.disabled) - Number(right.disabled));
}

export const spreadsheetCommandNavigationDestinations = explicitNavigationDestinations;
export const spreadsheetDirectCommandIds = directlyExecutableCommandIds;
