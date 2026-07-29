/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const payloadError = (commandId, code, message, details = {}) => {
    const error = new Error(message);
    error.code = code;
    error.details = {commandId, ...details};
    return error;
};

const requireConstructor = (commandId, owner, name) => {
    const Constructor = owner?.[name];
    if (typeof Constructor !== 'function') {
        throw payloadError(
            commandId,
            'MOBILE_PDF_SDK_TYPE_UNAVAILABLE',
            `PDF SDK type is unavailable: ${name}`,
            {type: name},
        );
    }
    return Constructor;
};

const requireMethod = (commandId, value, method) => {
    if (typeof value?.[method] !== 'function') {
        throw payloadError(
            commandId,
            'MOBILE_PDF_SDK_TYPE_INVALID',
            `PDF SDK value does not implement ${method}`,
            {method},
        );
    }
    return value[method].bind(value);
};

const finiteNumber = (commandId, value, field, {min = -Infinity, max = Infinity} = {}) => {
    const number = typeof value === 'string' && value.trim() ? Number(value) : value;
    if (!Number.isFinite(number) || number < min || number > max) {
        throw payloadError(commandId, 'MOBILE_COMMAND_PAYLOAD_INVALID', `${field} is invalid`, {field, value});
    }
    return number;
};

const integer = (commandId, value, field, bounds) => {
    const number = finiteNumber(commandId, value, field, bounds);
    if (!Number.isInteger(number)) {
        throw payloadError(commandId, 'MOBILE_COMMAND_PAYLOAD_INVALID', `${field} must be an integer`, {field, value});
    }
    return number;
};

const boolean = (commandId, value, field) => {
    if (typeof value !== 'boolean') {
        throw payloadError(commandId, 'MOBILE_COMMAND_PAYLOAD_INVALID', `${field} must be a boolean`, {field, value});
    }
    return value;
};

const string = (commandId, value, field, {allowEmpty = true} = {}) => {
    if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
        throw payloadError(commandId, 'MOBILE_COMMAND_PAYLOAD_INVALID', `${field} must be text`, {field, value});
    }
    return value;
};

const set = (commandId, value, method, argument) => {
    requireMethod(commandId, value, method)(argument);
};

const createColor = (commandId, Asc, hex) => {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!match) {
        throw payloadError(commandId, 'MOBILE_COMMAND_PAYLOAD_INVALID', 'color must be a six-digit hex color', {
            field: 'color', value: hex,
        });
    }
    const rgb = Number.parseInt(match[1], 16);
    const Color = requireConstructor(commandId, Asc, 'asc_CColor');
    const color = new Color();
    set(commandId, color, 'asc_putR', (rgb >> 16) & 0xff);
    set(commandId, color, 'asc_putG', (rgb >> 8) & 0xff);
    set(commandId, color, 'asc_putB', rgb & 0xff);
    set(commandId, color, 'asc_putA', 255);
    return color;
};

const colorChannels = (commandId, hex) => {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!match) {
        throw payloadError(commandId, 'MOBILE_COMMAND_PAYLOAD_INVALID', 'color must be a six-digit hex color', {
            field: 'color', value: hex,
        });
    }
    const rgb = Number.parseInt(match[1], 16);
    return {r: (rgb >> 16) & 0xff, g: (rgb >> 8) & 0xff, b: rgb & 0xff};
};

const simple = (commandId, fields) => values => Object.fromEntries(fields.map(([name, convert]) => (
    [name, convert(commandId, values[name], name)]
)));

const asInteger = (bounds = {}) => (commandId, value, field) => integer(commandId, value, field, bounds);
const asNumber = (bounds = {}) => (commandId, value, field) => finiteNumber(commandId, value, field, bounds);
const asBoolean = () => (commandId, value, field) => boolean(commandId, value, field);
const asString = (options = {}) => (commandId, value, field) => string(commandId, value, field, options);

const buildDownload = (values, {Asc}) => {
    const commandId = 'pdf.file.download-pdf';
    const DownloadOptions = requireConstructor(commandId, Asc, 'asc_CDownloadOptions');
    if (Asc?.c_oAscFileType?.PDF === undefined) {
        throw payloadError(commandId, 'MOBILE_PDF_SDK_TYPE_UNAVAILABLE', 'PDF file type is unavailable', {
            type: 'c_oAscFileType.PDF',
        });
    }
    const options = new DownloadOptions(Asc.c_oAscFileType.PDF);
    set(commandId, options, 'asc_setIsSaveAs', boolean(commandId, values.saveAs, 'saveAs'));
    return {options};
};

