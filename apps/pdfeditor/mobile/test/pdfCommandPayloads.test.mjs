/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {buildPdfCommandPayload, hasPdfCommandPayloadBuilder} from '../src/lib/pdfCommandPayloads.mjs';
import {resolvePdfCommandInput} from '../src/lib/pdfMobileUiModel.mjs';

class RecordedValue {
    constructor() {
        this.calls = [];
    }
}

const setter = name => function (value) {
    this.calls.push([name, value]);
};

class DownloadOptions extends RecordedValue {
    constructor(type) {
        super();
        this.type = type;
    }
}
DownloadOptions.prototype.asc_setIsSaveAs = setter('asc_setIsSaveAs');

class CoreProperties extends RecordedValue {
    copy() {
        return new CoreProperties();
    }
}
for (const name of ['asc_putTitle', 'asc_putSubject', 'asc_putCreator', 'asc_putKeywords', 'asc_putDescription']) {
    CoreProperties.prototype[name] = setter(name);
}

class ShapeProperties extends RecordedValue {}
ShapeProperties.prototype.asc_putColumnNumber = setter('asc_putColumnNumber');
ShapeProperties.prototype.asc_putRotAdd = setter('asc_putRotAdd');
ShapeProperties.prototype.asc_putFlipHInvert = setter('asc_putFlipHInvert');
ShapeProperties.prototype.asc_putFlipVInvert = setter('asc_putFlipVInvert');
ShapeProperties.prototype.put_TextArtProperties = setter('put_TextArtProperties');

class TextArtProperties extends RecordedValue {}
TextArtProperties.prototype.asc_putFill = setter('asc_putFill');
class ShapeFill extends RecordedValue {}
ShapeFill.prototype.put_type = setter('put_type');
ShapeFill.prototype.put_fill = setter('put_fill');
class FillSolid extends RecordedValue {}
FillSolid.prototype.put_color = setter('put_color');

class Color extends RecordedValue {}
for (const name of ['asc_putR', 'asc_putG', 'asc_putB', 'asc_putA']) Color.prototype[name] = setter(name);

class Stroke extends RecordedValue {}
for (const name of ['asc_putType', 'asc_putColor', 'asc_putWidth', 'asc_putTransparent', 'asc_putPrstDash']) {
    Stroke.prototype[name] = setter(name);
}

class DateTime extends RecordedValue {}
for (const name of ['put_Format', 'put_Update', 'put_Lang']) DateTime.prototype[name] = setter(name);

class TableProperties extends RecordedValue {}
TableProperties.prototype.put_RowHeight = setter('put_RowHeight');
TableProperties.prototype.put_ColumnWidth = setter('put_ColumnWidth');

class ImageProperties extends RecordedValue {}
ImageProperties.prototype.asc_putRotAdd = setter('asc_putRotAdd');
ImageProperties.prototype.asc_putFlipHInvert = setter('asc_putFlipHInvert');
ImageProperties.prototype.asc_putFlipVInvert = setter('asc_putFlipVInvert');

class ParagraphProperties extends RecordedValue {}
ParagraphProperties.prototype.asc_putTabs = setter('asc_putTabs');
class ParagraphTabs extends RecordedValue {
    asc_addTab(tab) {
        this.calls.push(['asc_addTab', tab]);
    }
}
class ParagraphTab {
    constructor(position, align, leader) {
        this.position = position;
        this.align = align;
        this.leader = leader;
    }
}

class ChartProperties extends RecordedValue {}
ChartProperties.prototype.changeType = setter('changeType');
ChartProperties.prototype.putStyle = setter('putStyle');
class ChartProp extends RecordedValue {
    constructor() {
        super();
        this.chartProperties = new ChartProperties();
    }
    get_ChartProperties() {
        return this.chartProperties;
    }
}
ChartProp.prototype.put_ChartProperties = setter('put_ChartProperties');

