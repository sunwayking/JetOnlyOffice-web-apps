/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const WORD_COMMAND_IDS = Object.freeze({
    UNDO: 'common.history.undo',
    REDO: 'word.history.redo',
    COPY: 'common.selection.copy',
    CUT: 'word.clipboard.cut',
    PASTE: 'word.clipboard.paste',
    DELETE: 'word.selection.delete',
    BOLD: 'word.text.bold',
    ITALIC: 'word.text.italic',
    UNDERLINE: 'word.text.underline',
    PARAGRAPH_ALIGN: 'word.paragraph.align',
    TABLE_INSERT: 'word.table.insert',
    IMAGE_INSERT: 'word.image.insert',
    IMAGE_REPLACE: 'word.image.replace',
    CHART_EDIT_DATA: 'word.chart.edit-data',
    SHAPE_INSERT: 'word.shape.insert',
    LINK_INSERT: 'word.link.insert',
    LINK_EDIT: 'word.link.edit',
    LINK_REMOVE: 'word.link.remove',
    COMMENT_ADD: 'common.comment.add',
    COMMENT_EDIT: 'word.comment.edit',
    COMMENT_REMOVE: 'word.comment.remove',
    REVIEW_TRACK: 'word.review.track',
    REVIEW_ACCEPT: 'word.review.accept',
    REVIEW_REJECT: 'word.review.reject',
    SAVE: 'word.file.save'
});

const editAndReview = Object.freeze(['edit', 'review']);
const editOnly = Object.freeze(['edit']);
const viewOnly = Object.freeze(['view']);
const commentOnly = Object.freeze(['comment']);
const reviewOnly = Object.freeze(['review']);
const fillFormsOnly = Object.freeze(['fillForms']);
const saveCapable = Object.freeze(['edit', 'review', 'comment', 'fillForms']);

