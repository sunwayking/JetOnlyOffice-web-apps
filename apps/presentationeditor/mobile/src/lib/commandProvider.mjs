/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { COMMON_COMMAND_IDS } from '../../../../common/mobile/lib/runtime/createEditorRuntime.mjs';

const payloadArguments = payload => {
    if (payload === undefined) return [];
    if (payload === null) return [null];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.args)) return payload.args;
    return Object.prototype.hasOwnProperty.call(payload, 'value') ? [payload.value] : [payload];
};

const providerError = (code, message, details) => {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
};

const getDefaultSelection = api => api.getSelectedElements();

export const createPresentationCommandProvider = ({
    inventory,
    getApi,
    getSelectionSnapshot,
    subscribeState,
    resolveContextMenu,
    captureViewState,
    restoreViewState,
} = {}) => {
    if (!inventory || !Array.isArray(inventory.commands)) {
        throw new TypeError('createPresentationCommandProvider requires an inventory');
    }
    if (typeof getApi !== 'function') {
        throw new TypeError('createPresentationCommandProvider requires getApi');
    }

    const commands = new Map(inventory.commands.map(command => [command.id, command]));
    const handlers = new Map();
    const descriptors = Object.freeze(inventory.commands
        .filter(command => command.implementation === 'implemented')
        .map(command => Object.freeze({
            id: command.id,
            permission: command.permissions.includes('view') ? 'view' : command.permissions[0],
            contexts: Object.freeze(command.contexts.slice()),
            mobilePath: command.mobilePath,
        }))
        .concat(Object.freeze({
            id: COMMON_COMMAND_IDS.ADD_COMMENT,
            permission: 'comment',
        })));
    const detachSubscriptions = new Set();
    let disposed = false;

    const assertActive = () => {
        if (disposed) {
            throw providerError('MOBILE_ADAPTER_DISPOSED', 'Presentation command provider has been disposed');
        }
    };

    const requireApi = () => {
        const api = getApi();
        if (!api) {
            throw providerError('MOBILE_EDITOR_API_UNAVAILABLE', 'Presentation editor API is not available');
        }
        return api;
    };

    const getCommand = id => commands.get(id) || null;

    const execute = (id, payload) => {
        assertActive();
        if (id === COMMON_COMMAND_IDS.ADD_COMMENT) {
            return requireApi().asc_addComment(payload?.comment);
        }
        const command = getCommand(id);
        if (!command) {
            throw providerError('MOBILE_COMMAND_NOT_FOUND', `Unknown Presentation command: ${id}`, { commandId: id });
        }
        if (command.implementation !== 'implemented') {
            throw providerError('MOBILE_COMMAND_NOT_IMPLEMENTED', `Presentation command is not implemented: ${id}`, { commandId: id });
        }

        const customHandler = handlers.get(id);
        if (customHandler) return customHandler(payload);

        const api = requireApi();
        const method = command.binding && command.binding.method;
        if (!method || typeof api[method] !== 'function') {
            throw providerError('MOBILE_COMMAND_BINDING_UNAVAILABLE', `Presentation command binding is unavailable: ${id}`, {
                commandId: id,
                method,
            });
        }
        return api[method](...payloadArguments(payload));
    };

    return Object.freeze({
        editor: inventory.editor,
        get inventory() {
            return inventory;
        },
        getCommand,
        listCommands: () => inventory.commands.slice(),
        registerHandler(id, handler) {
            assertActive();
            if (!commands.has(id)) throw providerError('MOBILE_COMMAND_NOT_FOUND', `Unknown Presentation command: ${id}`, { commandId: id });
            if (typeof handler !== 'function') throw new TypeError('Command handler must be a function');
            handlers.set(id, handler);
            return () => handlers.delete(id);
        },

        getSelectionSnapshot() {
            assertActive();
            return typeof getSelectionSnapshot === 'function'
                ? getSelectionSnapshot()
                : getDefaultSelection(requireApi());
        },

        subscribeState(sink) {
            assertActive();
            if (typeof sink !== 'function') throw new TypeError('Presentation adapter state sink must be a function');
            if (typeof subscribeState === 'function') {
                const detach = subscribeState(sink);
                if (typeof detach !== 'function') return () => {};
                const trackedDetach = () => {
                    detachSubscriptions.delete(trackedDetach);
                    detach();
                };
                detachSubscriptions.add(trackedDetach);
                return trackedDetach;
            }

            const api = requireApi();
            const callbacks = [
                ['asc_onDocumentOpenStateChanged', fact => sink({ type: 'document-open', ...fact })],
                ['asc_onTransportStateChanged', fact => sink({ type: 'transport', ...fact })],
                ['asc_onServerSaveStateChanged', fact => sink({ type: 'server-save', ...fact })],
            ];
            callbacks.forEach(([name, callback]) => api.asc_registerCallback(name, callback));
            const detach = () => {
                callbacks.forEach(([name, callback]) => api.asc_unregisterCallback(name, callback));
                detachSubscriptions.delete(detach);
            };
            detachSubscriptions.add(detach);
            return detach;
        },

        getCommandDescriptors() {
            assertActive();
            return descriptors;
        },

        execute,

        resolveContextMenu(context) {
            assertActive();
            return typeof resolveContextMenu === 'function'
                ? resolveContextMenu(context)
                : context?.commands ?? [];
        },

        captureViewState() {
            assertActive();
            return typeof captureViewState === 'function' ? captureViewState() : null;
        },

        restoreViewState(state) {
            assertActive();
            if (typeof restoreViewState === 'function') restoreViewState(state);
        },

        dispose() {
            if (disposed) return;
            disposed = true;
            Array.from(detachSubscriptions).forEach(detach => detach());
            handlers.clear();
        },
    });
};

const noop = () => null;

export const createEditorUIControllerFacade = provider => {
    const EditorUIController = () => null;
    EditorUIController.isSupportEditFeature = () => false;
    EditorUIController.getCommandProvider = () => provider;
    EditorUIController.initFocusObjects = noop;
    EditorUIController.initEditorStyles = noop;
    EditorUIController.initFonts = noop;
    EditorUIController.initTableTemplates = noop;
    EditorUIController.initThemeColors = noop;
    EditorUIController.updateChartStyles = noop;
    EditorUIController.getUndoRedo = noop;
    EditorUIController.getToolbarOptions = noop;
    EditorUIController.getEditCommentControllers = noop;
    EditorUIController.ContextMenu = {
        mapMenuItems: () => [],
        handleMenuItemClick: () => false,
    };
    return EditorUIController;
};
