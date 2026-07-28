/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
    App,
    Block,
    Button,
    Link,
    Navbar,
    NavLeft,
    NavRight,
    NavTitle,
    Page,
    Toolbar,
    View,
} from 'framework7-react';
import {
    ChatBubble,
    ChevronLeft,
    DocOnDoc,
    Pencil,
    Plus,
    RectangleOnRectangle,
    Signature,
    Xmark,
} from 'framework7-icons/react';

import catalog from '../commands/mobile-command-catalog.json';
import {PDF_TASK_SPACE_IDS} from '../lib/pdfCommandProvider.mjs';
import {isPdfChineseLocale} from '../lib/pdfLocale.mjs';
import {parsePdfPageRange} from '../lib/pdfRedactionInput.mjs';

const TASK_ICONS = Object.freeze({
    edit: Pencil,
    insert: Plus,
    comment: ChatBubble,
    pages: DocOnDoc,
    forms: RectangleOnRectangle,
    signatures: Signature,
});

const COMMAND_LABELS = Object.freeze({
    'pdf.edit.undo': ['Undo', '撤销'],
    'pdf.edit.redo': ['Redo', '重做'],
    'pdf.redaction.mark': ['Mark for redaction', '标记脱敏'],
    'pdf.redaction.selection': ['Selected text', '所选文字'],
    'pdf.redaction.current-page': ['Current page', '当前页'],
    'pdf.redaction.apply': ['Apply redaction', '应用脱敏'],
    'pdf.redaction.pages': ['Page range', '页码范围'],
    'pdf.redaction.search-all': ['Search results', '搜索结果'],
    'pdf.redaction.discard': ['Discard marks', '放弃标记'],
    'pdf.insert.image': ['Image', '图片'],
    'pdf.insert.image-url': ['Image link', '图片链接'],
    'pdf.insert.shape': ['Shape', '形状'],
    'pdf.insert.text-art': ['Text art', '艺术字'],
    'pdf.insert.table': ['Table', '表格'],
    'pdf.comment.add': ['Comment', '评论'],
    'pdf.annotation.marker': ['Text markup', '文字标记'],
    'pdf.annotation.ink-start': ['Draw', '绘图'],
    'pdf.annotation.ink-stop': ['Stop drawing', '结束绘图'],
    'pdf.pages.add': ['Add page', '添加页面'],
    'pdf.pages.remove': ['Remove page', '删除页面'],
    'pdf.pages.rotate': ['Rotate page', '旋转页面'],
    'pdf.forms.text': ['Text field', '文本字段'],
    'pdf.forms.date': ['Date field', '日期字段'],
    'pdf.forms.image': ['Image field', '图片字段'],
    'pdf.forms.checkbox': ['Checkbox', '复选框'],
    'pdf.forms.radio': ['Radio button', '单选按钮'],
    'pdf.forms.combo': ['Combo box', '组合框'],
    'pdf.forms.dropdown': ['Dropdown', '下拉列表'],
    'pdf.forms.clear': ['Clear fields', '清除字段'],
    'pdf.forms.signature': ['Signature field', '签名字段'],
    'pdf.signatures.apply-appearance': ['Add signature', '添加签名'],
    'pdf.signatures.certificates': ['Certificate signatures', '证书签名'],
    'pdf.signatures.fields': ['Signature fields', '签名字段'],
    'pdf.signatures.requested': ['Pending signatures', '待签名'],
});

const DEFAULT_PAYLOADS = Object.freeze({
    'pdf.redaction.mark': {value: true},
    'pdf.insert.shape': {type: 'rect', start: true},
    'pdf.insert.text-art': {style: 0},
    'pdf.insert.table': {columns: 2, rows: 2},
    'pdf.pages.add': {},
    'pdf.pages.remove': {},
    'pdf.pages.rotate': {angle: 90},
});

const uiError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const createComment = text => {
    const CommentData = window.Asc?.asc_CCommentDataWord || window.Asc?.asc_CCommentData;
    if (typeof CommentData !== 'function') {
        throw uiError('MOBILE_PDF_COMMENT_DATA_UNAVAILABLE', 'PDF comment data is unavailable');
    }
    const comment = new CommentData(null);
    if (typeof comment.asc_putText !== 'function') {
        throw uiError('MOBILE_PDF_COMMENT_DATA_INVALID', 'PDF comment data cannot accept text');
    }
    comment.asc_putText(text);
    if (typeof comment.asc_putSolved === 'function') comment.asc_putSolved(false);
    return comment;
};