const Asc = {
    asc_CDownloadOptions: DownloadOptions,
    c_oAscFileType: {PDF: 513},
    asc_CShapeProperty: ShapeProperties,
    asc_TextArtProperties: TextArtProperties,
    asc_CShapeFill: ShapeFill,
    asc_CFillSolid: FillSolid,
    c_oAscFill: {FILL_TYPE_SOLID: 1},
    asc_CColor: Color,
    asc_CStroke: Stroke,
    c_oAscStrokeType: {STROKE_COLOR: 1},
    c_oDashType: {solid: 2},
    CAscDateTime: DateTime,
    CTableProp: TableProperties,
    asc_CImgProperty: ImageProperties,
    asc_CParagraphProperty: ParagraphProperties,
    asc_CParagraphTabs: ParagraphTabs,
    asc_CParagraphTab: ParagraphTab,
    CAscChartProp: ChartProp,
};

test('PDF Mobile builds typed download, core-property and column payloads', () => {
    const core = new CoreProperties();
    const api = {asc_getCoreProps: () => core};

    const download = buildPdfCommandPayload('pdf.file.download-pdf', {saveAs: true}, {Asc, api});
    assert.ok(download.options instanceof DownloadOptions);
    assert.equal(download.options.type, 513);
    assert.deepEqual(download.options.calls, [['asc_setIsSaveAs', true]]);

    const document = buildPdfCommandPayload('pdf.file.properties', {
        title: 'Roadmap', subject: 'Mobile', creator: 'JetOnlyOffice', keywords: 'pdf,mobile', description: 'Plan',
    }, {Asc, api});
    assert.ok(document.properties instanceof CoreProperties);
    assert.notEqual(document.properties, core);
    assert.deepEqual(document.properties.calls, [
        ['asc_putTitle', 'Roadmap'],
        ['asc_putSubject', 'Mobile'],
        ['asc_putCreator', 'JetOnlyOffice'],
        ['asc_putKeywords', 'pdf,mobile'],
        ['asc_putDescription', 'Plan'],
    ]);

    const columns = buildPdfCommandPayload('pdf.edit.columns', {count: 3}, {Asc, api});
    assert.ok(columns.properties instanceof ShapeProperties);
    assert.deepEqual(columns.properties.calls, [['asc_putColumnNumber', 3]]);
});

test('PDF Mobile builds typed annotation, date-time and object-property payloads', () => {
    const annotation = buildPdfCommandPayload('pdf.annotation.shape', {
        type: 9, color: '#2067c4', width: 2,
    }, {Asc, api: {}});
    assert.ok(annotation.properties instanceof Stroke);
    assert.equal(annotation.type, 9);
    assert.equal(annotation.start, true);
    assert.ok(annotation.properties.calls.find(call => call[0] === 'asc_putColor')[1] instanceof Color);

    const dateTime = buildPdfCommandPayload('pdf.insert.date-time', {
        format: 'yyyy-MM-dd', update: true, language: 1033,
    }, {Asc, api: {}});
    assert.ok(dateTime.properties instanceof DateTime);
    assert.deepEqual(dateTime.properties.calls, [
        ['put_Format', 'yyyy-MM-dd'], ['put_Update', true], ['put_Lang', 1033],
    ]);

    const table = buildPdfCommandPayload('pdf.table.apply-properties', {
        rowHeight: 8, columnWidth: 24,
    }, {Asc, api: {}});
    assert.ok(table.properties instanceof TableProperties);
    assert.deepEqual(table.properties.calls, [['put_RowHeight', 8], ['put_ColumnWidth', 24]]);

    const image = buildPdfCommandPayload('pdf.image.apply-properties', {
        rotation: 90, flipHorizontal: true, flipVertical: false,
    }, {Asc, api: {}});
    assert.ok(image.properties instanceof ImageProperties);
    assert.deepEqual(image.properties.calls, [
        ['asc_putRotAdd', Math.PI / 2], ['asc_putFlipHInvert', true], ['asc_putFlipVInvert', false],
    ]);

    const shape = buildPdfCommandPayload('pdf.shape.apply-properties', {
        rotation: -90, flipHorizontal: false, flipVertical: true,
    }, {Asc, api: {}});
    assert.ok(shape.properties instanceof ShapeProperties);
    assert.deepEqual(shape.properties.calls, [
        ['asc_putRotAdd', -Math.PI / 2], ['asc_putFlipHInvert', false], ['asc_putFlipVInvert', true],
    ]);
});