function methodSlug(method) {
    return method
        .replace(/^asc_/, '')
        .replace(/^put_/, 'put-')
        .replace(/^add_/, 'add-')
        .replace(/^change_/, 'change-')
        .replace(/^remove_/, 'remove-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/_/g, '-')
        .toLowerCase();
}

function command({
    id,
    method,
    permissions = editAndReview,
    contexts = ['document'],
    mobilePath,
    mutates = true,
    searchable = false,
    labels
}) {
    return Object.freeze({
        id: id ?? `word.sdk.${methodSlug(method)}`,
        binding: Object.freeze({kind: 'sdkjs', method}),
        permissions,
        contexts: Object.freeze(contexts),
        mobilePath: mobilePath ?? 'more.command-search',
        mutates,
        searchable,
        labels: labels ? Object.freeze(labels) : undefined
    });
}

const primaryCommands = [
    command({id: WORD_COMMAND_IDS.UNDO, method: 'Undo', mobilePath: 'toolbar.undo', labels: {en: 'Undo', zh: '\u64a4\u9500'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.REDO, method: 'Redo', mobilePath: 'toolbar.redo', labels: {en: 'Redo', zh: '\u91cd\u505a'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.COPY, method: 'Copy', permissions: viewOnly, contexts: ['text', 'image', 'shape', 'chart', 'table'], mobilePath: 'context.copy', mutates: false, labels: {en: 'Copy', zh: '\u590d\u5236'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.CUT, method: 'Cut', contexts: ['text', 'image', 'shape', 'chart', 'table'], mobilePath: 'context.cut', labels: {en: 'Cut', zh: '\u526a\u5207'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.PASTE, method: 'Paste', contexts: ['text', 'table'], mobilePath: 'context.paste', labels: {en: 'Paste', zh: '\u7c98\u8d34'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.DELETE, method: 'asc_Remove', contexts: ['text', 'image', 'shape', 'chart', 'table'], mobilePath: 'context.delete', labels: {en: 'Delete', zh: '\u5220\u9664'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.BOLD, method: 'put_TextPrBold', contexts: ['text'], mobilePath: 'edit.text.bold', labels: {en: 'Bold', zh: '\u7c97\u4f53'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.ITALIC, method: 'put_TextPrItalic', contexts: ['text'], mobilePath: 'edit.text.italic', labels: {en: 'Italic', zh: '\u659c\u4f53'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.UNDERLINE, method: 'put_TextPrUnderline', contexts: ['text'], mobilePath: 'edit.text.underline', labels: {en: 'Underline', zh: '\u4e0b\u5212\u7ebf'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.PARAGRAPH_ALIGN, method: 'put_PrAlign', contexts: ['text', 'paragraph'], mobilePath: 'edit.paragraph.alignment', labels: {en: 'Paragraph alignment', zh: '\u6bb5\u843d\u5bf9\u9f50'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.TABLE_INSERT, method: 'put_Table', contexts: ['document'], permissions: editOnly, mobilePath: 'insert.table', labels: {en: 'Insert table', zh: '\u63d2\u5165\u8868\u683c'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.IMAGE_INSERT, method: 'asc_addImage', contexts: ['document'], permissions: editOnly, mobilePath: 'insert.image', labels: {en: 'Insert image', zh: '\u63d2\u5165\u56fe\u7247'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.IMAGE_REPLACE, method: 'ChangeImageFromFile', contexts: ['image'], permissions: editOnly, mobilePath: 'edit.image.replace', labels: {en: 'Replace image', zh: '\u66ff\u6362\u56fe\u7247'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.CHART_EDIT_DATA, method: 'asc_editChartInFrameEditor', contexts: ['chart'], permissions: editOnly, mobilePath: 'edit.chart.data', labels: {en: 'Edit chart data', zh: '\u7f16\u8f91\u56fe\u8868\u6570\u636e'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.SHAPE_INSERT, method: 'AddShapeOnCurrentPage', contexts: ['document'], permissions: editOnly, mobilePath: 'insert.shape', labels: {en: 'Insert shape', zh: '\u63d2\u5165\u5f62\u72b6'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.LINK_INSERT, method: 'add_Hyperlink', contexts: ['text'], mobilePath: 'insert.link', labels: {en: 'Add link', zh: '\u6dfb\u52a0\u94fe\u63a5'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.LINK_EDIT, method: 'change_Hyperlink', contexts: ['hyperlink'], mobilePath: 'edit.link', labels: {en: 'Edit link', zh: '\u7f16\u8f91\u94fe\u63a5'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.LINK_REMOVE, method: 'remove_Hyperlink', contexts: ['hyperlink'], mobilePath: 'edit.link.remove', labels: {en: 'Remove link', zh: '\u5220\u9664\u94fe\u63a5'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.COMMENT_ADD, method: 'asc_addComment', permissions: commentOnly, contexts: ['document', 'text'], mobilePath: 'collaboration.comments.add', labels: {en: 'Add comment', zh: '\u6dfb\u52a0\u6279\u6ce8'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.COMMENT_EDIT, method: 'asc_changeComment', permissions: commentOnly, contexts: ['comment'], mobilePath: 'collaboration.comments.edit'}),
    command({id: WORD_COMMAND_IDS.COMMENT_REMOVE, method: 'asc_removeComment', permissions: commentOnly, contexts: ['comment'], mobilePath: 'collaboration.comments.delete'}),
    command({id: WORD_COMMAND_IDS.REVIEW_TRACK, method: 'asc_SetTrackRevisions', permissions: reviewOnly, contexts: ['document'], mobilePath: 'collaboration.review.track', labels: {en: 'Track changes', zh: '\u8ddf\u8e2a\u4fee\u8ba2'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.REVIEW_ACCEPT, method: 'asc_AcceptChanges', permissions: reviewOnly, contexts: ['revision'], mobilePath: 'collaboration.review.accept', labels: {en: 'Accept change', zh: '\u63a5\u53d7\u4fee\u8ba2'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.REVIEW_REJECT, method: 'asc_RejectChanges', permissions: reviewOnly, contexts: ['revision'], mobilePath: 'collaboration.review.reject', labels: {en: 'Reject change', zh: '\u62d2\u7edd\u4fee\u8ba2'}, searchable: true}),
    command({id: WORD_COMMAND_IDS.SAVE, method: 'asc_Save', permissions: saveCapable, contexts: ['document'], mobilePath: 'settings.save', labels: {en: 'Save', zh: '\u4fdd\u5b58'}, searchable: true})
];

const methodGroups = [
    {permissions: editAndReview, contexts: ['text'], mobilePath: 'edit.text', methods: ['FontSizeIn', 'FontSizeOut', 'put_TextPrFontSize', 'put_TextPrFontName', 'put_TextColor', 'SetMarkerFormat', 'put_TextPrStrikeout', 'put_TextPrDStrikeout', 'put_TextPrBaseline', 'DecreaseIndent', 'IncreaseIndent', 'put_ListTypeCustom', 'asc_setRtlTextDirection']},
    {permissions: editAndReview, contexts: ['text', 'paragraph'], mobilePath: 'edit.paragraph', methods: ['paraApply', 'put_PrLineSpacing', 'put_Style', 'asc_AddNewStyle', 'asc_RemoveStyle', 'put_LineSpacingBeforeAfter', 'put_AddSpaceBetweenPrg', 'put_ParagraphShade']},
    {permissions: editAndReview, contexts: ['document', 'text'], mobilePath: 'settings.find-replace', methods: ['asc_replaceText']},
    {permissions: editAndReview, contexts: ['document'], mobilePath: 'toolbar.undo-all', methods: ['asc_undoAllChanges']},
    {permissions: editOnly, contexts: ['image', 'shape', 'chart'], mobilePath: 'edit.object', methods: ['ImgApply', 'ChangeShapeType']},
    {permissions: editOnly, contexts: ['table'], mobilePath: 'edit.table', methods: ['tblApply', 'remTable', 'remColumn', 'remRow', 'addColumnLeft', 'addColumnRight', 'addRowAbove', 'addRowBelow', 'SplitCell', 'asc_DistributeTableCells']},
    {permissions: editOnly, contexts: ['document'], mobilePath: 'edit.table-of-contents', methods: ['asc_SetTableOfContentsPr', 'asc_UpdateTableOfContents', 'asc_RemoveTableOfContents']},
    {permissions: editOnly, contexts: ['header'], mobilePath: 'edit.header-footer', methods: ['HeadersAndFooters_DifferentFirstPage', 'HeadersAndFooters_DifferentOddandEvenPage', 'HeadersAndFooters_LinkToPrevious', 'asc_SetSectionStartPage']},
    {permissions: editOnly, contexts: ['document'], mobilePath: 'insert.other', methods: ['AddImageUrl', 'put_PageNum', 'put_AddPageBreak', 'put_AddColumnBreak', 'add_SectionBreak', 'asc_SetFootnoteProps', 'asc_AddFootnote', 'asc_AddTableOfContents', 'asc_ClearContentControl']},
    {permissions: editOnly, contexts: ['document'], mobilePath: 'settings.document', methods: ['change_PageOrient', 'change_DocSize', 'asc_SetSectionProps', 'asc_setAutoHyphenation', 'asc_ChangeColorSchemeByIdx']},
    {permissions: editOnly, contexts: ['document'], mobilePath: 'settings.protection', methods: ['asc_setDocumentProtection', 'asc_addRestriction', 'asc_removeRestriction', 'asc_setRestriction']},
    {permissions: editOnly, contexts: ['document'], mobilePath: 'settings.encryption', methods: ['asc_resetPassword', 'asc_setCurrentPassword']},
    {permissions: editOnly, contexts: ['document'], mobilePath: 'settings.document-info', methods: ['asc_setDocInfo', 'asc_wopi_renameFile']},
    {permissions: editOnly, contexts: ['document'], mobilePath: 'settings.forms', methods: ['asc_ClearAllSpecialForms']},
    {permissions: editOnly, contexts: ['document'], mobilePath: 'settings.drawing', methods: ['asc_RemoveAllInks', 'asc_StartDrawInk', 'asc_StartInkEraser', 'asc_StopInkDrawer']},
    {permissions: reviewOnly, contexts: ['revision'], mobilePath: 'collaboration.review', methods: ['asc_AcceptAllChanges', 'asc_RejectAllChanges']},
    {permissions: fillFormsOnly, contexts: ['document'], mobilePath: 'form.fill', methods: ['asc_SelectPDFFormListItem', 'asc_SelectContentControlListItem', 'asc_SetContentControlText', 'asc_SetContentControlDatePickerDate', 'asc_SetTextFormDatePickerDate', 'asc_UncheckContentControlButtons', 'asc_MoveToFillingForm', 'asc_SendForm']},
    {permissions: viewOnly, contexts: ['document'], mobilePath: 'settings.file', mutates: false, methods: ['asc_Print', 'asc_DownloadAs', 'asc_DownloadOrigin']}
];

const secondaryCommands = methodGroups.flatMap(group => group.methods.map(method => command({
    method,
    permissions: group.permissions,
    contexts: group.contexts,
    mobilePath: group.mobilePath,
    mutates: group.mutates ?? true
})));

export const WORD_COMMAND_SPECS = Object.freeze([...primaryCommands, ...secondaryCommands]);

const commandById = new Map(WORD_COMMAND_SPECS.map(spec => [spec.id, spec]));
const commandByMethod = new Map(WORD_COMMAND_SPECS.map(spec => [spec.binding.method, spec]));

export function getWordCommandSpec(commandId) {
    return commandById.get(commandId) ?? null;
}

export function getWordCommandSpecByMethod(method) {
    return commandByMethod.get(method) ?? null;
}

export function getWordCommandSpecByDescriptorId(descriptorId) {
    return commandById.get(descriptorId) ?? null;
}

export function listSearchableWordCommands(locale = 'en') {
    const language = String(locale).toLowerCase().startsWith('zh') ? 'zh' : 'en';
    return WORD_COMMAND_SPECS
        .filter(spec => spec.searchable && spec.labels)
        .map(spec => Object.freeze({...spec, label: spec.labels[language] ?? spec.labels.en}));
}