const createInkStroke = () => {
    const Asc = window.Asc;
    if (typeof Asc?.asc_CStroke !== 'function' || typeof Asc?.asc_CColor !== 'function' ||
        Asc.c_oAscStrokeType?.STROKE_COLOR === undefined) {
        throw uiError('MOBILE_PDF_INK_UNAVAILABLE', 'PDF ink primitives are unavailable');
    }
    const color = new Asc.asc_CColor();
    color.asc_putR(32);
    color.asc_putG(103);
    color.asc_putB(196);
    color.asc_putA(255);
    const stroke = new Asc.asc_CStroke();
    stroke.asc_putType(Asc.c_oAscStrokeType.STROKE_COLOR);
    stroke.asc_putColor(color);
    stroke.asc_putWidth(2);
    stroke.asc_putTransparent(255);
    return stroke;
};

const signatureFieldId = signature => {
    if (!signature) return null;
    for (const getter of ['GetFullName', 'GetName', 'Get_Id', 'asc_getGuid']) {
        if (typeof signature[getter] === 'function') {
            const value = signature[getter]();
            if (typeof value === 'string' && value) return value;
        }
    }
    return signature.fieldId || signature.id || signature.guid || signature.name || null;
};

export default function PdfMobileApp({bridge}) {
    const [api, setApi] = useState(() => bridge.getEditorApi());
    const [runtime, setRuntime] = useState(() => bridge.getRuntime());
    const [uiState, setUiState] = useState(() => bridge.getUiState());
    const [sessionState, setSessionState] = useState('connecting');
    const [lastError, setLastError] = useState(null);
    const [lastResult, setLastResult] = useState(null);
    const [selectedSignature, setSelectedSignature] = useState(null);
    const chinese = isPdfChineseLocale(window.Common?.Locale, navigator.language);
    const activeTask = uiState.activeTask;

    useEffect(() => bridge.subscribeUiState(setUiState), [bridge]);

    useEffect(() => {
        const onReady = event => {
            setApi(event.detail.api);
            setRuntime(event.detail.runtime);
        };
        const onPermissions = () => setUiState(bridge.getUiState());
        const onBootstrapError = event => setLastError(event.detail.error?.code || 'MOBILE_PDF_BOOTSTRAP_FAILED');
        window.addEventListener('jetonlyoffice:pdf-api-ready', onReady);
        window.addEventListener('jetonlyoffice:pdf-permissions-changed', onPermissions);
        window.addEventListener('jetonlyoffice:pdf-bootstrap-error', onBootstrapError);
        return () => {
            window.removeEventListener('jetonlyoffice:pdf-api-ready', onReady);
            window.removeEventListener('jetonlyoffice:pdf-permissions-changed', onPermissions);
            window.removeEventListener('jetonlyoffice:pdf-bootstrap-error', onBootstrapError);
        };
    }, [bridge]);

    useEffect(() => {
        if (!api || typeof api.asc_registerCallback !== 'function') return undefined;
        const onSignatureField = (signature, width, height) => setSelectedSignature({signature, width, height});
        api.asc_registerCallback('asc_onSignatureFieldClick', onSignatureField);
        return () => api.asc_unregisterCallback('asc_onSignatureFieldClick', onSignatureField);
    }, [api]);

    useEffect(() => {
        if (!runtime) {
            setSessionState('connecting');
            return undefined;
        }
        return runtime.subscribe(session => {
            bridge.updateSession(session);
            if (session.save.state !== 'idle') setSessionState(session.save.state);
            else if (session.transport.state !== 'idle') setSessionState(session.transport.state);
            else setSessionState(session.open.phase);
        });
    }, [bridge, runtime]);

    useEffect(() => {
        const editor = document.getElementById('editor_sdk');
        if (!editor) return undefined;
        const onContextMenu = event => {
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
            event.preventDefault();
            const selected = bridge.getSelection();
            const types = selected.map(item => item?.get_ObjectType?.());
            const Asc = window.Asc;
            if (types.includes(Asc?.c_oAscTypeSelectElement?.Field)) bridge.openTask('forms');
            else if (types.includes(Asc?.c_oAscTypeSelectElement?.Annot)) bridge.openTask('comment');
            else if (types.includes(Asc?.c_oAscTypeSelectElement?.PdfPage)) bridge.openTask('pages');
            else bridge.openTask('edit');
        };
        editor.addEventListener('contextmenu', onContextMenu);
        return () => editor.removeEventListener('contextmenu', onContextMenu);
    }, [bridge]);

    const commands = useMemo(
        () => activeTask ? catalog.commands.filter(command => command.taskSpace === activeTask) : [],
        [activeTask],
    );

    const commandLabel = commandId => COMMAND_LABELS[commandId]?.[chinese ? 1 : 0] || commandId;

    const buildPayload = commandId => {
        if (commandId === 'pdf.redaction.pages') {
            const value = window.prompt(chinese ? '页码或范围，例如 1, 3-5' : 'Pages or ranges, for example 1, 3-5');
            return value === null ? null : {pages: parsePdfPageRange(value)};
        }
        if (commandId === 'pdf.redaction.search-all') {
            const value = window.prompt(chinese ? '搜索并标记全部结果' : 'Search and mark all results');
            if (!value?.trim()) return null;
            const SearchSettings = window.AscCommon?.CSearchSettings;
            if (typeof SearchSettings !== 'function') {
                throw uiError('MOBILE_PDF_SEARCH_UNAVAILABLE', 'PDF search settings are unavailable');
            }
            const settings = new SearchSettings();
            settings.put_Text(value.trim());
            settings.put_MatchCase(false);
            settings.put_WholeWords(false);
            return {settings};
        }
        if (commandId === 'pdf.insert.image-url') {
            const value = window.prompt(chinese ? '图片链接' : 'Image link');
            return value?.trim() ? {urls: [value.trim()]} : null;
        }
        if (commandId === 'pdf.comment.add') {
            const value = window.prompt(chinese ? '评论' : 'Comment');
            return value?.trim() ? {comment: createComment(value.trim())} : null;
        }
        if (commandId === 'pdf.annotation.marker') {
            const type = window.AscPDF?.ANNOTATIONS_TYPES?.Highlight;
            if (type === undefined) throw uiError('MOBILE_PDF_MARKER_UNAVAILABLE', 'PDF marker type is unavailable');
            return {type, enabled: true, opacity: 100, r: 255, g: 252, b: 84};
        }
        if (commandId === 'pdf.annotation.ink-start') return {pen: createInkStroke()};
        if (commandId === 'pdf.signatures.apply-appearance') {
            const fieldId = signatureFieldId(selectedSignature?.signature);
            if (!fieldId) throw uiError('MOBILE_SIGNATURE_FIELD_REQUIRED', 'Select a PDF signature field first');
            const text = window.prompt(chinese ? '签名文字' : 'Signature text');
            return text?.trim() ? {appearance: {fieldId, mode: 'typed', text: text.trim()}} : null;
        }
        return DEFAULT_PAYLOADS[commandId];
    };

    const executeCommand = (commandId, explicitPayload) => {
        setLastError(null);
        setLastResult(null);
        try {
            const payload = explicitPayload === undefined ? buildPayload(commandId) : explicitPayload;
            if (payload === null) return;
            const result = bridge.executeCommand(commandId, payload);
            if (Array.isArray(result)) setLastResult(`${commandLabel(commandId)}: ${result.length}`);
            else if (Number.isFinite(result)) setLastResult(`${commandLabel(commandId)}: ${result}`);
        } catch (error) {
            setLastError(error.code || 'MOBILE_COMMAND_FAILED');
        }
    };

    const runCommand = commandId => {
        if (commandId === 'pdf.redaction.apply') {
            bridge.openOverlay('redaction-confirmation');
            return;
        }
        executeCommand(commandId);
    };

    const handleBack = () => bridge.handleBack();
    const currentTask = catalog.taskSpaces.find(item => item.id === activeTask);

    return (
        <App name="JetOnlyOffice PDF" theme="auto">
            <View main>
                <Page className="pdf-mobile-page">
                    <Navbar>
                        <NavLeft>
                            <Link onClick={handleBack} aria-label={chinese ? '返回' : 'Back'}>
                                <ChevronLeft className="pdf-back-icon" aria-hidden="true" />
                            </Link>
                        </NavLeft>
                        <NavTitle>{bridge.getDocumentContext().title || 'JetOnlyOffice PDF'}</NavTitle>
                        <NavRight>
                            <span className={`pdf-session-state is-${sessionState}`} role="status">
                                {sessionState}
                            </span>
                        </NavRight>
                    </Navbar>

                    <div id="editor_sdk" className={`pdf-editor-canvas${activeTask ? ' has-command-panel' : ''}`} />

                    {activeTask && (
                        <section className="pdf-command-panel" aria-label={currentTask?.label[chinese ? 'zh-CN' : 'en']}>
                            <header className="pdf-command-header">
                                <strong>{currentTask?.label[chinese ? 'zh-CN' : 'en']}</strong>
                                <Button
                                    className="pdf-close-panel"
                                    onClick={() => bridge.closePanel()}
                                    aria-label={chinese ? '关闭' : 'Close'}
                                >
                                    <Xmark aria-hidden="true" />
                                </Button>
                            </header>
                            <Block strongIos outlineIos className="pdf-command-grid">
                                {commands.map(command => {
                                    const label = commandLabel(command.id);
                                    const resolved = bridge.resolveCommand(command.id);
                                    return (
                                        <Button
                                            key={command.id}
                                            className={command.id === 'pdf.redaction.apply' ? 'is-destructive' : ''}
                                            disabled={!resolved?.available}
                                            onClick={() => runCommand(command.id)}
                                            aria-label={label}
                                        >
                                            {label}
                                        </Button>
                                    );
                                })}
                            </Block>
                            {lastError && <div className="pdf-command-error" role="alert">{lastError}</div>}
                            {lastResult && <div className="pdf-command-result" role="status">{lastResult}</div>}
                        </section>
                    )}

                    <Toolbar bottom tabbar className="pdf-task-toolbar">
                        {PDF_TASK_SPACE_IDS.map(taskId => {
                            const task = catalog.taskSpaces.find(item => item.id === taskId);
                            const label = task.label[chinese ? 'zh-CN' : 'en'];
                            const TaskIcon = TASK_ICONS[taskId];
                            return (
                                <Link
                                    key={taskId}
                                    tabLinkActive={taskId === activeTask}
                                    onClick={() => bridge.openTask(taskId)}
                                    aria-label={label}
                                >
                                    <TaskIcon className="pdf-task-icon" aria-hidden="true" />
                                    <span>{label}</span>
                                </Link>
                            );
                        })}
                    </Toolbar>

                    {uiState.overlay === 'redaction-confirmation' && (
                        <div className="pdf-modal-backdrop" role="presentation">
                            <section className="pdf-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="redaction-title">
                                <h2 id="redaction-title">{chinese ? '应用永久脱敏' : 'Apply permanent redaction'}</h2>
                                <p>{chinese
                                    ? '保存后，被脱敏的内容将无法搜索、复制或恢复。'
                                    : 'After saving, redacted content cannot be searched, copied, or recovered.'}</p>
                                <div className="pdf-dialog-actions">
                                    <Button onClick={() => bridge.closeOverlay()}>{chinese ? '取消' : 'Cancel'}</Button>
                                    <Button className="is-destructive" onClick={() => {
                                        bridge.closeOverlay();
                                        executeCommand('pdf.redaction.apply', {confirmed: true});
                                    }}>{chinese ? '应用' : 'Apply'}</Button>
                                </div>
                            </section>
                        </div>
                    )}

                    {uiState.overlay === 'exit-confirmation' && (
                        <div className="pdf-modal-backdrop" role="presentation">
                            <section className="pdf-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="exit-title">
                                <h2 id="exit-title">{chinese ? '更改尚未确认保存' : 'Changes are not confirmed saved'}</h2>
                                <p>{chinese ? '离开将放弃尚未确认的更改。' : 'Leaving will discard changes that are not confirmed saved.'}</p>
                                <div className="pdf-dialog-actions">
                                    <Button onClick={() => bridge.closeOverlay()}>{chinese ? '继续编辑' : 'Keep editing'}</Button>
                                    <Button className="is-destructive" onClick={() => bridge.confirmExit(true)}>{chinese ? '离开' : 'Leave'}</Button>
                                </div>
                            </section>
                        </div>
                    )}
                </Page>
            </View>
        </App>
    );
}
