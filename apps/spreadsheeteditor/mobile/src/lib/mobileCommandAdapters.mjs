/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
    getSpreadsheetCommandDestination,
    isSpreadsheetCommandDestinationReachable,
} from './commandSearchModel.mjs';

export const SPREADSHEET_COMMAND_NAVIGATION_EVENT = 'spreadsheet:command:navigate';

const adapterError = (code, message, details) => {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
};

export function createSpreadsheetNavigationHandler({inventory, notifications} = {}) {
    if (typeof notifications?.trigger !== 'function') {
        throw new TypeError('createSpreadsheetNavigationHandler requires notifications.trigger');
    }
    if (!Array.isArray(inventory?.commands)) {
        throw new TypeError('createSpreadsheetNavigationHandler requires inventory.commands');
    }

    const commandsById = new Map(inventory.commands.map(command => [command.id, command]));

    return (intent, payload) => {
        const command = commandsById.get(intent?.commandId);
        const destination = getSpreadsheetCommandDestination(command);
        if (!isSpreadsheetCommandDestinationReachable(destination)) {
            throw adapterError(
                'MOBILE_NAVIGATION_DESTINATION_UNAVAILABLE',
                `Spreadsheet Mobile destination is unavailable: ${intent?.commandId}`,
                {intent},
            );
        }
        notifications.trigger(SPREADSHEET_COMMAND_NAVIGATION_EVENT, destination, payload);
        return destination;
    };
}

export function activateSpreadsheetCommandDestination(destination, {
    enableSearch,
    executeCommand,
    openCommandPanel,
    openOptions,
} = {}) {
    if (!isSpreadsheetCommandDestinationReachable(destination)) {
        throw adapterError(
            'MOBILE_NAVIGATION_DESTINATION_UNAVAILABLE',
            `Spreadsheet Mobile destination is unavailable: ${destination?.commandId}`,
            {destination},
        );
    }

    if (destination.option === 'command-search') {
        if (typeof openCommandPanel !== 'function') {
            throw adapterError('MOBILE_NAVIGATION_HANDLER_UNAVAILABLE', 'Spreadsheet command panel handler is unavailable', {destination});
        }
        return openCommandPanel(destination.panel, destination.commandId);
    }
    if (destination.option === 'search') {
        if (typeof enableSearch !== 'function') {
            throw adapterError('MOBILE_NAVIGATION_HANDLER_UNAVAILABLE', 'Spreadsheet search handler is unavailable', {destination});
        }
        return enableSearch(destination.commandId);
    }
    if (destination.option === 'execute') {
        if (typeof executeCommand !== 'function') {
            throw adapterError('MOBILE_NAVIGATION_HANDLER_UNAVAILABLE', 'Spreadsheet command execution handler is unavailable', {destination});
        }
        return executeCommand(destination.commandId);
    }
    if (typeof openOptions !== 'function') {
        throw adapterError('MOBILE_NAVIGATION_HANDLER_UNAVAILABLE', 'Spreadsheet Mobile page handler is unavailable', {destination});
    }

    const payload = destination.option === 'add'
        ? destination.panel === 'root' ? undefined : {panels: destination.panel}
        : {panels: [destination.panel], commandId: destination.commandId};
    return openOptions(destination.option, payload);
}

/**
 * Bridges catalog host actions to the existing Gateway and notification
 * contracts. The bridge is injected by the page so the provider stays usable
 * in a browser, WebView, or a unit test without importing a host singleton.
 */
export function createSpreadsheetHostCommandHandler({
    gateway,
    notifications,
    openUrl = typeof window !== 'undefined' ? window.open.bind(window) : null,
    suggestUrl,
} = {}) {
    const trigger = (event, payload) => {
        if (typeof notifications?.trigger !== 'function') {
            throw adapterError('MOBILE_HOST_NOTIFICATIONS_UNAVAILABLE', 'Spreadsheet host notifications are unavailable', {event});
        }
        return payload === undefined
            ? notifications.trigger(event)
            : notifications.trigger(event, payload);
    };
    const callGateway = (method, ...args) => {
        if (typeof gateway?.[method] !== 'function') {
            throw adapterError('MOBILE_HOST_GATEWAY_UNAVAILABLE', `Spreadsheet Gateway method is unavailable: ${method}`, {method});
        }
        return gateway[method](...args);
    };

    return (intent, payload = {}) => {
        const action = intent?.action;
        switch (action) {
            case 'close-editor':
            case 'file-close':
                // Existing Toolbar/Main handlers own the unsaved-content guard.
                return trigger('close');
            case 'go-back':
                return trigger('goback');
            case 'request-edit-rights':
                return callGateway('requestEditRights');
            case 'create-new':
                return callGateway('requestCreateNew');
            case 'file-open':
                return callGateway('requestOpen', payload);
            case 'open-recent':
                return callGateway('requestOpen', {...payload, recent: true});
            case 'rename': {
                const title = typeof payload === 'string' ? payload : payload.title;
                if (!title || !String(title).trim()) {
                    throw adapterError('MOBILE_HOST_RENAME_TITLE_REQUIRED', 'A document title is required to rename the spreadsheet');
                }
                return callGateway('requestRename', String(title).trim());
            }
            case 'suggest': {
                const url = payload.url || suggestUrl;
                if (typeof openUrl !== 'function' || !url) {
                    throw adapterError('MOBILE_HOST_SUGGEST_UNAVAILABLE', 'The suggestion page is unavailable');
                }
                return openUrl(url, '_blank');
            }
            default:
                throw adapterError('MOBILE_HOST_ACTION_UNSUPPORTED', `Unsupported Spreadsheet host action: ${action}`, {action});
        }
    };
}