test('PDF Mobile builds typed paragraph tabs and fails closed without SDK types', () => {
    const payload = buildPdfCommandPayload('pdf.paragraph.tabs', {
        position: 12.5, align: 1, leader: 2,
    }, {Asc, api: {}});
    assert.ok(payload.properties instanceof ParagraphProperties);
    const tabs = payload.properties.calls[0][1];
    assert.ok(tabs instanceof ParagraphTabs);
    assert.ok(tabs.calls[0][1] instanceof ParagraphTab);
    assert.deepEqual(tabs.calls[0][1], new ParagraphTab(12.5, 1, 2));

    assert.throws(
        () => buildPdfCommandPayload('pdf.edit.columns', {count: 2}, {Asc: {}, api: {}}),
        error => error.code === 'MOBILE_PDF_SDK_TYPE_UNAVAILABLE' &&
            error.details.commandId === 'pdf.edit.columns',
    );
});

test('PDF Mobile builds TextArt properties with real nested Asc fill types', () => {
    const payload = buildPdfCommandPayload('pdf.textart.apply-properties', {
        color: '#125e4f', rotation: 0, flipHorizontal: false, flipVertical: false,
    }, {Asc, api: {}});
    assert.ok(payload.properties instanceof ShapeProperties);
    const textArtCall = payload.properties.calls.find(call => call[0] === 'put_TextArtProperties');
    assert.ok(textArtCall?.[1] instanceof TextArtProperties);
    const fillCall = textArtCall[1].calls.find(call => call[0] === 'asc_putFill');
    assert.ok(fillCall?.[1] instanceof ShapeFill);
    assert.deepEqual(fillCall[1].calls[0], ['put_type', 1]);
    assert.ok(fillCall[1].calls[1][1] instanceof FillSolid);
    assert.ok(fillCall[1].calls[1][1].calls[0][1] instanceof Color);
});

test('PDF Mobile applies chart settings to a selected real chart property object', () => {
    const selected = new ChartProp();
    const api = {getSelectedElements: () => [{get_ObjectValue: () => selected}]};
    const payload = buildPdfCommandPayload('pdf.chart.apply-properties', {
        type: 4, style: 12,
    }, {Asc, api});
    assert.equal(payload.properties, selected);
    assert.deepEqual(selected.calls, []);
    assert.deepEqual(selected.chartProperties.calls, [['changeType', 4], ['putStyle', 12]]);
});

test('PDF Mobile exposes structured controls for every typed property payload', () => {
    const commandIds = [
        'pdf.file.properties',
        'pdf.edit.columns',
        'pdf.annotation.shape',
        'pdf.insert.date-time',
        'pdf.table.apply-properties',
        'pdf.image.apply-properties',
        'pdf.shape.apply-properties',
        'pdf.paragraph.tabs',
    ];
    for (const commandId of commandIds) {
        const descriptor = resolvePdfCommandInput(commandId, true);
        assert.equal(descriptor.commandId, commandId);
        assert.ok(descriptor.fields.length > 0, commandId);
        assert.ok(descriptor.fields.every(field => field.name && field.label && field.type), commandId);
    }
    assert.deepEqual(resolvePdfCommandInput('pdf.edit.columns', false).fields, [{
        defaultValue: 1,
        label: 'Column count',
        max: 16,
        min: 1,
        name: 'count',
        required: true,
        step: 1,
        type: 'number',
    }]);
});

test('PDF Mobile has a payload path for every new declarative SDK binding except the locked SDK gap', async () => {
    const {readFile} = await import('node:fs/promises');
    const catalog = JSON.parse(await readFile(
        new URL('../src/commands/mobile-command-catalog.json', import.meta.url), 'utf8',
    ));
    for (const command of catalog.commands.filter(item => item.binding?.kind === 'sdk' && item.binding.arguments?.length)) {
        if (command.id === 'pdf.insert.header-footer') continue;
        assert.equal(hasPdfCommandPayloadBuilder(command.id), true, command.id);
        assert.ok(resolvePdfCommandInput(command.id, false)?.fields?.length, command.id);
    }
});
