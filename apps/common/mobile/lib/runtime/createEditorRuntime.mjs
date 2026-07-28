/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const initialSession = Object.freeze({
    open: Object.freeze({phase: 'idle'}),
    transport: Object.freeze({state: 'idle'}),
    save: Object.freeze({state: 'idle'})
});

let activeEditorRuntime = null;

function runtimeError(code, message, details) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

function copyFact(event, excludedKeys) {
    return Object.keys(event).reduce((fact, key) => {
        if (!excludedKeys.includes(key)) {
            fact[key] = event[key];
        }
        return fact;
    }, {});
}

function reduceSession(session, event) {
    if (!event || typeof event !== 'object') {
        return session;
    }

    switch (event.type) {
        case 'document-open':
            return {...session, open: copyFact(event, ['type'])};
        case 'transport':
            return {...session, transport: copyFact(event, ['type'])};
        case 'server-save':
            return {...session, save: copyFact(event, ['type'])};
        default:
            return session;
    }
}

function validateAdapter(adapter) {
    const methods = [
        'getSelectionSnapshot',
        'subscribeState',
        'getCommandDescriptors',
        'execute',
        'resolveContextMenu',
        'captureViewState',
        'restoreViewState'
    ];
    const missing = methods.filter(method => typeof adapter?.[method] !== 'function');
    if (missing.length) {
        throw runtimeError(
            'MOBILE_ADAPTER_INVALID',
            `Editor adapter is missing: ${missing.join(', ')}`,
            {missing}
        );
    }
}

function isAllowed(descriptor, permissions) {
    if (!descriptor.permission || descriptor.permission === 'view') {
        return true;
    }
    return permissions[descriptor.permission] === true;
}

function getMutationFreezeReason(descriptor, session) {
    if (descriptor.mutates === false) {
        return null;
    }
    if (session.save.state === 'blocking-failed') {
        return 'blocking-save-failure';
    }
    if (session.open.phase !== 'ready') {
        return `open-${session.open.phase}`;
    }
    if (session.transport.state !== 'connected') {
        return `transport-${session.transport.state}`;
    }
    return null;
}

/**
 * Creates the shared Mobile session and command boundary around an editor adapter.
 * The adapter remains the sole owner of editor-specific SDK calls and selection data.
 */
export function createEditorRuntime({adapter, permissions = {}}) {
    validateAdapter(adapter);

    const subscribers = new Set();
    const descriptors = new Map();
    let disposed = false;
    let session = initialSession;

    adapter.getCommandDescriptors().forEach(descriptor => {
        if (!descriptor || typeof descriptor.id !== 'string' || descriptors.has(descriptor.id)) {
            throw runtimeError(
                'MOBILE_COMMAND_DESCRIPTOR_INVALID',
                'Every command descriptor must have a unique string id',
                {descriptor}
            );
        }
        descriptors.set(descriptor.id, Object.freeze({...descriptor}));
    });

    const detachAdapter = adapter.subscribeState(event => {
        if (disposed) {
            return;
        }
        const nextSession = reduceSession(session, event);
        if (nextSession === session) {
            return;
        }
        session = Object.freeze(nextSession);
        subscribers.forEach(subscriber => subscriber(session, event));
    });

    function assertActive() {
        if (disposed) {
            throw runtimeError('MOBILE_RUNTIME_DISPOSED', 'Editor Runtime has been disposed');
        }
    }

    function resolve(commandId) {
        assertActive();
        const descriptor = descriptors.get(commandId);
        if (!descriptor) {
            return null;
        }
        const permissionAllowed = isAllowed(descriptor, permissions);
        const freezeReason = permissionAllowed ? getMutationFreezeReason(descriptor, session) : null;
        const available = permissionAllowed && !freezeReason;
        return {
            ...descriptor,
            available,
            ...(available ? {} : permissionAllowed
                ? {reason: 'session-frozen', freezeReason}
                : {reason: 'permission-denied'})
        };
    }

    return Object.freeze({
        execute(commandId, payload) {
            assertActive();
            const resolved = resolve(commandId);
            if (!resolved) {
                throw runtimeError(
                    'MOBILE_COMMAND_NOT_FOUND',
                    `Unknown Mobile command: ${commandId}`,
                    {commandId}
                );
            }
            if (!resolved.available) {
                if (resolved.reason === 'session-frozen') {
                    throw runtimeError(
                        'MOBILE_COMMAND_SESSION_FROZEN',
                        `Mobile command is frozen by the editing session: ${commandId}`,
                        {commandId, freezeReason: resolved.freezeReason}
                    );
                }
                throw runtimeError(
                    'MOBILE_COMMAND_PERMISSION_DENIED',
                    `Mobile command is not allowed: ${commandId}`,
                    {commandId, permission: resolved.permission}
                );
            }
            return adapter.execute(commandId, payload);
        },

        resolve,

        getSelection() {
            assertActive();
            return adapter.getSelectionSnapshot();
        },

        getSession() {
            assertActive();
            return session;
        },

        subscribe(subscriber) {
            assertActive();
            if (typeof subscriber !== 'function') {
                throw new TypeError('Runtime subscriber must be a function');
            }
            subscribers.add(subscriber);
            subscriber(session, {type: 'runtime-initialized'});
            return () => subscribers.delete(subscriber);
        },

        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            subscribers.clear();
            if (typeof detachAdapter === 'function') {
                detachAdapter();
            }
            if (typeof adapter.dispose === 'function') {
                adapter.dispose();
            }
        }
    });
}

export function setActiveEditorRuntime(runtime) {
    activeEditorRuntime = runtime ?? null;
}

export function getActiveEditorRuntime() {
    return activeEditorRuntime;
}

export default createEditorRuntime;
