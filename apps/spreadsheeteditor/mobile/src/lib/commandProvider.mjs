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
    if (Object.prototype.hasOwnProperty.call(payload, 'value')) return [payload.value];
    const { operation, target, commitTarget, ...argument } = payload;
    return Object.keys(argument).length ? [argument] : [];
};
const providerError = (code, message, details) => {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
};

const getDefaultSelection = api => api.asc_getCellInfo();

const createCommandDescriptor = command => {
    const descriptor = {
        id: command.id,
        contexts: Object.freeze(command.contexts.slice()),
        mobilePath: command.mobilePath,
        mutates: command.mutates !== false,
    };

    if (command.permissions.includes('view')) {
        descriptor.permission = 'view';
    } else if (command.permissions.length > 1) {
        descriptor.permissionsAny = Object.freeze(command.permissions.slice());
    } else {
        descriptor.permission = command.permissions[0];
    }

    if (command.aliasOf) descriptor.aliasOf = command.aliasOf;

    return Object.freeze(descriptor);
};

export const createSpreadsheetCommandProvider = ({
    inventory,
    getApi,
    getSelectionSnapshot,
    subscribeState,
    resolveContextMenu,
    captureViewState,
    restoreViewState,
    navigateCommand,
    executeHostCommand,
} = {}) => {
    if (!inventory || !Array.isArray(inventory.commands)) {
        throw new TypeError('createSpreadsheetCommandProvider requires an inventory');
    }
    if (typeof getApi !== 'function') {
        throw new TypeError('createSpreadsheetCommandProvider requires getApi');
    }

    const commands = new Map(inventory.commands.map(command => [command.id, command]));
    const handlers = new Map();
    const descriptors = Object.freeze(inventory.commands
        .filter(command => command.implementation === 'implemented')
        .map(createCommandDescriptor)
        .concat(Object.freeze({
            id: COMMON_COMMAND_IDS.ADD_COMMENT,
            permission: 'comment',
            mutates: true,
        })));
    const detachSubscriptions = new Set();
    let disposed = false;

    const assertActive = () => {
        if (disposed) {
            throw providerError('MOBILE_ADAPTER_DISPOSED', 'Spreadsheet command provider has been disposed');
        }
    };

    const requireApi = () => {
        const api = getApi();
        if (!api) {
            throw providerError('MOBILE_EDITOR_API_UNAVAILABLE', 'Spreadsheet editor API is not available');
        }
        return api;
    };

    const getCommand = id => commands.get(id) || null;

    const resolveReceiver = (name, api, payload) => {
        if (name === 'api') return api;
        if (name === 'commitTarget') return payload?.commitTarget;
        return payload?.target;
    };

    const resolveBindingCommand = command => {
        const visited = new Set();
        let resolved = command;

        while (resolved?.aliasOf) {
            if (visited.has(resolved.id)) {
                throw providerError('MOBILE_COMMAND_ALIAS_CYCLE', `Spreadsheet command alias cycle: ${command.id}`, {
                    commandId: command.id,
                });
            }
            visited.add(resolved.id);
            resolved = getCommand(resolved.aliasOf);
            if (!resolved) {
                throw providerError('MOBILE_COMMAND_ALIAS_TARGET_NOT_FOUND', `Spreadsheet command alias target is unavailable: ${command.id}`, {
                    commandId: command.id,
                    aliasOf: command.aliasOf,
                });
            }
        }

        return resolved;
    };

    const execute = (id, payload) => {
        assertActive();
        if (id === COMMON_COMMAND_IDS.ADD_COMMENT) {
            return requireApi().asc_addComment(payload?.comment);
        }
        const command = getCommand(id);
        if (!command) {
            throw providerError('MOBILE_COMMAND_NOT_FOUND', `Unknown Spreadsheet command: ${id}`, { commandId: id });
        }
        if (command.implementation !== 'implemented') {
            throw providerError('MOBILE_COMMAND_NOT_IMPLEMENTED', `Spreadsheet command is not implemented: ${id}`, { commandId: id });
        }

        const customHandler = handlers.get(id);
        if (customHandler) return customHandler(payload);

        const bindingCommand = resolveBindingCommand(command);
        if (bindingCommand.implementation !== 'implemented') {
            throw providerError('MOBILE_COMMAND_NOT_IMPLEMENTED', `Spreadsheet command alias target is not implemented: ${id}`, {
                commandId: id,
                aliasOf: command.aliasOf,
            });
        }

        const binding = bindingCommand.binding;
        const operation = payload && !Array.isArray(payload) ? payload.operation : undefined;
        const method = operation === undefined
            ? binding && binding.method
            : binding && binding.operations && binding.operations[operation];
        if (operation !== undefined && !method) {
            throw providerError('MOBILE_COMMAND_OPERATION_NOT_SUPPORTED', `Spreadsheet command operation is not supported: ${id}`, {
                commandId: id,
                bindingCommandId: bindingCommand.id,
                operation,
            });
        }

        if (binding?.kind === 'navigation') {
            if (operation !== undefined) {
                throw providerError('MOBILE_COMMAND_OPERATION_NOT_SUPPORTED', `Spreadsheet navigation command operation is not supported: ${id}`, {
                    commandId: id,
                    bindingCommandId: bindingCommand.id,
                    operation,
                });
            }
            const intent = Object.freeze({
                type: 'navigate',
                commandId: id,
                target: binding.target,
            });
            return typeof navigateCommand === 'function' ? navigateCommand(intent, payload) : intent;
        }

        if (binding?.kind === 'host') {
            if (operation !== undefined) {
                throw providerError('MOBILE_COMMAND_OPERATION_NOT_SUPPORTED', `Spreadsheet host command operation is not supported: ${id}`, {
                    commandId: id,
                    bindingCommandId: bindingCommand.id,
                    operation,
                });
            }
            const intent = Object.freeze({
                type: 'host-command',
                commandId: id,
                action: binding.action,
            });
            return typeof executeHostCommand === 'function' ? executeHostCommand(intent, payload) : intent;
        }

        const api = requireApi();
        const receiverName = binding?.kind === 'sdk-object'
            ? binding.operationReceivers?.[operation] || binding.receiver || 'target'
            : 'api';
        const receiver = resolveReceiver(receiverName, api, payload);
        if (!receiver) {
            throw providerError('MOBILE_COMMAND_TARGET_UNAVAILABLE', `Spreadsheet command target is unavailable: ${id}`, {
                commandId: id,
                bindingCommandId: bindingCommand.id,
            });
        }
        if (!method || typeof receiver[method] !== 'function') {
            throw providerError('MOBILE_COMMAND_BINDING_UNAVAILABLE', `Spreadsheet command binding is unavailable: ${id}`, {
                commandId: id,
                bindingCommandId: bindingCommand.id,
                method,
            });
        }
        const passApi = operation === undefined
            ? binding.passApi === true
            : binding.operationPassApi?.[operation] === true;
        const args = payloadArguments(payload);
        const result = receiver[method](...(passApi ? [api, ...args] : args));

        if (binding.commit) {
            const commitReceiver = resolveReceiver(binding.commit.receiver, api, payload);
            if (!commitReceiver || typeof commitReceiver[binding.commit.method] !== 'function') {
                throw providerError('MOBILE_COMMAND_COMMIT_UNAVAILABLE', `Spreadsheet command commit binding is unavailable: ${id}`, {
                    commandId: id,
                    bindingCommandId: bindingCommand.id,
                    method: binding.commit.method,
                });
            }
            const commitArgs = binding.commit.args.map(argument => {
                if (argument === 'api') return api;
                if (argument === 'target') return payload?.target;
                if (argument === 'result') return result;
                return argument;
            });
            commitReceiver[binding.commit.method](...commitArgs);
        }

        return result;
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
            if (!commands.has(id)) throw providerError('MOBILE_COMMAND_NOT_FOUND', `Unknown Spreadsheet command: ${id}`, { commandId: id });
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
            if (typeof sink !== 'function') throw new TypeError('Spreadsheet adapter state sink must be a function');
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