const buildCoreProperties = (values, {api}) => {
    const commandId = 'pdf.file.properties';
    if (typeof api?.asc_getCoreProps !== 'function') {
        throw payloadError(commandId, 'MOBILE_COMMAND_BINDING_UNAVAILABLE', 'PDF core properties are unavailable');
    }
    const current = api.asc_getCoreProps();
    const properties = requireMethod(commandId, current, 'copy')();
    const fields = [
        ['title', 'asc_putTitle'],
        ['subject', 'asc_putSubject'],
        ['creator', 'asc_putCreator'],
        ['keywords', 'asc_putKeywords'],
        ['description', 'asc_putDescription'],
    ];
    for (const [field, method] of fields) {
        set(commandId, properties, method, string(commandId, values[field], field));
    }
    return {properties};
};

const buildColumns = (values, {Asc}) => {
    const commandId = 'pdf.edit.columns';
    const ShapeProperties = requireConstructor(commandId, Asc, 'asc_CShapeProperty');
    const properties = new ShapeProperties();
    set(commandId, properties, 'asc_putColumnNumber', integer(commandId, values.count, 'count', {min: 1, max: 16}));
    return {properties};
};

const buildFontColor = (values, {Asc}) => ({
    color: createColor('pdf.edit.font-color', Asc, values.color),
});

const buildAnnotationShape = (values, {Asc}) => {
    const commandId = 'pdf.annotation.shape';
    const Stroke = requireConstructor(commandId, Asc, 'asc_CStroke');
    const properties = new Stroke();
    if (Asc?.c_oAscStrokeType?.STROKE_COLOR === undefined || Asc?.c_oDashType?.solid === undefined) {
        throw payloadError(commandId, 'MOBILE_PDF_SDK_TYPE_UNAVAILABLE', 'PDF annotation stroke constants are unavailable');
    }
    set(commandId, properties, 'asc_putType', Asc.c_oAscStrokeType.STROKE_COLOR);
    set(commandId, properties, 'asc_putColor', createColor(commandId, Asc, values.color));
    set(commandId, properties, 'asc_putPrstDash', Asc.c_oDashType.solid);
    set(commandId, properties, 'asc_putWidth', finiteNumber(commandId, values.width, 'width', {min: 0.25, max: 50}));
    set(commandId, properties, 'asc_putTransparent', 255);
    return {
        type: integer(commandId, values.type, 'type', {min: 0}),
        properties,
        start: true,
    };
};

const buildDateTime = (values, {Asc}) => {
    const commandId = 'pdf.insert.date-time';
    const DateTime = requireConstructor(commandId, Asc, 'CAscDateTime');
    const properties = new DateTime();
    set(commandId, properties, 'put_Format', string(commandId, values.format, 'format', {allowEmpty: false}));
    set(commandId, properties, 'put_Update', boolean(commandId, values.update, 'update'));
    set(commandId, properties, 'put_Lang', integer(commandId, values.language, 'language', {min: 0}));
    return {properties};
};

const buildHyperlink = (values, {Asc}) => {
    const commandId = 'pdf.insert.hyperlink';
    const HyperlinkProperties = requireConstructor(commandId, Asc, 'CHyperlinkProperty');
    const properties = new HyperlinkProperties();
    set(commandId, properties, 'put_Value', string(commandId, values.url, 'url', {allowEmpty: false}));
    set(commandId, properties, 'put_Text', string(commandId, values.text, 'text'));
    set(commandId, properties, 'put_ToolTip', string(commandId, values.tooltip, 'tooltip'));
    return {properties};
};

const buildTableProperties = (values, {Asc}) => {
    const commandId = 'pdf.table.apply-properties';
    const TableProperties = requireConstructor(commandId, Asc, 'CTableProp');
    const properties = new TableProperties();
    set(commandId, properties, 'put_RowHeight', finiteNumber(commandId, values.rowHeight, 'rowHeight', {min: 0}));
    set(commandId, properties, 'put_ColumnWidth', finiteNumber(commandId, values.columnWidth, 'columnWidth', {min: 0}));
    return {properties};
};

const buildTransformProperties = (commandId, Constructor, values) => {
    const properties = new Constructor();
    const degrees = finiteNumber(commandId, values.rotation, 'rotation', {min: -360, max: 360});
    set(commandId, properties, 'asc_putRotAdd', degrees * Math.PI / 180);
    set(commandId, properties, 'asc_putFlipHInvert', boolean(commandId, values.flipHorizontal, 'flipHorizontal'));
    set(commandId, properties, 'asc_putFlipVInvert', boolean(commandId, values.flipVertical, 'flipVertical'));
    return {properties};
};

