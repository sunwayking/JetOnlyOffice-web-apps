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
    Gear,
    Pencil,
    Person2,
    Plus,
    RectangleOnRectangle,
    Search,
    Signature,
    Xmark,
} from 'framework7-icons/react';

import catalog from '../commands/mobile-command-catalog.json';
import {PDF_TASK_SPACE_IDS} from '../lib/pdfCommandProvider.mjs';
import {isPdfChineseLocale} from '../lib/pdfLocale.mjs';
import {
    filterPdfCommandSearchResults,
    normalizePdfParticipants,
    resolvePdfCommandInput,
    resolvePdfSelectionContext,
} from '../lib/pdfMobileUiModel.mjs';
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
    'pdf.file.save': ['Save', '保存'],
    'pdf.clipboard.copy': ['Copy', '复制'],
    'pdf.clipboard.cut': ['Cut', '剪切'],
    'pdf.clipboard.paste': ['Paste', '粘贴'],
    'pdf.edit.undo': ['Undo', '撤销'],
    'pdf.edit.redo': ['Redo', '重做'],
    'pdf.edit.bold': ['Bold', '粗体'],
    'pdf.edit.italic': ['Italic', '斜体'],
    'pdf.edit.underline': ['Underline', '下划线'],
    'pdf.edit.strikeout': ['Strikeout', '删除线'],
    'pdf.edit.superscript': ['Superscript', '上标'],
    'pdf.edit.subscript': ['Subscript', '下标'],
    'pdf.edit.change-case': ['Change case', '更改大小写'],
    'pdf.edit.horizontal-align': ['Horizontal align', '水平对齐'],
    'pdf.edit.text-direction': ['Text direction', '文字方向'],
    'pdf.edit.select-all': ['Select all', '全选'],
    'pdf.edit.clear-formatting': ['Clear formatting', '清除格式'],
    'pdf.edit.font-size-increase': ['Increase font size', '增大字号'],
    'pdf.edit.font-size-decrease': ['Decrease font size', '减小字号'],
    'pdf.edit.indent-increase': ['Increase indent', '增加缩进'],
    'pdf.edit.indent-decrease': ['Decrease indent', '减少缩进'],
    'pdf.edit.select-tool': ['Select tool', '选择工具'],
    'pdf.edit.hand-tool': ['Hand tool', '抓手工具'],
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
    'pdf.annotation.remove-selected': ['Remove selected', '删除所选'],
    'pdf.pages.add': ['Add page', '添加页面'],
    'pdf.pages.remove': ['Remove page', '删除页面'],
    'pdf.pages.rotate': ['Rotate page', '旋转页面'],
    'pdf.pages.copy': ['Copy pages', '复制页面'],
    'pdf.pages.cut': ['Cut pages', '剪切页面'],
    'pdf.pages.paste-before': ['Paste before', '粘贴到前面'],
    'pdf.pages.paste-after': ['Paste after', '粘贴到后面'],
    'pdf.pages.first': ['First page', '第一页'],
    'pdf.pages.previous': ['Previous page', '上一页'],
    'pdf.pages.next': ['Next page', '下一页'],
    'pdf.pages.last': ['Last page', '最后一页'],
    'pdf.object.group': ['Group objects', '组合对象'],
    'pdf.object.ungroup': ['Ungroup objects', '取消组合'],
    'pdf.object.bring-front': ['Bring to front', '置于顶层'],
    'pdf.object.bring-back': ['Send to back', '置于底层'],
    'pdf.object.bring-forward': ['Bring forward', '上移一层'],
    'pdf.object.bring-backward': ['Send backward', '下移一层'],
    'pdf.table.merge-cells': ['Merge cells', '合并单元格'],
    'pdf.table.distribute-rows': ['Distribute rows', '平均分布行'],
    'pdf.table.distribute-columns': ['Distribute columns', '平均分布列'],
    'pdf.forms.text': ['Text field', '文本字段'],
    'pdf.forms.date': ['Date field', '日期字段'],
    'pdf.forms.image': ['Image field', '图片字段'],
    'pdf.forms.checkbox': ['Checkbox', '复选框'],
    'pdf.forms.radio': ['Radio button', '单选按钮'],
    'pdf.forms.combo': ['Combo box', '组合框'],
    'pdf.forms.dropdown': ['Dropdown', '下拉列表'],
    'pdf.forms.email': ['Email field', '电子邮件字段'],
    'pdf.forms.phone': ['Phone field', '电话字段'],
    'pdf.forms.credit-card': ['Credit card field', '信用卡字段'],
    'pdf.forms.zip-code': ['ZIP code field', '邮政编码字段'],
    'pdf.forms.clear': ['Clear fields', '清除字段'],
    'pdf.forms.previous': ['Previous field', '上一个字段'],
    'pdf.forms.next': ['Next field', '下一个字段'],
    'pdf.forms.submit': ['Submit form', '提交表单'],
    'pdf.forms.signature': ['Signature field', '签名字段'],
    'pdf.signatures.apply-appearance': ['Add signature', '添加签名'],
    'pdf.signatures.certificates': ['Certificate signatures', '证书签名'],
    'pdf.signatures.fields': ['Signature fields', '签名字段'],
    'pdf.signatures.requested': ['Pending signatures', '待签名'],
    'pdf.view.fit-page': ['Fit page', '适合页面'],
    'pdf.view.fit-width': ['Fit width', '适合宽度'],
    'pdf.view.zoom-in': ['Zoom in', '放大'],
    'pdf.view.zoom-out': ['Zoom out', '缩小'],
    'pdf.view.zoom': ['Zoom', '缩放'],
});

