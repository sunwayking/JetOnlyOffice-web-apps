/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const PDF_TASK_SPACE_IDS = Object.freeze([
    'edit',
    'insert',
    'comment',
    'pages',
    'forms',
    'signatures',
]);

const CALLBACK_FACTORIES = Object.freeze({
    asc_onDocumentOpenStateChanged: fact => ({ type: 'document-open', ...fact }),
    asc_onTransportStateChanged: fact => ({ type: 'transport', ...fact }),
    asc_onServerSaveStateChanged: fact => ({ type: 'server-save', ...fact }),
    asc_onZoomChange: (zoom, mode) => ({type: 'view-state', zoom, mode}),
    asc_onSignatureFieldClick: (signature, width, height) => ({
        type: 'signature-field',
        signature,
        width,
        height,
    }),
    asc_onUpdateSignatures: certificates => ({
        type: 'certificate-signature-state',
        certificates,
    }),
    asc_onUpdateSignatureFields: (fields, requested) => ({
        type: 'signature-field-state',
        fields,
        requested,
    }),
});

const CAPABILITY_METHODS = Object.freeze({
    'pdf.redaction.apply': Object.freeze(['HasRedact', 'ApplyRedact']),
    'pdf.redaction.current-page': Object.freeze(['getCurrentPage']),
    'pdf.redaction.search-all': Object.freeze([
        'asc_findText',
        'asc_RedactAllSearchElements',
    ]),
});

const providerError = (code, message, details) => {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
};

const payloadError = (commandId, message, payload) => providerError(
    'MOBILE_COMMAND_PAYLOAD_INVALID',
    `${commandId}: ${message}`,
    { commandId, payload },
);

const requireObject = (commandId, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw payloadError(commandId, 'an object payload is required', payload);
    }
    return payload;
};

const requireInteger = (commandId, value, label) => {
    if (!Number.isInteger(value)) {
        throw payloadError(commandId, `${label} must be an integer`, value);
    }
    return value;
};

const requireZoom = value => {
    if (!Number.isFinite(value) || value < 25 || value > 500) {
        throw payloadError('pdf.view.zoom', 'value must be between 25 and 500 percent', value);
    }
    return value;
};

const requirePages = (commandId, pages) => {
    if (!Array.isArray(pages) || pages.length === 0 || pages.some(page => !Number.isInteger(page) || page < 0)) {
        throw payloadError(commandId, 'pages must be a non-empty array of zero-based page indexes', pages);
    }
    return pages;
};

const resolvePages = (api, commandId, payload = {}) => {
    if (payload.pages !== undefined) return requirePages(commandId, payload.pages);
    if (typeof api.getSelectedPages === 'function') {
        const selected = api.getSelectedPages();
        if (Array.isArray(selected) && selected.length) return requirePages(commandId, selected);
    }
    if (typeof api.getCurrentPage === 'function') {
        return requirePages(commandId, [api.getCurrentPage()]);
    }
    throw payloadError(commandId, 'pages are required when the SDK exposes no current page', payload);
};

