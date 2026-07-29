/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const editOnly = Object.freeze(['edit']);
const commentOnly = Object.freeze(['comment']);
const mutableProfiles = Object.freeze(['edit', 'review', 'comment', 'fillForms']);
const allProfiles = Object.freeze(['view', 'edit', 'review', 'comment', 'fillForms']);

const methodSlug = method => method
    .replace(/^asc_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

const sdkCommand = ({
    method,
    id = `presentation.sdk.${methodSlug(method)}`,
    permissions = editOnly,
    contexts = ['presentation'],
    mobilePath = 'more.command-search',
    mutates = true,
}) => Object.freeze({
    id,
    contexts: Object.freeze(contexts),
    permissions,
    implementation: 'implemented',
    binding: Object.freeze({kind: 'sdk', method}),
    mobilePath,
    mutates,
    testIds: Object.freeze([`pe-binding-${methodSlug(method)}`]),
});

const sdkDefinitions = [
    {id: 'presentation.clipboard.copy', method: 'Copy', permissions: allProfiles, contexts: ['slide', 'object', 'text'], mobilePath: 'context.copy', mutates: false},
    {id: 'presentation.clipboard.cut', method: 'Cut', contexts: ['slide', 'object', 'text'], mobilePath: 'context.cut'},
    {id: 'presentation.clipboard.paste', method: 'Paste', contexts: ['slide', 'object', 'text'], mobilePath: 'context.paste'},
    {id: 'presentation.history.redo', method: 'Redo', permissions: mutableProfiles, mobilePath: 'toolbar.redo'},
    {id: 'presentation.history.undo', method: 'Undo', permissions: mutableProfiles, mobilePath: 'toolbar.undo'},
    {id: 'presentation.text.bold', method: 'put_TextPrBold', contexts: ['text'], mobilePath: 'edit.text.bold'},
    {id: 'presentation.text.italic', method: 'put_TextPrItalic', contexts: ['text'], mobilePath: 'edit.text.italic'},
    {id: 'presentation.desktop.add-slide', method: 'AddSlide', contexts: ['slide'], mobilePath: 'add.add-slide'},
    {id: 'presentation.desktop.change-case', method: 'asc_ChangeTextCase', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.clearstyle', method: 'ClearFormating'},
    {id: 'presentation.desktop.colorschemas', method: 'asc_ChangeColorSchemeByIdx', mobilePath: 'settings.layout'},
    {id: 'presentation.desktop.copystyle', method: 'SetPaintFormat'},
    {id: 'presentation.desktop.datetime', method: 'asc_addDateTime'},
    {id: 'presentation.desktop.decfont', method: 'FontSizeOut', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.fontcolor', method: 'put_TextColor', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.highlight', method: 'SetMarkerFormat', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.incfont', method: 'FontSizeIn', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.insaudio', method: 'asc_AddAudioUrl', mobilePath: 'add.insaudio'},
    {id: 'presentation.desktop.insert-equation', method: 'asc_AddMath', mobilePath: 'add.insert-equation'},
    {id: 'presentation.desktop.insert-table', method: 'put_Table', mobilePath: 'add.insert-table'},
    {id: 'presentation.desktop.insert-textart', method: 'AddTextArt', mobilePath: 'add.insert-textart'},
    {id: 'presentation.desktop.insertlink', method: 'add_Hyperlink', mobilePath: 'add.insertlink'},
    {id: 'presentation.desktop.insertshape', method: 'AddShapeOnCurrentPage', contexts: ['object'], mobilePath: 'add.insertshape'},
    {id: 'presentation.desktop.insertequation', method: 'asc_AddMath2', mobilePath: 'add.insertequation'},
    {id: 'presentation.desktop.inserttable', method: 'put_Table', mobilePath: 'add.inserttable'},
    {id: 'presentation.desktop.inserttextart', method: 'AddTextArt', mobilePath: 'add.inserttextart'},
    {id: 'presentation.desktop.insvideo', method: 'asc_AddVideoUrl', mobilePath: 'add.insvideo'},
    {id: 'presentation.desktop.merge-shapes', method: 'asc_mergeSelectedShapesAction', contexts: ['object'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.numbers', method: 'put_ListType', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.object-align', method: 'put_ShapesAlign', contexts: ['object'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.preview', method: 'StartDemonstrationFromCurrentSlide', permissions: allProfiles, mutates: false},
    {id: 'presentation.desktop.preview-slide', method: 'StartDemonstrationFromCurrentSlide', permissions: allProfiles, contexts: ['slide'], mutates: false},
    {id: 'presentation.desktop.print', method: 'asc_Print', permissions: allProfiles, mutates: false},
    {id: 'presentation.desktop.save', method: 'asc_Save', permissions: mutableProfiles},
    {id: 'presentation.desktop.select-all', method: 'asc_EditSelectAll', permissions: allProfiles, mutates: false},
    {id: 'presentation.desktop.slide-size', method: 'changeSlideSize', contexts: ['slide'], mobilePath: 'settings.layout'},
    {id: 'presentation.desktop.slidenum', method: 'asc_addSlideNumber', contexts: ['slide']},
    {id: 'presentation.desktop.strikeout', method: 'put_TextPrStrikeout', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.subscript', method: 'put_TextPrBaseline', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.superscript', method: 'put_TextPrBaseline', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.theme-colors', method: 'asc_ChangeColorSchemeByIdx', mobilePath: 'settings.layout'},
    {id: 'presentation.desktop.underline', method: 'put_TextPrUnderline', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.view-gridlines', method: 'asc_setShowGridlines', contexts: ['slide'], mutates: false},
    {id: 'presentation.desktop.view-guides', method: 'asc_setShowGuides', contexts: ['slide'], mutates: false},
    {id: 'presentation.insert.chart', method: 'asc_addChartDrawingObject', contexts: ['object'], mobilePath: 'add.insertchart'},
    {method: 'AddImageUrl'},
    {method: 'AddShapeOnCurrentPage'},
    {method: 'ChangeImageFromFile', contexts: ['image']},
    {method: 'ChangeLayout', contexts: ['slide']},
    {method: 'ChangeShapeType', contexts: ['shape']},
    {method: 'ChangeTheme', contexts: ['slide']},
    {method: 'ChartApply', contexts: ['chart']},
    {method: 'DecreaseIndent', contexts: ['text']},
    {method: 'DeleteSlide', contexts: ['slide']},
    {method: 'DistributeHorizontally', contexts: ['object']},
    {method: 'DistributeVertically', contexts: ['object']},
    {method: 'DublicateSlide', contexts: ['slide']},
    {method: 'ImgApply', contexts: ['image']},
    {method: 'IncreaseIndent', contexts: ['text']},
    {method: 'SetSlideProps', contexts: ['slide']},
    {method: 'ShapeApply', contexts: ['shape', 'chart']},
    {method: 'SlideTransitionApplyToAll', contexts: ['slide']},
    {method: 'SplitCell', contexts: ['table']},
    {method: 'addColumnLeft', contexts: ['table']},
    {method: 'addColumnRight', contexts: ['table']},
    {method: 'addRowAbove', contexts: ['table']},
    {method: 'addRowBelow', contexts: ['table']},
    {method: 'asc_Remove', contexts: ['slide', 'text', 'object']},
    {method: 'asc_addComment', permissions: commentOnly, contexts: ['slide', 'text']},
    {method: 'asc_addImage'},
    {method: 'asc_DistributeTableCells', contexts: ['table']},
    {method: 'asc_editChartInFrameEditor', contexts: ['chart']},
    {method: 'asc_replaceText', contexts: ['text']},
    {method: 'asc_setRtlTextDirection', contexts: ['text']},
    {method: 'asc_undoAllChanges', permissions: mutableProfiles},
    {method: 'change_Hyperlink', contexts: ['hyperlink']},
    {method: 'paraApply', contexts: ['text']},
    {method: 'put_LineSpacingBeforeAfter', contexts: ['text']},
    {method: 'put_PrAlign', contexts: ['text']},
    {method: 'put_PrLineSpacing', contexts: ['text']},
    {method: 'put_TextPrFontName', contexts: ['text']},
    {method: 'put_TextPrFontSize', contexts: ['text']},
    {method: 'remColumn', contexts: ['table']},
    {method: 'remRow', contexts: ['table']},
    {method: 'remTable', contexts: ['table']},
    {method: 'remove_Hyperlink', contexts: ['hyperlink']},
    {method: 'shapes_bringBackward', contexts: ['object']},
    {method: 'shapes_bringForward', contexts: ['object']},
    {method: 'shapes_bringToBack', contexts: ['object']},
    {method: 'shapes_bringToFront', contexts: ['object']},
    {method: 'setVerticalAlign', contexts: ['text']},
    {method: 'tblApply', contexts: ['table']},
];

const definedSpecs = Object.freeze(sdkDefinitions.map(sdkCommand));
const commandById = new Map(definedSpecs.map(spec => [spec.id, spec]));
const commandByMethod = new Map();
for (const spec of definedSpecs) {
    if (!commandByMethod.has(spec.binding.method)) commandByMethod.set(spec.binding.method, spec);
}

export const PRESENTATION_COMMAND_SPECS = definedSpecs;

export function getPresentationCommandSpecByMethod(method) {
    return commandByMethod.get(method) ?? null;
}

export function createPresentationCommandInventory(auditedInventory) {
    if (!auditedInventory || !Array.isArray(auditedInventory.commands)) {
        throw new TypeError('createPresentationCommandInventory requires an audited inventory');
    }

    const desktopCommands = auditedInventory.commands.map(command => {
        const sdkSpec = commandById.get(command.id);
        if (sdkSpec) {
            return Object.freeze({
                ...command,
                contexts: sdkSpec.contexts,
                permissions: sdkSpec.permissions,
                implementation: 'implemented',
                binding: sdkSpec.binding,
                mobilePath: sdkSpec.mobilePath,
                mutates: sdkSpec.mutates,
                testIds: Object.freeze(command.testIds.slice()),
            });
        }
        return Object.freeze({
            ...command,
            binding: null,
            testIds: Object.freeze(command.testIds.slice()),
        });
    });
    const desktopIds = new Set(desktopCommands.map(command => command.id));
    const sdkOnlyCommands = definedSpecs.filter(command => !desktopIds.has(command.id));
    const resolvedCommands = [...desktopCommands, ...sdkOnlyCommands];
    const resolvedById = new Map(resolvedCommands.map(command => [command.id, command]));
    const entries = auditedInventory.entries.map(entry => {
        const command = resolvedById.get(entry.commandId);
        if (!command) return Object.freeze({...entry});
        return Object.freeze({
            ...entry,
            contexts: command.contexts,
            permissions: command.permissions,
            mobilePath: command.mobilePath,
        });
    });

    return Object.freeze({
        ...auditedInventory,
        entries: Object.freeze(entries),
        commands: Object.freeze(resolvedCommands),
    });
}
