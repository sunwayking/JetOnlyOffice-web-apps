/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const workflowError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const readRecommendedSettings = value => value?.asc_getRecommendedSettings?.() || value;

export function createSpreadsheetImportWorkflow({
    executeCommand,
    createTextOptions = () => new Asc.asc_CTextOptions(0, 4, ''),
    getActiveWorksheetName = () => null,
    getDefaultXmlDestination = () => '',
    getWorksheetNames = () => [],
    validateXmlDestination = () => true,
    commandId = 'spreadsheet.desktop.import-data',
} = {}) {
    if (typeof executeCommand !== 'function') {
        throw new TypeError('createSpreadsheetImportWorkflow requires executeCommand');
    }

    const subscribers = new Set();
    let state = {
        phase: 'idle',
        source: null,
        options: null,
        data: null,
        fileContent: null,
        error: null,
    };

    const publish = next => {
        state = Object.freeze({...state, ...next});
        subscribers.forEach(subscriber => subscriber(state));
        return state;
    };
    const safely = (action, next) => {
        try {
            action();
            return publish(next);
        } catch (error) {
            publish({phase: 'error', error});
            throw error;
        }
    };
    const begin = (next, action) => {
        publish(next);
        try {
            action();
            return state;
        } catch (error) {
            publish({phase: 'error', error});
            throw error;
        }
    };

    const previewFile = advancedOptions => {
        const options = readRecommendedSettings(advancedOptions) || state.options || createTextOptions();
        return publish({
            phase: 'text-preview',
            options,
            data: advancedOptions?.asc_getData?.() || null,
            codePages: advancedOptions?.asc_getCodePages?.() || [],
        });
    };

    const previewText = data => publish({
        phase: 'text-preview',
        options: state.options || createTextOptions(),
        data: data || null,
    });
    const previewXml = fileContent => fileContent
        ? publish({phase: 'xml-preview', source: 'xml', fileContent})
        : publish({phase: 'idle', source: null, fileContent: null});

    return Object.freeze({
        getState: () => state,
        getDefaultXmlDestination() {
            return String(getDefaultXmlDestination() || '').trim();
        },
        subscribe(subscriber) {
            if (typeof subscriber !== 'function') throw new TypeError('Import workflow subscriber must be a function');
            subscribers.add(subscriber);
            subscriber(state);
            return () => subscribers.delete(subscriber);
        },
        startFile() {
            const options = createTextOptions();
            return begin(
                {phase: 'file-picker', source: 'file', options, data: null, error: null},
                () => executeCommand(commandId, {args: [options, previewFile]}),
            );
        },
        startUrl(url) {
            const value = String(url || '').trim();
            if (!value) throw workflowError('MOBILE_IMPORT_URL_REQUIRED', 'A URL is required to import spreadsheet data');
            const options = createTextOptions();
            return begin(
                {phase: 'url-loading', source: 'url', options, data: null, error: null},
                () => executeCommand(commandId, {args: [options, previewFile, value]}),
            );
        },
        startTextToColumns() {
            const options = createTextOptions();
            const codePage = options?.asc_getCodePage?.();
            return begin(
                {phase: 'text-loading', source: 'text-to-columns', options, data: null, error: null},
                () => executeCommand(commandId, {
                    operation: 'preview-text',
                    args: [codePage, previewText, false],
                }),
            );
        },
        startXml() {
            return begin(
                {phase: 'xml-loading', source: 'xml', fileContent: null, error: null},
                () => executeCommand(commandId, {
                    operation: 'xml-start',
                    args: [previewXml],
                }),
            );
        },
        applyTextPreview({textOptions, data, range} = {}) {
            const options = textOptions || state.options || createTextOptions();
            const args = state.source === 'text-to-columns'
                ? [options]
                : [options, data === undefined ? state.data : data, range];
            return safely(
                () => executeCommand(commandId, {operation: 'text-to-columns', args}),
                {phase: 'idle', source: null, data: null, error: null},
            );
        },
        applyXml({mode = 'existing', destination, sheetName} = {}) {
            if (state.phase !== 'xml-preview' || state.fileContent === null || state.fileContent === undefined) {
                throw workflowError('MOBILE_IMPORT_XML_PREVIEW_REQUIRED', 'XML data must be loaded before it can be imported');
            }
            if (!['existing', 'new'].includes(mode)) {
                throw workflowError('MOBILE_IMPORT_XML_MODE_INVALID', `Unsupported XML import destination mode: ${mode}`);
            }
            const importToNewWorksheet = mode === 'new';
            const normalizedDestination = importToNewWorksheet ? null : String(destination || '').trim();
            if (!importToNewWorksheet && !normalizedDestination) {
                throw workflowError('MOBILE_IMPORT_XML_DESTINATION_REQUIRED', 'A destination range is required');
            }
            if (!importToNewWorksheet && validateXmlDestination(normalizedDestination) !== true) {
                throw workflowError('MOBILE_IMPORT_XML_DESTINATION_INVALID', 'The destination range is invalid');
            }
            const names = new Set((getWorksheetNames() || []).map(name => String(name).toLocaleLowerCase()));
            let generatedSheetName = sheetName || 'Sheet1';
            for (let index = 1; names.has(generatedSheetName.toLocaleLowerCase()) && index < 1000; index += 1) {
                generatedSheetName = `Sheet${index + 1}`;
            }
            return safely(
                () => executeCommand(commandId, {
                    operation: 'xml-end',
                    args: [
                        state.fileContent,
                        normalizedDestination,
                        importToNewWorksheet ? generatedSheetName : getActiveWorksheetName(),
                    ],
                }),
                {phase: 'idle', source: null, fileContent: null, error: null},
            );
        },
    });
}