const buildImageProperties = (values, {Asc}) => buildTransformProperties(
    'pdf.image.apply-properties',
    requireConstructor('pdf.image.apply-properties', Asc, 'asc_CImgProperty'),
    values,
);

const buildShapeProperties = (values, {Asc}) => buildTransformProperties(
    'pdf.shape.apply-properties',
    requireConstructor('pdf.shape.apply-properties', Asc, 'asc_CShapeProperty'),
    values,
);

const buildTextArtProperties = (values, {Asc}) => {
    const commandId = 'pdf.textart.apply-properties';
    const payload = buildTransformProperties(
        commandId,
        requireConstructor(commandId, Asc, 'asc_CShapeProperty'),
        values,
    );
    const TextArtProperties = requireConstructor(commandId, Asc, 'asc_TextArtProperties');
    const ShapeFill = requireConstructor(commandId, Asc, 'asc_CShapeFill');
    const FillSolid = requireConstructor(commandId, Asc, 'asc_CFillSolid');
    if (Asc?.c_oAscFill?.FILL_TYPE_SOLID === undefined) {
        throw payloadError(commandId, 'MOBILE_PDF_SDK_TYPE_UNAVAILABLE', 'Solid fill constant is unavailable');
    }
    const textArt = new TextArtProperties();
    const fill = new ShapeFill();
    const solid = new FillSolid();
    set(commandId, solid, 'put_color', createColor(commandId, Asc, values.color));
    set(commandId, fill, 'put_type', Asc.c_oAscFill.FILL_TYPE_SOLID);
    set(commandId, fill, 'put_fill', solid);
    set(commandId, textArt, 'asc_putFill', fill);
    set(commandId, payload.properties, 'put_TextArtProperties', textArt);
    return payload;
};

const buildChartProperties = (values, {Asc, api}) => {
    const commandId = 'pdf.chart.apply-properties';
    const selected = typeof api?.getSelectedElements === 'function'
        ? api.getSelectedElements().map(item => item?.get_ObjectValue?.()).find(value => (
            value && typeof value.get_ChartProperties === 'function'
        ))
        : null;
    const properties = selected || null;
    if (!properties) {
        throw payloadError(commandId, 'MOBILE_PDF_SELECTION_REQUIRED', 'Select a chart before applying chart properties');
    }
    const chartProperties = properties.get_ChartProperties();
    if (!chartProperties) {
        throw payloadError(commandId, 'MOBILE_PDF_SELECTION_REQUIRED', 'Selected chart has no chart properties');
    }
    if (values.type !== undefined) set(commandId, chartProperties, 'changeType', integer(commandId, values.type, 'type', {min: 0}));
    if (values.style !== undefined) set(commandId, chartProperties, 'putStyle', integer(commandId, values.style, 'style', {min: 0}));
    return {properties};
};

const buildParagraphTabs = (values, {Asc}) => {
    const commandId = 'pdf.paragraph.tabs';
    const ParagraphProperties = requireConstructor(commandId, Asc, 'asc_CParagraphProperty');
    const ParagraphTabs = requireConstructor(commandId, Asc, 'asc_CParagraphTabs');
    const ParagraphTab = requireConstructor(commandId, Asc, 'asc_CParagraphTab');
    const properties = new ParagraphProperties();
    const tabs = new ParagraphTabs();
    const tab = new ParagraphTab(
        finiteNumber(commandId, values.position, 'position', {min: 0}),
        integer(commandId, values.align, 'align', {min: 0}),
        integer(commandId, values.leader, 'leader', {min: 0}),
    );
    requireMethod(commandId, tabs, 'asc_addTab')(tab);
    set(commandId, properties, 'asc_putTabs', tabs);
    return {properties};
};

const buildFieldColor = commandId => values => colorChannels(commandId, values.color);

const buildListOption = values => {
    const commandId = 'pdf.forms.list-add';
    const option = string(commandId, values.option, 'option', {allowEmpty: false});
    return {
        options: [option],
        index: integer(commandId, values.index, 'index', {min: 0}),
    };
};

const buildAnnotationStyle = values => colorChannels('pdf.annotation.style', values.color);