const commandExecutors = Object.freeze({
    'pdf.edit.undo': api => api.Undo(),
    'pdf.edit.redo': api => api.Redo(),
    'pdf.redaction.mark': (api, payload = {}) => api.SetRedactTool(payload.value !== false),
    'pdf.redaction.selection': api => api.AddRedactBySelect(),
    'pdf.redaction.current-page': api => api.RedactPages(requirePages(
        'pdf.redaction.current-page',
        [api.getCurrentPage()],
    )),
    'pdf.redaction.apply': (api, payload) => {
        if (payload?.confirmed !== true) {
            throw providerError(
                'MOBILE_REDACTION_CONFIRMATION_REQUIRED',
                'Permanent redaction requires explicit confirmation',
            );
        }
        if (api.HasRedact() !== true) {
            throw providerError(
                'MOBILE_REDACTION_MARKS_UNAVAILABLE',
                'The PDF SDK reports no unapplied redaction marks',
            );
        }
        const result = api.ApplyRedact();
        if (api.HasRedact() === true) {
            throw providerError(
                'MOBILE_REDACTION_APPLY_UNCONFIRMED',
                'The PDF SDK did not confirm that redaction marks were applied',
            );
        }
        return result;
    },
    'pdf.redaction.pages': (api, payload = {}) => api.RedactPages(resolvePages(api, 'pdf.redaction.pages', payload)),
    'pdf.redaction.search-all': (api, payload, context) => context.executeSearchRedaction(api, payload),
    'pdf.redaction.discard': api => api.RemoveAllRedact(),
    'pdf.insert.image': (api, payload = {}) => api.asc_addImage(payload.options),
    'pdf.insert.image-url': (api, payload) => {
        const urls = requireObject('pdf.insert.image-url', payload).urls;
        if (!Array.isArray(urls) || urls.length === 0 || urls.some(url => typeof url !== 'string' || !url.trim())) {
            throw payloadError('pdf.insert.image-url', 'urls must be a non-empty string array', urls);
        }
        return api.AddImageUrl(urls);
    },
    'pdf.insert.shape': (api, payload) => {
        const value = requireObject('pdf.insert.shape', payload);
        if (typeof value.type !== 'string' || !value.type) {
            throw payloadError('pdf.insert.shape', 'type is required', payload);
        }
        return api.StartAddShape(value.type, value.start !== false);
    },
    'pdf.insert.text-art': (api, payload) => api.AddTextArt(requireInteger(
        'pdf.insert.text-art',
        requireObject('pdf.insert.text-art', payload).style,
        'style',
    )),
    'pdf.insert.table': (api, payload) => {
        const value = requireObject('pdf.insert.table', payload);
        return api.put_Table(
            requireInteger('pdf.insert.table', value.columns, 'columns'),
            requireInteger('pdf.insert.table', value.rows, 'rows'),
            value.placeholder,
            value.styleId,
        );
    },
    'pdf.comment.add': (api, payload) => {
        const comment = requireObject('pdf.comment.add', payload).comment;
        if (!comment) throw payloadError('pdf.comment.add', 'comment is required', payload);
        return api.asc_addComment(comment);
    },
    'pdf.annotation.marker': (api, payload) => {
        const value = requireObject('pdf.annotation.marker', payload);
        return api.SetMarkerFormat(value.type, value.enabled !== false, value.opacity, value.r, value.g, value.b);
    },
    'pdf.annotation.ink-start': (api, payload) => {
        const pen = requireObject('pdf.annotation.ink-start', payload).pen;
        if (!pen) throw payloadError('pdf.annotation.ink-start', 'pen is required', payload);
        return api.asc_StartDrawInk(pen);
    },
    'pdf.annotation.ink-stop': api => api.asc_StopInkDrawer(),
    'pdf.pages.add': (api, payload = {}) => {
        const index = payload.index === undefined && typeof api.getCurrentPage === 'function'
            ? api.getCurrentPage() + 1
            : requireInteger('pdf.pages.add', payload.index, 'index');
        return api.asc_AddPage(index);
    },
    'pdf.pages.remove': (api, payload = {}) => api.asc_RemovePage(resolvePages(api, 'pdf.pages.remove', payload)),
    'pdf.pages.rotate': (api, payload) => {
        const value = requireObject('pdf.pages.rotate', payload);
        if (![90, 180, 270, -90, -180, -270].includes(value.angle)) {
            throw payloadError('pdf.pages.rotate', 'angle must be a quarter-turn', value.angle);
        }
        return api.asc_RotatePage(value.angle, resolvePages(api, 'pdf.pages.rotate', value));
    },
    'pdf.forms.text': (api, payload = {}) => api.AddTextField(payload.params || {}),
    'pdf.forms.date': api => api.AddDateField(),
    'pdf.forms.image': api => api.AddImageField(),
    'pdf.forms.checkbox': api => api.AddCheckboxField(),
    'pdf.forms.radio': api => api.AddRadiobuttonField(),
    'pdf.forms.combo': api => api.AddComboboxField(),
    'pdf.forms.dropdown': api => api.AddListboxField(),
    'pdf.forms.clear': api => api.asc_ClearAllSpecialForms(),
    'pdf.forms.signature': (api, payload = {}) => api.AddSignatureField(payload.params || {}),
    'pdf.signatures.apply-appearance': (api, payload) => {
        const appearance = requireObject('pdf.signatures.apply-appearance', payload).appearance;
        if (api.asc_SetSignatureFieldAppearance(appearance) !== true) {
            throw providerError(
                'MOBILE_SIGNATURE_APPEARANCE_NOT_PERSISTED',
                'The PDF SDK could not prove that the signature appearance is persistent',
            );
        }
        return true;
    },
    'pdf.signatures.certificates': api => api.asc_getSignatures(),
    'pdf.signatures.fields': api => api.asc_getSignatureFields(),
    'pdf.signatures.requested': api => api.asc_getRequestSignatures(),
    'pdf.view.fit-page': api => api.zoomFitToPage(),
    'pdf.view.fit-width': api => api.zoomFitToWidth(),
    'pdf.view.zoom': (api, payload) => api.zoom(requireZoom(
        requireObject('pdf.view.zoom', payload).value,
    )),
});

