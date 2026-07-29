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

const defaultMobilePath = contexts => {
    for (const context of ['chart', 'image', 'table', 'shape', 'hyperlink', 'text', 'object', 'slide']) {
        if (contexts.includes(context)) return `edit.${context}`;
    }
    return 'more.command-search';
};

const sdkCommand = ({
    method,
    id = `presentation.sdk.${methodSlug(method)}`,
    permissions = editOnly,
    contexts = ['presentation'],
    formats = ['pptx', 'odp'],
    mobilePath,
    mutates = true,
}) => Object.freeze({
    id,
    contexts: Object.freeze(contexts),
    permissions,
    implementation: 'implemented',
    binding: Object.freeze({kind: 'sdk', method}),
    formats: Object.freeze(formats),
    mobilePath: mobilePath ?? defaultMobilePath(contexts),
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
    {id: 'presentation.desktop.clearstyle', method: 'ClearFormating', contexts: ['text'], mobilePath: 'edit.text'},
    {id: 'presentation.desktop.colorschemas', method: 'asc_ChangeColorSchemeByIdx', mobilePath: 'settings.layout'},
    {id: 'presentation.desktop.copystyle', method: 'SetPaintFormat', contexts: ['text', 'object'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.datetime', method: 'asc_addDateTime', mobilePath: 'add.datetime'},
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
    {id: 'presentation.desktop.merge-shapes', method: 'asc_mergeSelectedShapes', contexts: ['object'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.numbers', method: 'put_ListType', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.object-align', method: 'put_ShapesAlign', contexts: ['object'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.preview', method: 'StartDemonstrationFromCurrentSlide', permissions: allProfiles, mobilePath: 'toolbar.preview', mutates: false},
    {id: 'presentation.desktop.preview-slide', method: 'StartDemonstrationFromCurrentSlide', permissions: allProfiles, contexts: ['slide'], mobilePath: 'toolbar.preview', mutates: false},
    {id: 'presentation.desktop.print', method: 'asc_Print', permissions: allProfiles, mobilePath: 'settings.print', mutates: false},
    {id: 'presentation.desktop.save', method: 'asc_Save', permissions: mutableProfiles, mobilePath: 'settings.save'},
    {id: 'presentation.desktop.select-all', method: 'asc_EditSelectAll', permissions: allProfiles, mobilePath: 'context.select-all', mutates: false},
    {id: 'presentation.desktop.slide-size', method: 'changeSlideSize', contexts: ['slide'], mobilePath: 'settings.layout'},
    {id: 'presentation.desktop.slidenum', method: 'asc_addSlideNumber', contexts: ['slide'], mobilePath: 'add.slide-number'},
    {id: 'presentation.desktop.strikeout', method: 'put_TextPrStrikeout', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.subscript', method: 'put_TextPrBaseline', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.superscript', method: 'put_TextPrBaseline', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.theme-colors', method: 'asc_ChangeColorSchemeByIdx', mobilePath: 'settings.layout'},
    {id: 'presentation.desktop.underline', method: 'put_TextPrUnderline', contexts: ['text'], mobilePath: 'edit.format'},
    {id: 'presentation.desktop.view-gridlines', method: 'asc_setShowGridlines', contexts: ['slide'], mobilePath: 'settings.view', mutates: false},
    {id: 'presentation.desktop.view-guides', method: 'asc_setShowGuides', contexts: ['slide'], mobilePath: 'settings.view', mutates: false},
    {id: 'presentation.insert.chart', method: 'asc_addChartDrawingObject', contexts: ['object'], mobilePath: 'add.insertchart'},
    {id: 'presentation.desktop.add-animation', method: 'asc_AddAnimation', contexts: ['object'], mobilePath: 'edit.object'},
    {id: 'presentation.desktop.editheader', method: 'asc_setHeaderFooterProperties', contexts: ['slide'], mobilePath: 'edit.slide'},
    {id: 'presentation.desktop.id-toolbar-btn-add-layout', method: 'asc_AddSlideLayout', contexts: ['slide'], mobilePath: 'edit.slide'},
    {id: 'presentation.desktop.id-toolbar-btn-add-slide-master', method: 'asc_AddMasterSlide', contexts: ['slide'], mobilePath: 'edit.slide'},
    {id: 'presentation.desktop.insert-placeholder', method: 'asc_StartAddPlaceholder', contexts: ['slide'], mobilePath: 'add.placeholder'},
    {id: 'presentation.desktop.insert-smartart', method: 'asc_createSmartArt', contexts: ['object'], mobilePath: 'add.smartart'},
    {id: 'presentation.desktop.insert-symbol', method: 'asc_insertSymbol', contexts: ['text'], mobilePath: 'add.symbol'},
    {id: 'presentation.desktop.save-desktop', method: 'asc_DownloadAs', permissions: allProfiles, mobilePath: 'settings.download', mutates: false},
    {id: 'presentation.desktop.slidemaster', method: 'asc_changePresentationViewMode', contexts: ['slide'], mobilePath: 'edit.slide', mutates: false},
    {method: 'AddImageUrl', mobilePath: 'add.image'},
    {method: 'AddShapeOnCurrentPage', mobilePath: 'add.shape'},
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
    {method: 'asc_Remove', contexts: ['slide', 'text', 'object'], mobilePath: 'context.delete'},
    {method: 'asc_addComment', permissions: commentOnly, contexts: ['slide', 'text'], mobilePath: 'context.comment'},
    {method: 'asc_addImage', mobilePath: 'add.image'},
    {method: 'asc_DistributeTableCells', contexts: ['table']},
    {method: 'asc_editChartInFrameEditor', contexts: ['chart']},
    {method: 'asc_replaceText', contexts: ['text']},
    {method: 'asc_setRtlTextDirection', contexts: ['text']},
    {method: 'asc_undoAllChanges', permissions: mutableProfiles, mobilePath: 'settings.discard'},
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

const alias = (id, commandId, mobilePath, options = {}) => Object.freeze({
    id,
    binding: Object.freeze({kind: 'alias', commandId}),
    mobilePath,
    ...options,
});

const controller = (id, mobilePath, action = 'navigate', options = {}) => {
    const {binding = {}, ...commandOptions} = options;
    return Object.freeze({
        id,
        binding: Object.freeze({kind: 'controller', action, ...binding}),
        mobilePath,
        mutates: false,
        ...commandOptions,
    });
};

const excluded = (id, reason) => Object.freeze({
    id,
    implementation: 'excluded',
    binding: null,
    mobilePath: 'excluded.external-connector',
    mutates: false,
    exclusion: Object.freeze({adr: 'ADR-0040', reason}),
});

const desktopClosureDefinitions = Object.freeze([
    controller('presentation.desktop.about', 'settings.about'),
    controller('presentation.desktop.advancedsearch', 'toolbar.search', 'search'),
    alias('presentation.desktop.align-horizontal', 'presentation.sdk.put-pr-align', 'edit.text'),
    alias('presentation.desktop.align-vertical', 'presentation.sdk.set-vertical-align', 'edit.text'),
    controller('presentation.desktop.back', 'toolbar.back', 'notification', {binding: {event: 'goback'}}),
    alias('presentation.desktop.case', 'presentation.desktop.change-case', 'edit.text'),
    alias('presentation.desktop.change-slide', 'presentation.sdk.change-layout', 'edit.slide'),
    controller('presentation.desktop.charttab', 'edit.chart'),
    controller('presentation.desktop.close-editor', 'settings.close', 'notification', {binding: {event: 'close'}}),
    alias('presentation.desktop.columns', 'presentation.sdk.shape-apply', 'edit.shape'),
    alias('presentation.desktop.decoffset', 'presentation.sdk.decrease-indent', 'edit.text'),
    alias('presentation.desktop.direction', 'presentation.sdk.set-rtl-text-direction', 'edit.text'),
    controller('presentation.desktop.draw', 'toolbar.draw', 'notification', {binding: {event: 'draw:start'}}),
    controller('presentation.desktop.edit', 'toolbar.request-edit', 'gateway', {binding: {method: 'requestEditRights'}}),
    controller('presentation.desktop.exit', 'toolbar.back', 'notification', {binding: {event: 'goback'}}),
    controller('presentation.desktop.file-exit', 'settings.close', 'notification', {binding: {event: 'close'}}),
    excluded('presentation.desktop.file-open', 'Opening a host-local file is supplied by an external desktop connector.'),
    alias('presentation.desktop.halign', 'presentation.sdk.put-pr-align', 'edit.text'),
    controller('presentation.desktop.help', 'settings.help'),
    controller('presentation.desktop.history', 'history.version'),
    alias('presentation.desktop.incoffset', 'presentation.sdk.increase-indent', 'edit.text'),
    controller('presentation.desktop.info', 'settings.info'),
    alias('presentation.desktop.insert-columns', 'presentation.desktop.columns', 'edit.shape'),
    alias('presentation.desktop.insertsmartart', 'presentation.desktop.insert-smartart', 'add.smartart'),
    alias('presentation.desktop.insertsymbol', 'presentation.desktop.insert-symbol', 'add.symbol'),
    controller('presentation.desktop.interface-theme', 'settings.application'),
    alias('presentation.desktop.line-space', 'presentation.sdk.put-pr-line-spacing', 'edit.text'),
    alias('presentation.desktop.linespace', 'presentation.desktop.line-space', 'edit.text'),
    alias('presentation.desktop.markers', 'presentation.desktop.numbers', 'edit.text'),
    excluded('presentation.desktop.new', 'Creating a host document or template is supplied by an external integration connector.'),
    alias('presentation.desktop.numbering', 'presentation.desktop.numbers', 'edit.text'),
    controller('presentation.desktop.object-arrange', 'edit.object'),
    alias('presentation.desktop.object-merge', 'presentation.desktop.merge-shapes', 'edit.object'),
    controller('presentation.desktop.opts', 'settings.application'),
    alias('presentation.desktop.print-2', 'presentation.desktop.print', 'settings.print', {mutates: false}),
    controller('presentation.desktop.printpreview', 'settings.print'),
    controller('presentation.desktop.protect', 'settings.protect'),
    excluded('presentation.desktop.recent', 'The recent-file list belongs to the external host or desktop connector.'),
    controller('presentation.desktop.rename', 'settings.rename'),
    controller('presentation.desktop.replace', 'toolbar.search', 'search'),
    controller('presentation.desktop.review', 'coauth.review'),
    excluded('presentation.desktop.rights', 'Sharing-rights administration belongs to the external document host connector.'),
    alias('presentation.desktop.save-2', 'presentation.desktop.save', 'settings.save'),
    controller('presentation.desktop.save-copy', 'settings.download'),
    controller('presentation.desktop.saveas', 'settings.download'),
    controller('presentation.desktop.shape-align', 'edit.object'),
    alias('presentation.desktop.shape-arrange', 'presentation.desktop.object-arrange', 'edit.object', {mutates: false}),
    controller('presentation.desktop.suggest', 'coauth.review'),
    controller('presentation.desktop.support', 'settings.help'),
    alias('presentation.desktop.text-direction', 'presentation.sdk.set-rtl-text-direction', 'edit.text'),
    controller('presentation.desktop.thumbs', 'toolbar.thumbnails'),
    alias('presentation.desktop.tlbtn-insertplaceholder', 'presentation.desktop.insert-placeholder', 'add.placeholder'),
    alias('presentation.desktop.valign', 'presentation.sdk.set-vertical-align', 'edit.text'),
    controller('presentation.desktop.view', 'settings.application'),
]);
const desktopClosureById = new Map(desktopClosureDefinitions.map(spec => [spec.id, spec]));

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
                formats: sdkSpec.formats,
                mobilePath: sdkSpec.mobilePath,
                mutates: sdkSpec.mutates,
                testIds: Object.freeze(command.testIds.slice()),
            });
        }
        const closureSpec = desktopClosureById.get(command.id);
        if (closureSpec) {
            return Object.freeze({
                ...command,
                implementation: closureSpec.implementation ?? 'implemented',
                binding: closureSpec.binding,
                mobilePath: closureSpec.mobilePath,
                mutates: closureSpec.mutates,
                ...(closureSpec.exclusion ? {exclusion: closureSpec.exclusion} : {}),
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
        if (command.implementation === 'excluded') {
            return Object.freeze({
                ...entry,
                disposition: 'excluded',
                adr: command.exclusion.adr,
                reason: command.exclusion.reason,
                contexts: command.contexts,
                permissions: command.permissions,
                mobilePath: command.mobilePath,
            });
        }
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