const BUILDERS = Object.freeze({
    'pdf.file.download-pdf': buildDownload,
    'pdf.file.properties': buildCoreProperties,
    'pdf.edit.font-color': buildFontColor,
    'pdf.edit.line-spacing': simple('pdf.edit.line-spacing', [
        ['type', asInteger({min: 0})], ['value', asNumber({min: 0})],
    ]),
    'pdf.edit.columns': buildColumns,
    'pdf.edit.bullets': simple('pdf.edit.bullets', [
        ['type', asInteger({min: 0})], ['subtype', asInteger({min: -1})],
    ]),
    'pdf.edit.numbering': simple('pdf.edit.numbering', [
        ['type', asInteger({min: 0})], ['subtype', asInteger({min: -1})],
    ]),
    'pdf.edit.vertical-align': simple('pdf.edit.vertical-align', [['value', asInteger({min: 0})]]),
    'pdf.annotation.free-text': simple('pdf.annotation.free-text', [['type', asInteger({min: 0})]]),
    'pdf.annotation.shape': buildAnnotationShape,
    'pdf.annotation.stamp': simple('pdf.annotation.stamp', [['type', asInteger({min: 0})]]),
    'pdf.annotation.style': buildAnnotationStyle,
    'pdf.object.align': simple('pdf.object.align', [
        ['align', asInteger({min: 0})], ['selectedOnly', asBoolean()],
    ]),
    'pdf.object.merge': simple('pdf.object.merge', [['operation', asInteger({min: 0})]]),
    'pdf.insert.hyperlink': buildHyperlink,
    'pdf.insert.chart': simple('pdf.insert.chart', [['type', asInteger({min: 0})]]),
    'pdf.insert.equation': simple('pdf.insert.equation', [['type', asInteger({min: 0})]]),
    'pdf.insert.smartart': simple('pdf.insert.smartart', [['type', asInteger({min: 0})]]),
    'pdf.insert.symbol': simple('pdf.insert.symbol', [
        ['font', asString({allowEmpty: false})], ['code', asInteger({min: 0})],
    ]),
    'pdf.insert.date-time': buildDateTime,
    'pdf.table.split-cells': simple('pdf.table.split-cells', [
        ['columns', asInteger({min: 1})], ['rows', asInteger({min: 1})],
    ]),
    'pdf.table.apply-properties': buildTableProperties,
    'pdf.forms.background-color': buildFieldColor('pdf.forms.background-color'),
    'pdf.forms.border-color': buildFieldColor('pdf.forms.border-color'),
    'pdf.forms.list-add': buildListOption,
    'pdf.forms.list-delete': simple('pdf.forms.list-delete', [['index', asInteger({min: 0})]]),
    'pdf.forms.list-move': simple('pdf.forms.list-move', [
        ['index', asInteger({min: 0})], ['up', asBoolean()],
    ]),
    'pdf.forms.lock': simple('pdf.forms.lock', [['locked', asBoolean()]]),
    'pdf.forms.clear-button-image': simple('pdf.forms.clear-button-image', [['state', asInteger({min: 0})]]),
    'pdf.image.apply-properties': buildImageProperties,
    'pdf.shape.apply-properties': buildShapeProperties,
    'pdf.shape.change-type': simple('pdf.shape.change-type', [['type', asString({allowEmpty: false})]]),
    'pdf.shape.select-image': simple('pdf.shape.select-image', [['fillType', asInteger({min: 0})]]),
    'pdf.textart.select-image': simple('pdf.textart.select-image', [['fillType', asInteger({min: 0})]]),
    'pdf.textart.apply-properties': buildTextArtProperties,
    'pdf.chart.apply-properties': buildChartProperties,
    'pdf.paragraph.tabs': buildParagraphTabs,
    'pdf.view.dark-document': simple('pdf.view.dark-document', [['enabled', asBoolean()]]),
    'pdf.view.thumbnail-size': simple('pdf.view.thumbnail-size', [['value', asNumber({min: 0.1, max: 10})]]),
});

export function buildPdfCommandPayload(commandId, values = {}, environment = {}) {
    const builder = BUILDERS[commandId];
    if (!builder) {
        throw payloadError(commandId, 'MOBILE_PDF_PAYLOAD_BUILDER_UNAVAILABLE', 'PDF command payload builder is unavailable');
    }
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
        throw payloadError(commandId, 'MOBILE_COMMAND_PAYLOAD_INVALID', 'PDF command values must be an object');
    }
    return builder(values, environment);
}

export function hasPdfCommandPayloadBuilder(commandId) {
    return Object.hasOwn(BUILDERS, commandId);
}
