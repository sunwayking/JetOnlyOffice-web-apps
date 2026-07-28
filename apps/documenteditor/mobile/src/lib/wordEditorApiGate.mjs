/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
    getWordCommandSpecByMethod
} from './wordCommandCatalog.mjs';
import {
    executeWordCommand
} from './wordEditorRuntime.mjs';

export function createWordEditorApiGate({getRawApi} = {}) {
    if (typeof getRawApi !== 'function') {
        throw new TypeError('createWordEditorApiGate requires getRawApi');
    }

    let cachedApi = null;
    let cachedProxy = null;

    return function getEditorApi() {
        const api = getRawApi();
        if (!api || api === cachedApi) {
            return api ? cachedProxy : api;
        }

        const methodCache = new Map();
        cachedApi = api;
        cachedProxy = new Proxy(api, {
            get(target, property, receiver) {
                const value = Reflect.get(target, property, receiver);
                if (typeof value !== 'function') {
                    return value;
                }
                if (methodCache.has(property)) {
                    return methodCache.get(property);
                }

                const spec = getWordCommandSpecByMethod(String(property));
                const method = spec
                    ? (...args) => executeWordCommand(spec.id, {args})
                    : value.bind(target);
                methodCache.set(property, method);
                return method;
            }
        });
        return cachedProxy;
    };
}

export default createWordEditorApiGate;