const validateCatalogBindings = commands => {
    for (const command of commands.values()) {
        if (!commandExecutors[command.id]) {
            throw providerError('MOBILE_COMMAND_DESCRIPTOR_INVALID', `PDF command has no executor: ${command.id}`, {
                commandId: command.id,
            });
        }
        if (!command.binding?.method) {
            throw providerError('MOBILE_COMMAND_DESCRIPTOR_INVALID', `PDF command has no SDK binding: ${command.id}`, {
                commandId: command.id,
            });
        }
    }
};

export function createPdfCommandProvider({
    catalog,
    getApi,
    getSelectionSnapshot,
    resolveContextMenu,
    captureViewState,
    restoreViewState,
} = {}) {
    if (!catalog || !Array.isArray(catalog.commands)) {
        throw new TypeError('createPdfCommandProvider requires a command catalog');
    }
    if (typeof getApi !== 'function') {
        throw new TypeError('createPdfCommandProvider requires getApi');
    }

    const commands = new Map(catalog.commands.map(command => [command.id, command]));
    validateCatalogBindings(commands);
    const descriptors = Object.freeze(catalog.commands.map(command => Object.freeze({
        id: command.id,
        permission: command.permission,
        mutates: command.mutates !== false && command.permission !== 'view',
        contexts: Object.freeze([command.taskSpace]),
        mobilePath: `pdf/${command.taskSpace}`,
    })));
    const detachCallbacks = new Set();
    let latestZoom = null;
    let pendingRedactionSearch = null;
    let disposed = false;

    const assertActive = () => {
        if (disposed) {
            throw providerError('MOBILE_ADAPTER_DISPOSED', 'PDF command provider has been disposed');
        }
    };
    const requireApi = () => {
        const api = getApi();
        if (!api) {
            throw providerError('MOBILE_EDITOR_API_UNAVAILABLE', 'PDF editor API is not available');
        }
        return api;
    };
    const executeSearchRedaction = (api, payload) => {
        const settings = requireObject(
            'pdf.redaction.search-all',
            requireObject('pdf.redaction.search-all', payload).settings,
        );
        if (pendingRedactionSearch) {
            throw providerError(
                'MOBILE_COMMAND_BUSY',
                'A PDF redaction search is already in progress',
                {commandId: 'pdf.redaction.search-all'},
            );
        }

        const task = {};
        task.promise = new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                detachCallbacks.delete(cancel);
                if (pendingRedactionSearch === task) pendingRedactionSearch = null;
            };
            const cancel = () => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(providerError('MOBILE_ADAPTER_DISPOSED', 'PDF command provider has been disposed'));
            };
            const onSearchComplete = count => {
                if (settled) return;
                settled = true;
                cleanup();
                if (!Number.isSafeInteger(count) || count < 0) {
                    reject(providerError(
                        'MOBILE_PDF_SEARCH_RESULT_INVALID',
                        'PDF search did not report a valid completion count',
                        {count},
                    ));
                    return;
                }
                try {
                    if (count > 0) api.asc_RedactAllSearchElements();
                    resolve(count);
                } catch (error) {
                    reject(error);
                }
            };

            pendingRedactionSearch = task;
            detachCallbacks.add(cancel);
            try {
                api.asc_findText(settings, true, onSearchComplete);
            } catch (error) {
                settled = true;
                cleanup();
                reject(error);
            }
        });
        return task.promise;
    };

    return Object.freeze({
        editor: 'pdf',
        getCommandDescriptors() {
            assertActive();
            return descriptors;
        },
        getSelectionSnapshot() {
            assertActive();
            if (typeof getSelectionSnapshot === 'function') return getSelectionSnapshot();
            const api = requireApi();
            return typeof api.getSelectedElements === 'function' ? api.getSelectedElements() : [];
        },
        subscribeState(sink) {
            assertActive();
            if (typeof sink !== 'function') throw new TypeError('PDF adapter state sink must be a function');
            const api = requireApi();
            const callbacks = Object.entries(CALLBACK_FACTORIES).map(([name, factory]) => {
                const callback = (...args) => {
                    if (name === 'asc_onZoomChange' && Number.isFinite(args[0])) latestZoom = args[0];
                    let event = factory(...args);
                    if (name === 'asc_onUpdateSignatureFields' && event.requested === undefined &&
                        typeof api.asc_getRequestSignatures === 'function') {
                        event = {...event, requested: api.asc_getRequestSignatures()};
                    }
                    sink(event);
                };
                api.asc_registerCallback(name, callback);
                return [name, callback];
            });
            const detach = () => {
                callbacks.forEach(([name, callback]) => api.asc_unregisterCallback(name, callback));
                detachCallbacks.delete(detach);
            };
            detachCallbacks.add(detach);
            return detach;
        },
        execute(commandId, payload) {
            assertActive();
            const command = commands.get(commandId);
            if (!command) {
                throw providerError('MOBILE_COMMAND_NOT_FOUND', `Unknown PDF command: ${commandId}`, { commandId });
            }
            const api = requireApi();
            const method = command.binding?.method;
            const missingMethods = [method, ...(CAPABILITY_METHODS[commandId] || [])]
                .filter((name, index, methods) => name && methods.indexOf(name) === index)
                .filter(name => typeof api[name] !== 'function');
            if (!method || missingMethods.length) {
                throw providerError('MOBILE_COMMAND_BINDING_UNAVAILABLE', `PDF command binding is unavailable: ${commandId}`, {
                    commandId,
                    method,
                    missingMethods,
                });
            }
            return commandExecutors[commandId](api, payload, {executeSearchRedaction});
        },
        resolveCapability(commandId) {
            assertActive();
            const command = commands.get(commandId);
            if (!command) return null;
            const api = requireApi();
            const methods = [command.binding?.method, ...(CAPABILITY_METHODS[commandId] || [])]
                .filter((name, index, values) => name && values.indexOf(name) === index);
            const missingMethods = methods.filter(name => typeof api[name] !== 'function');
            return missingMethods.length
                ? {available: false, reason: 'sdk-binding-unavailable', missingMethods}
                : {available: true};
        },
        resolveContextMenu(context) {
            assertActive();
            const resolved = typeof resolveContextMenu === 'function'
                ? resolveContextMenu(context)
                : context?.commands ?? [];
            if (!Array.isArray(resolved)) return [];
            return resolved.filter((commandId, index, values) => (
                typeof commandId === 'string' && commands.has(commandId) && values.indexOf(commandId) === index
            ));
        },
        captureViewState() {
            assertActive();
            if (typeof captureViewState === 'function') return captureViewState();
            const api = requireApi();
            const page = typeof api.getCurrentPage === 'function' ? api.getCurrentPage() : null;
            const scroll = typeof api.getCurScroll === 'function' ? api.getCurScroll() : null;
            return {
                ...(Number.isInteger(page) ? {page} : {}),
                ...(scroll && Number.isFinite(scroll.x) && Number.isFinite(scroll.y) ? {
                    scroll: {x: scroll.x, y: scroll.y},
                } : {}),
                ...(Number.isFinite(latestZoom) ? {zoom: latestZoom} : {}),
            };
        },
        restoreViewState(state) {
            assertActive();
            if (typeof restoreViewState === 'function') {
                restoreViewState(state);
                return;
            }
            if (!state || typeof state !== 'object') return;
            const api = requireApi();
            if (Number.isInteger(state.page) && typeof api.goToPage === 'function') api.goToPage(state.page);
            if (Number.isFinite(state.zoom) && typeof api.zoom === 'function') api.zoom(state.zoom);
            if (Number.isFinite(state.scroll?.x) && Number.isFinite(state.scroll?.y) &&
                typeof api.scrollToXY === 'function') {
                api.scrollToXY(state.scroll.x, state.scroll.y);
            }
        },
        dispose() {
            if (disposed) return;
            Array.from(detachCallbacks).forEach(detach => detach());
            disposed = true;
        },
    });
}

export default createPdfCommandProvider;