const DEFAULT_PAYLOADS = Object.freeze({
    'pdf.edit.bold': {enabled: true},
    'pdf.edit.italic': {enabled: true},
    'pdf.edit.underline': {enabled: true},
    'pdf.edit.strikeout': {enabled: true},
    'pdf.edit.superscript': {baseline: 2},
    'pdf.edit.subscript': {baseline: 1},
    'pdf.edit.change-case': {value: 0},
    'pdf.edit.horizontal-align': {value: 0},
    'pdf.edit.text-direction': {rtl: true},
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
    const [participants, setParticipants] = useState([]);
    const [contextCommands, setContextCommands] = useState([]);
    const [contextKind, setContextKind] = useState('selection');
    const [searchQuery, setSearchQuery] = useState('');
    const [zoomValue, setZoomValue] = useState(100);
    const [commandInput, setCommandInput] = useState(null);
    const [commandInputValue, setCommandInputValue] = useState('');
    const [commandInputError, setCommandInputError] = useState(null);
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
        const onParticipants = users => setParticipants(normalizePdfParticipants(users));
        const onZoom = zoom => {
            if (Number.isFinite(zoom)) setZoomValue(Math.min(500, Math.max(25, Math.round(zoom))));
        };
        api.asc_registerCallback('asc_onSignatureFieldClick', onSignatureField);
        api.asc_registerCallback('asc_onAuthParticipantsChanged', onParticipants);
        api.asc_registerCallback('asc_onParticipantsChanged', onParticipants);
        api.asc_registerCallback('asc_onZoomChange', onZoom);
        return () => {
            api.asc_unregisterCallback('asc_onSignatureFieldClick', onSignatureField);
            api.asc_unregisterCallback('asc_onAuthParticipantsChanged', onParticipants);
            api.asc_unregisterCallback('asc_onParticipantsChanged', onParticipants);
            api.asc_unregisterCallback('asc_onZoomChange', onZoom);
        };
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
            const context = resolvePdfSelectionContext(bridge.getSelection(), window.Asc);
            const resolved = bridge.resolveContextMenu(context);
            if (!resolved.length) return;
            setContextKind(context.kind);
            setContextCommands(resolved);
            bridge.openOverlay('context-menu');
        };
        editor.addEventListener('contextmenu', onContextMenu);
        return () => editor.removeEventListener('contextmenu', onContextMenu);
    }, [bridge]);

    const commands = useMemo(
        () => activeTask ? catalog.commands.filter(command => command.taskSpace === activeTask) : [],
        [activeTask],
    );

    const commandLabel = commandId => COMMAND_LABELS[commandId]?.[chinese ? 1 : 0] || commandId;
    const searchResults = useMemo(() => filterPdfCommandSearchResults({
        commands: catalog.commands,
        query: searchQuery,
        labelFor: command => commandLabel(command.id),
        resolve: bridge.resolveCommand,
    }), [bridge, chinese, searchQuery, sessionState, uiState]);

    const buildPayload = (commandId, inputValue = '') => {
        if (commandId === 'pdf.redaction.pages') {
            return {
                pages: parsePdfPageRange(inputValue, bridge.getEditorApi()?.getCountPages?.()),
            };
        }
        if (commandId === 'pdf.redaction.search-all') {
            const value = inputValue.trim();
            if (!value) return null;
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
            const value = inputValue.trim();
            return value ? {urls: [value]} : null;
        }
        if (commandId === 'pdf.comment.add') {
            const value = inputValue.trim();
            return value ? {comment: createComment(value)} : null;
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
            const text = inputValue.trim();
            return text ? {appearance: {fieldId, mode: 'typed', text}} : null;
        }
        return DEFAULT_PAYLOADS[commandId];
    };

    const executeCommand = (commandId, explicitPayload) => {
        setLastError(null);
        setLastResult(null);
        try {
            const payload = explicitPayload === undefined ? buildPayload(commandId) : explicitPayload;
            if (payload === null) return;
            const reportResult = result => {
                if (Array.isArray(result)) setLastResult(`${commandLabel(commandId)}: ${result.length}`);
                else if (Number.isFinite(result)) setLastResult(`${commandLabel(commandId)}: ${result}`);
            };
            const result = bridge.executeCommand(commandId, payload);
            if (result && typeof result.then === 'function') {
                result.then(reportResult).catch(error => setLastError(error.code || 'MOBILE_COMMAND_FAILED'));
            } else {
                reportResult(result);
            }
        } catch (error) {
            setLastError(error.code || 'MOBILE_COMMAND_FAILED');
        }
    };

    const closeCommandInput = () => {
        setCommandInput(null);
        setCommandInputValue('');
        setCommandInputError(null);
        bridge.closeOverlay();
    };

    const openCommandInput = commandId => {
        const descriptor = resolvePdfCommandInput(commandId, chinese);
        if (!descriptor) return false;
        if (commandId === 'pdf.signatures.apply-appearance' && !signatureFieldId(selectedSignature?.signature)) {
            setLastError('MOBILE_SIGNATURE_FIELD_REQUIRED');
            return true;
        }
        setCommandInput(descriptor);
        setCommandInputValue('');
        setCommandInputError(null);
        bridge.openOverlay('command-input');
        return true;
    };

    const submitCommandInput = event => {
        event.preventDefault();
        if (!commandInput) return;
        try {
            const payload = buildPayload(commandInput.commandId, commandInputValue);
            if (payload === null) {
                setCommandInputError(chinese ? '请输入内容。' : 'Enter a value.');
                return;
            }
            const commandId = commandInput.commandId;
            closeCommandInput();
            executeCommand(commandId, payload);
        } catch (error) {
            const message = error.code === 'MOBILE_PDF_PAGE_RANGE_INVALID'
                ? (chinese ? '请输入文档范围内的有效升序页码。' : 'Enter valid ascending pages within this document.')
                : (error.message || error.code || 'MOBILE_COMMAND_INPUT_INVALID');
            setCommandInputError(message);
        }
    };

    const runCommand = commandId => {
        if (commandId === 'pdf.redaction.apply') {
            bridge.openOverlay('redaction-confirmation');
            return;
        }
        if (openCommandInput(commandId)) return;
        executeCommand(commandId);
    };

    const handleBack = () => bridge.handleBack();
    const currentTask = catalog.taskSpaces.find(item => item.id === activeTask);
    const openGlobalPanel = panelId => {
        setLastError(null);
        if (panelId === 'command-search') setSearchQuery('');
        bridge.openOverlay(panelId);
    };
    const navigateToSearchResult = command => {
        if (command.scope === 'global') bridge.openOverlay(command.taskSpace);
        else bridge.openTask(command.taskSpace);
    };
    const runContextCommand = commandId => {
        bridge.closeOverlay();
        runCommand(commandId);
    };
    const setZoom = value => {
        const next = Number(value);
        setZoomValue(next);
        executeCommand('pdf.view.zoom', {value: next});
    };

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
                            <span className={`pdf-session-state is-${sessionState}`} role="status" title={sessionState}>
                                <span className="pdf-session-dot" aria-hidden="true" />
                                <span className="pdf-session-text">{sessionState}</span>
                            </span>
                            <Link
                                className="pdf-global-action"
                                onClick={() => openGlobalPanel('command-search')}
                                aria-label={chinese ? '搜索命令' : 'Search commands'}
                                title={chinese ? '搜索命令' : 'Search commands'}
                            >
                                <Search aria-hidden="true" />
                            </Link>
                            <Link
                                className="pdf-global-action"
                                onClick={() => openGlobalPanel('collaboration')}
                                aria-label={chinese ? '协作者' : 'Collaborators'}
                                title={chinese ? '协作者' : 'Collaborators'}
                            >
                                <Person2 aria-hidden="true" />
                                {participants.length > 0 && <span className="pdf-participant-count">{participants.length}</span>}
                            </Link>
                            <Link
                                className="pdf-global-action"
                                onClick={() => openGlobalPanel('settings')}
                                aria-label={chinese ? '设置' : 'Settings'}
                                title={chinese ? '设置' : 'Settings'}
                            >
                                <Gear aria-hidden="true" />
                            </Link>
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

                    {uiState.overlay === 'command-search' && (
                        <section className="pdf-global-panel" role="dialog" aria-modal="true" aria-labelledby="pdf-search-title">
                            <header className="pdf-global-header">
                                <h2 id="pdf-search-title">{chinese ? '搜索命令' : 'Search commands'}</h2>
                                <Button onClick={() => bridge.closeOverlay()} aria-label={chinese ? '关闭' : 'Close'}>
                                    <Xmark aria-hidden="true" />
                                </Button>
                            </header>
                            <div className="pdf-search-field">
                                <Search aria-hidden="true" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={event => setSearchQuery(event.target.value)}
                                    placeholder={chinese ? '输入命令名称' : 'Enter a command name'}
                                    autoFocus
                                />
                            </div>
                            <div className="pdf-global-list" role="list">
                                {searchResults.map(command => (
                                    <Button key={command.id} onClick={() => navigateToSearchResult(command)} role="listitem">
                                        <span>{commandLabel(command.id)}</span>
                                        <small>{command.scope === 'global'
                                            ? (chinese ? '设置' : 'Settings')
                                            : catalog.taskSpaces.find(task => task.id === command.taskSpace)?.label[chinese ? 'zh-CN' : 'en']}</small>
                                    </Button>
                                ))}
                                {searchQuery.trim() && searchResults.length === 0 && (
                                    <p className="pdf-empty-state">{chinese ? '没有可用命令' : 'No available commands'}</p>
                                )}
                            </div>
                        </section>
                    )}

                    {uiState.overlay === 'collaboration' && (
                        <section className="pdf-global-panel" role="dialog" aria-modal="true" aria-labelledby="pdf-collaboration-title">
                            <header className="pdf-global-header">
                                <h2 id="pdf-collaboration-title">{chinese ? '协作者' : 'Collaborators'}</h2>
                                <Button onClick={() => bridge.closeOverlay()} aria-label={chinese ? '关闭' : 'Close'}>
                                    <Xmark aria-hidden="true" />
                                </Button>
                            </header>
                            <div className="pdf-global-list" role="list">
                                {participants.map(participant => (
                                    <div className="pdf-participant" key={participant.id} role="listitem">
                                        <span className="pdf-participant-avatar" aria-hidden="true">
                                            {participant.name.trim().charAt(0).toLocaleUpperCase() || '?'}
                                        </span>
                                        <span>{participant.name}</span>
                                        <small>{participant.view
                                            ? (chinese ? '查看' : 'Viewing')
                                            : (chinese ? '编辑' : 'Editing')}</small>
                                    </div>
                                ))}
                                {participants.length === 0 && (
                                    <p className="pdf-empty-state">{chinese ? '当前没有其他参与者' : 'No other participants'}</p>
                                )}
                            </div>
                        </section>
                    )}

                    {uiState.overlay === 'settings' && (
                        <section className="pdf-global-panel" role="dialog" aria-modal="true" aria-labelledby="pdf-settings-title">
                            <header className="pdf-global-header">
                                <h2 id="pdf-settings-title">{chinese ? '设置' : 'Settings'}</h2>
                                <Button onClick={() => bridge.closeOverlay()} aria-label={chinese ? '关闭' : 'Close'}>
                                    <Xmark aria-hidden="true" />
                                </Button>
                            </header>
                            <div className="pdf-settings-content">
                                <div className="pdf-fit-controls" role="group" aria-label={chinese ? '页面适配' : 'Page fitting'}>
                                    <Button
                                        disabled={!bridge.resolveCommand('pdf.view.fit-page')?.available}
                                        onClick={() => executeCommand('pdf.view.fit-page')}
                                    >{commandLabel('pdf.view.fit-page')}</Button>
                                    <Button
                                        disabled={!bridge.resolveCommand('pdf.view.fit-width')?.available}
                                        onClick={() => executeCommand('pdf.view.fit-width')}
                                    >{commandLabel('pdf.view.fit-width')}</Button>
                                </div>
                                <label className="pdf-zoom-control">
                                    <span>{commandLabel('pdf.view.zoom')}</span>
                                    <output>{zoomValue}%</output>
                                    <input
                                        type="range"
                                        min="25"
                                        max="500"
                                        step="5"
                                        value={zoomValue}
                                        disabled={!bridge.resolveCommand('pdf.view.zoom')?.available}
                                        onChange={event => setZoom(event.target.value)}
                                    />
                                </label>
                            </div>
                        </section>
                    )}

                    {uiState.overlay === 'context-menu' && (
                        <div className="pdf-modal-backdrop pdf-context-backdrop" role="presentation" onClick={() => bridge.closeOverlay()}>
                            <section
                                className="pdf-context-menu"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="pdf-context-title"
                                onClick={event => event.stopPropagation()}
                            >
                                <h2 id="pdf-context-title" className="pdf-visually-hidden">
                                    {chinese ? '所选内容' : 'Selection'} · {contextKind}
                                </h2>
                                <div className="pdf-context-command-grid">
                                    {contextCommands.map(commandId => (
                                        <Button key={commandId} onClick={() => runContextCommand(commandId)}>
                                            {commandLabel(commandId)}
                                        </Button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}

                    {uiState.overlay === 'command-input' && commandInput && (
                        <div className="pdf-modal-backdrop pdf-input-backdrop" role="presentation" onClick={closeCommandInput}>
                            <section
                                className="pdf-input-sheet"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="pdf-command-input-title"
                                onClick={event => event.stopPropagation()}
                            >
                                <form onSubmit={submitCommandInput}>
                                    <header className="pdf-input-header">
                                        <h2 id="pdf-command-input-title">{commandLabel(commandInput.commandId)}</h2>
                                        <button
                                            className="button pdf-input-close"
                                            type="button"
                                            onClick={closeCommandInput}
                                            aria-label={chinese ? '关闭' : 'Close'}
                                        >
                                            <Xmark aria-hidden="true" />
                                        </button>
                                    </header>
                                    <div className="pdf-input-content">
                                        <label htmlFor="pdf-command-input-value">{commandInput.label}</label>
                                        {commandInput.multiline ? (
                                            <textarea
                                                id="pdf-command-input-value"
                                                value={commandInputValue}
                                                onChange={event => setCommandInputValue(event.target.value)}
                                                placeholder={commandInput.placeholder}
                                                rows="3"
                                                autoFocus
                                            />
                                        ) : (
                                            <input
                                                id="pdf-command-input-value"
                                                type={commandInput.type}
                                                inputMode={commandInput.inputMode}
                                                value={commandInputValue}
                                                onChange={event => setCommandInputValue(event.target.value)}
                                                placeholder={commandInput.placeholder}
                                                autoComplete="off"
                                                autoFocus
                                            />
                                        )}
                                        {commandInputError && <p className="pdf-input-error" role="alert">{commandInputError}</p>}
                                    </div>
                                    <div className="pdf-input-actions">
                                        <button className="button" type="button" onClick={closeCommandInput}>
                                            {chinese ? '取消' : 'Cancel'}
                                        </button>
                                        <button className="button is-primary" type="submit" disabled={!commandInputValue.trim()}>
                                            {chinese ? '确定' : 'Apply'}
                                        </button>
                                    </div>
                                </form>
                            </section>
                        </div>
                    )}

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
