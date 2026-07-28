/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const SDK_DEPENDENCY_SCRIPTS = Object.freeze([
    '../../../vendor/xregexp/xregexp-all-min.js',
    '../../../vendor/socketio/socket.io.min.js',
]);

const DEFAULT_SDK_SCRIPTS = Object.freeze([
    '../../../../sdkjs/common/AllFonts.js',
    '../../../../sdkjs/word/sdk-all-min.js',
]);

const DEFAULT_SCRIPTS = Object.freeze([...SDK_DEPENDENCY_SCRIPTS, ...DEFAULT_SDK_SCRIPTS]);

const bootstrapError = (code, message, cause) => {
    const error = new Error(message, cause ? {cause} : undefined);
    error.code = code;
    return error;
};

export async function loadPdfSdkScripts({document, scripts = DEFAULT_SCRIPTS}) {
    for (const source of scripts) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = source;
            script.onload = resolve;
            script.onerror = () => reject(bootstrapError(
                'MOBILE_PDF_SDK_SCRIPT_FAILED',
                `Unable to load PDF SDK input: ${source}`,
            ));
            document.body.appendChild(script);
        });
    }
}

const callSetter = (target, name, value) => {
    if (typeof target[name] !== 'function') {
        throw bootstrapError('MOBILE_PDF_SDK_CONTRACT_INVALID', `PDF SDK object is missing ${name}()`);
    }
    target[name](value);
};

function createUserInfo(Asc, user = {}) {
    const value = new Asc.asc_CUserInfo();
    callSetter(value, 'put_Id', user.id);
    callSetter(value, 'put_FullName', user.fullname || user.name || 'Anonymous');
    callSetter(value, 'put_IsAnonymousUser', user.anonymous === true);
    return value;
}

function createDocumentInfo(Asc, editorConfig, documentConfig) {
    if (!documentConfig) {
        throw bootstrapError('MOBILE_PDF_DOCUMENT_MISSING', 'Gateway did not provide a PDF document');
    }
    const info = new Asc.asc_CDocInfo();
    const options = {...(documentConfig.options || {}), ...(editorConfig.actionLink || {})};
    const values = [
        ['put_Id', documentConfig.key],
        ['put_Url', documentConfig.url],
        ['put_DirectUrl', documentConfig.directUrl],
        ['put_Title', documentConfig.title],
        ['put_Format', documentConfig.fileType],
        ['put_VKey', documentConfig.vkey],
        ['put_Options', options],
        ['put_UserInfo', createUserInfo(Asc, editorConfig.user)],
        ['put_CallbackUrl', editorConfig.callbackUrl],
        ['put_Token', documentConfig.token],
        ['put_Permissions', documentConfig.permissions],
        ['put_EncryptedInfo', editorConfig.encryptionKeys],
        ['put_Lang', editorConfig.lang],
        ['put_Mode', editorConfig.mode],
        ['put_SupportsOnSaveDocument', editorConfig.canSaveDocumentToBinary],
        ['put_Wopi', editorConfig.wopi],
        ['put_CoEditingMode', editorConfig.coEditing?.mode || 'fast'],
    ];
    values.forEach(([name, value]) => callSetter(info, name, value));
    if (editorConfig.shardkey !== undefined) callSetter(info, 'put_Shardkey', editorConfig.shardkey);
    return info;
}

function isRejectedLicense(Asc, params) {
    const result = params.asc_getLicenseType();
    const rejected = [
        'Expired',
        'Error',
        'ExpiredTrial',
        'NotBefore',
        'ExpiredLimited',
    ].map(name => Asc.c_oLicenseResult?.[name]).filter(value => value !== undefined);
    return rejected.includes(result);
}

function isEditingLicense(Asc, params) {
    const result = params.asc_getLicenseType();
    return [Asc.c_oLicenseResult?.Success, Asc.c_oLicenseResult?.SuccessLimit]
        .filter(value => value !== undefined)
        .includes(result);
}

function resolvePermissionOptions({Asc, editorConfig, documentConfig, params}) {
    const permissions = {...(documentConfig.permissions || {})};
    const rights = typeof params.asc_getRights === 'function' ? params.asc_getRights() : Asc.c_oRights.View;
    if (!isEditingLicense(Asc, params)) {
        permissions.edit = permissions.review = permissions.comment = permissions.fillForms = false;
    } else if (rights === Asc.c_oRights.Review) {
        permissions.edit = false;
        permissions.fillForms = false;
    } else if (rights === Asc.c_oRights.Comment) {
        permissions.edit = false;
        permissions.review = false;
        permissions.fillForms = false;
    } else if (rights !== Asc.c_oRights.Edit) {
        permissions.edit = permissions.review = permissions.comment = permissions.fillForms = false;
    }
    const forceView = editorConfig.customization?.mobile?.forceView === true ||
        editorConfig.customization?.mobileForceView === true ||
        editorConfig.mobileForceView === true;
    const editable = editorConfig.mode !== 'view' && permissions.edit !== false && !forceView;
    const fillForms = editorConfig.mode !== 'view' && permissions.fillForms === true && !forceView;
    return {
        forceView,
        permissions,
        appOptions: {
            isEdit: editable,
            isReviewOnly: !editable && permissions.review === true,
            isForm: !editable && fillForms,
            canReview: permissions.review === true,
            canComments: editorConfig.mode !== 'view' && permissions.comment !== false && !forceView,
            canFillForms: fillForms || editable,
        },
    };
}

