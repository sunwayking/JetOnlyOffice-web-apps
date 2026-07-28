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

import {
    getWordCommandSpecByDescriptorId,
    WORD_COMMAND_IDS,
    WORD_COMMAND_SPECS
} from './wordCommandCatalog.mjs';

const commandDescriptors = Object.freeze(WORD_COMMAND_SPECS.map(spec => Object.freeze({
        id: spec.id,
        ...(spec.permissions.length === 1
            ? {permission: spec.permissions[0]}
            : {permissionsAny: spec.permissions}),
        contexts: spec.contexts,
        mobilePath: spec.mobilePath,
        mutates: spec.mutates
    })));

const alignmentValues = Object.freeze({
    right: 0,
    left: 1,
    center: 2,
    justify: 3,
    just: 3
});

function adapterError(code, message, details) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

function requireApi(getApi) {
    const api = getApi();
    if (!api) {
        throw adapterError('MOBILE_EDITOR_API_UNAVAILABLE', 'Word editor API is not available');
    }
    return api;
}

function normalizeAlignment(value) {
    if (Number.isInteger(value) && value >= 0 && value <= 3) {
        return value;
    }
    if (Object.prototype.hasOwnProperty.call(alignmentValues, value)) {
        return alignmentValues[value];
    }
    throw adapterError(
        'MOBILE_COMMAND_PAYLOAD_INVALID',
        `Unsupported paragraph alignment: ${value}`,
        {value}
    );
}

function payloadArguments(payload) {
    if (payload === undefined) {
        return [];
    }
    if (payload === null) {
        return [null];
    }
    if (Array.isArray(payload)) {
        return payload;
    }
    if (Array.isArray(payload.args)) {
        return payload.args;
    }
    return Object.prototype.hasOwnProperty.call(payload, 'value') ? [payload.value] : [payload];
}

export function createWordCommandAdapter({getApi, captureViewState, restoreViewState} = {}) {
    if (typeof getApi !== 'function') {
        throw new TypeError('createWordCommandAdapter requires getApi');
    }

    const detachCallbacks = new Set();
    let disposed = false;

    function assertActive() {
        if (disposed) {
            throw adapterError('MOBILE_ADAPTER_DISPOSED', 'Word command adapter has been disposed');
        }
    }

    function execute(commandId, payload) {
        assertActive();
        const api = requireApi(getApi);

        const spec = getWordCommandSpecByDescriptorId(commandId);
        if (!spec) {
            throw adapterError(
                'MOBILE_COMMAND_NOT_FOUND',
                `Unknown Word command: ${commandId}`,
                {commandId}
            );
        }

        const method = spec.binding.method;
        if (typeof api[method] !== 'function') {
            throw adapterError(
                'MOBILE_COMMAND_BINDING_UNAVAILABLE',
                `Word command binding is unavailable: ${commandId}`,
                {commandId, method}
            );
        }

        if (spec.id === WORD_COMMAND_IDS.PARAGRAPH_ALIGN && !Array.isArray(payload?.args)) {
            return api[method](normalizeAlignment(payload.value));
        }
        if (spec.id === WORD_COMMAND_IDS.TABLE_INSERT && !Array.isArray(payload?.args)) {
            return api[method](payload.columns, payload.rows, String(payload.style ?? 'default'));
        }
        if (spec.id === WORD_COMMAND_IDS.COMMENT_ADD && !Array.isArray(payload?.args)) {
            return api[method](payload.comment);
        }
        return api[method](...payloadArguments(payload));
    }

    return {
        getSelectionSnapshot() {
            assertActive();
            const api = requireApi(getApi);
            return api.getSelectedElements();
        },

        subscribeState(sink) {
            assertActive();
            if (typeof sink !== 'function') {
                throw new TypeError('Word adapter state sink must be a function');
            }
            const api = requireApi(getApi);
            const callbacks = [
                ['asc_onDocumentOpenStateChanged', fact => sink({type: 'document-open', ...fact})],
                ['asc_onTransportStateChanged', fact => sink({type: 'transport', ...fact})],
                ['asc_onServerSaveStateChanged', fact => sink({type: 'server-save', ...fact})]
            ];
            callbacks.forEach(([name, callback]) => api.asc_registerCallback(name, callback));

            const detach = () => {
                callbacks.forEach(([name, callback]) => api.asc_unregisterCallback(name, callback));
                detachCallbacks.delete(detach);
            };
            detachCallbacks.add(detach);
            return detach;
        },

        getCommandDescriptors() {
            return commandDescriptors;
        },

        execute,

        resolveContextMenu(context) {
            assertActive();
            return context?.commands ?? [];
        },

        captureViewState() {
            assertActive();
            return typeof captureViewState === 'function' ? captureViewState() : null;
        },

        restoreViewState(state) {
            assertActive();
            if (typeof restoreViewState === 'function') {
                restoreViewState(state);
            }
        },

        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            Array.from(detachCallbacks).forEach(detach => detach());
        }
    };
}

export {commandDescriptors as wordCommandDescriptors};
export {WORD_COMMAND_IDS};