export function createPdfSdkBootstrap({window, gateway, bridge, loadScripts = loadPdfSdkScripts}) {
    let api = null;
    let editorConfig = {};
    let documentConfig = null;
    let permissionsInitialized = false;

    const reportError = error => {
        bridge.reportBootstrapError(error);
        return error;
    };

    const onDocumentReady = () => {
        api.SetDrawingFreeze(false);
        api.Resize();
        if (typeof api.zoomFitToWidth === 'function') api.zoomFitToWidth();
        bridge.restoreEditorState();
        gateway.sendInfo({mode: editorConfig.mode === 'view' ? 'view' : 'edit'});
        gateway.documentReady();
    };

    const onEditorPermissions = params => {
        if (isRejectedLicense(window.Asc, params)) {
            reportError(bootstrapError('MOBILE_PDF_LICENSE_REJECTED', 'PDF editor license rejected the session'));
            return;
        }
        const options = resolvePermissionOptions({
            Asc: window.Asc,
            editorConfig,
            documentConfig,
            params,
        });
        bridge.updatePermissions(options);
        const canEdit = options.appOptions.isEdit;
        const canFillForms = options.appOptions.canFillForms && !canEdit;
        const canComment = options.appOptions.canComments && !canEdit && !canFillForms;
        const canChange = canEdit || canFillForms || canComment;
        api.asc_setPdfViewer(!canChange);
        api.asc_setViewMode(!canChange);
        api.asc_setCanSendChanges(canChange);
        api.asc_setRestriction(canEdit
            ? window.Asc.c_oAscRestrictionType.None
            : canFillForms
                ? window.Asc.c_oAscRestrictionType.OnlyForms
                : canComment
                    ? window.Asc.c_oAscRestrictionType.OnlyComments
                    : window.Asc.c_oAscRestrictionType.View);
        permissionsInitialized = true;
        api.asc_LoadDocument();
    };

    const loadDocument = data => {
        documentConfig = data?.doc;
        permissionsInitialized = false;
        try {
            bridge.setDocumentContext({
                key: documentConfig?.key,
                title: documentConfig?.title,
            });
            api.asc_setDocInfo(createDocumentInfo(window.Asc, editorConfig, documentConfig));
            api.asc_getEditorPermissions();
        } catch (error) {
            reportError(error);
        }
    };

    const bindApi = () => {
        api.asc_registerCallback('asc_onGetEditorPermissions', onEditorPermissions);
        api.asc_registerCallback('asc_onDocumentContentReady', onDocumentReady);
        api.asc_registerCallback('asc_onDocumentModifiedChanged', () => {
            const modified = api.isDocumentModified();
            gateway.setDocumentModified(modified);
            bridge.updateDocumentModified(modified);
        });
        api.asc_registerCallback('asc_onDownloadUrl', (url, fileType) => gateway.downloadAs(url, fileType));
        api.asc_registerCallback('asc_onError', (id, level, data) => reportError(Object.assign(
            bootstrapError('MOBILE_PDF_SDK_ERROR', `PDF SDK error ${id}`),
            {id, level, data},
        )));
        api.asc_registerCallback('asc_onCoAuthoringDisconnect', () => {
            bridge.updatePermissions({profile: 'view'});
        });
    };

    return Object.freeze({
        async start() {
            try {
                await loadScripts({
                    document: window.document,
                    scripts: window.sdk_scripts
                        ? [...SDK_DEPENDENCY_SCRIPTS, ...window.sdk_scripts]
                        : DEFAULT_SCRIPTS,
                });
                if (typeof window.Asc?.PDFEditorApi !== 'function') {
                    throw bootstrapError('MOBILE_PDF_SDK_UNAVAILABLE', 'Asc.PDFEditorApi is not available');
                }
                api = new window.Asc.PDFEditorApi({
                    'id-view': 'editor_sdk',
                    mobile: true,
                    translate: {},
                    isRtlInterface: window.Common?.Locale?.isCurrentLangRtl === true,
                });
                api.SetDrawingFreeze(true);
                bindApi();
                // Runtime callbacks must exist before permission discovery opens the transport.
                bridge.attachEditorApi(api, {profile: 'view'});
                gateway.on('init', data => {
                    editorConfig = {...editorConfig, ...(data?.config || {})};
                    if (editorConfig.lang) api.asc_setLocale(editorConfig.lang);
                });
                gateway.on('opendocument', loadDocument);
                gateway.on('processrightschange', data => {
                    if (data?.enabled === false) {
                        bridge.updatePermissions({profile: 'view'});
                        api.asc_coAuthoringDisconnect();
                    }
                });
                gateway.on('downloadas', data => api.asc_DownloadAs(data));
                gateway.on('requestclose', () => bridge.handleBack());
                gateway.appReady();
                return api;
            } catch (error) {
                throw reportError(error);
            }
        },
        getApi: () => api,
        isPermissionsInitialized: () => permissionsInitialized,
    });
}

export {DEFAULT_SCRIPTS, SDK_DEPENDENCY_SCRIPTS};
