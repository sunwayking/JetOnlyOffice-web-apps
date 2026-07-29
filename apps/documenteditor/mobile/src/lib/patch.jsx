/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';
import {Link} from 'framework7-react';
import {Device} from '../../../../common/mobile/utils/device';
import SvgIcon from '../../../../common/mobile/lib/component/SvgIcon';
import IconEditIos from '@common-ios-icons/icon-edit.svg?ios';
import IconEditAndroid from '@common-android-icons/icon-edit.svg';
import IconPlusIos from '@common-ios-icons/icon-plus.svg?ios';
import IconPlusAndroid from '@common-android-icons/icon-plus.svg';
import IconUndoIos from '@common-ios-icons/icon-undo.svg?ios';
import IconUndoAndroid from '@common-android-icons/icon-undo.svg';
import IconRedoIos from '@common-ios-icons/icon-redo.svg?ios';
import IconRedoAndroid from '@common-android-icons/icon-redo.svg';
import {getWordGraphicContexts} from './wordSelectionContext.mjs';
import {getWordEditorRuntime} from './wordEditorRuntime.mjs';
import {WORD_COMMAND_IDS} from './wordCommandCatalog.mjs';

const apiRegistrations = new WeakMap();

function registerOnce(key, eventName, handler) {
    const api = Common.EditorApi.get();
    if (!api) {
        return;
    }
    let registrations = apiRegistrations.get(api);
    if (!registrations) {
        registrations = new Map();
        apiRegistrations.set(api, registrations);
    }
    if (registrations.has(key)) {
        return;
    }
    api.asc_registerCallback(eventName, handler);
    registrations.set(key, {eventName, handler});
}

function getFocusValue(store, type) {
    for (const item of store._focusObjects) {
        if (item.get_ObjectType() === type) {
            return item.get_ObjectValue();
        }
    }
    return null;
}

function getGraphicFocusValue(store, context) {
    for (const item of store._focusObjects) {
        if (item.get_ObjectType() === Asc.c_oAscTypeSelectElement.Image &&
            getWordGraphicContexts(item.get_ObjectValue()).includes(context)) {
            return item.get_ObjectValue();
        }
    }
    return null;
}

function isCommandAvailable(commandId) {
    return getWordEditorRuntime()?.resolve(commandId)?.available === true;
}

function createFocusInterface(store) {
    const typeTokens = new Map([
        [Asc.c_oAscTypeSelectElement.Header, ['header']],
        [Asc.c_oAscTypeSelectElement.Paragraph, ['text', 'paragraph']],
        [Asc.c_oAscTypeSelectElement.Text, ['text']],
        [Asc.c_oAscTypeSelectElement.Table, ['table']],
        [Asc.c_oAscTypeSelectElement.Hyperlink, ['hyperlink']],
        [Asc.c_oAscTypeSelectElement.SpellCheck, ['spellcheck']]
    ]);
    return {
        filterFocusObjects() {
            return Array.from(new Set(store._focusObjects
                .reduce((tokens, item) => {
                    const type = item.get_ObjectType();
                    return tokens.concat(type === Asc.c_oAscTypeSelectElement.Image
                        ? getWordGraphicContexts(item.get_ObjectValue())
                        : typeTokens.get(type) || []);
                }, [])));
        },
        getHeaderObject: () => getFocusValue(store, Asc.c_oAscTypeSelectElement.Header),
        getParagraphObject: () => getFocusValue(store, Asc.c_oAscTypeSelectElement.Paragraph),
        getShapeObject: () => getGraphicFocusValue(store, 'shape'),
        getImageObject: () => getGraphicFocusValue(store, 'image'),
        getTableObject: () => getFocusValue(store, Asc.c_oAscTypeSelectElement.Table),
        getChartObject: () => getGraphicFocusValue(store, 'chart'),
        getLinkObject: () => getFocusValue(store, Asc.c_oAscTypeSelectElement.Hyperlink)
    };
}

const EditorUIController = () => null;

EditorUIController.isSupportEditFeature = () => true;

EditorUIController.getToolbarOptions = ({disabledEdit, disabledAdd, onEditClick, onAddClick}) => [
    <Link iconOnly key='edit-options' className={disabledEdit ? 'disabled' : ''} href={false} onClick={onEditClick}>
        <SvgIcon symbolId={(Device.ios ? IconEditIos : IconEditAndroid).id} className='icon icon-svg' />
    </Link>,
    <Link iconOnly key='add-options' className={disabledAdd ? 'disabled' : ''} href={false} onClick={onAddClick}>
        <SvgIcon symbolId={(Device.ios ? IconPlusIos : IconPlusAndroid).id} className='icon icon-svg' />
    </Link>
];

EditorUIController.getUndoRedo = ({disabledUndo, disabledRedo, onUndoClick, onRedoClick}) => [
    <Link iconOnly key='undo' className={disabledUndo ? 'disabled' : ''} href={false} onClick={onUndoClick}>
        <SvgIcon symbolId={(Device.ios ? IconUndoIos : IconUndoAndroid).id} className='icon icon-svg' />
    </Link>,
    <Link iconOnly key='redo' className={disabledRedo ? 'disabled' : ''} href={false} onClick={onRedoClick}>
        <SvgIcon symbolId={(Device.ios ? IconRedoIos : IconRedoAndroid).id} className='icon icon-svg' />
    </Link>
];

EditorUIController.initThemeColors = () => {
    registerOnce('theme-colors', 'asc_onSendThemeColors', (colors, standardColors) => {
        Common.Utils.ThemeColor.setColors(colors, standardColors);
    });
};

EditorUIController.initFonts = store => {
    registerOnce('editor-fonts', 'asc_onInitEditorFonts', (fonts, select) => {
        store.initEditorFonts(fonts, select);
    });
};

EditorUIController.initEditorStyles = store => {
    registerOnce('editor-styles', 'asc_onInitEditorStyles', styles => {
        store.initEditorStyles(styles);
    });
};

EditorUIController.initFocusObjects = store => {
    if (!store.intf) {
        store.intf = createFocusInterface(store);
    }
    registerOnce('focus-objects', 'asc_onFocusObject', objects => {
        store.resetFocusObjects(objects || []);
    });
};

EditorUIController.initTableTemplates = store => {
    registerOnce('table-templates', 'asc_onInitTableTemplates', () => {
        const api = Common.EditorApi.get();
        store.setStyles(api.asc_getTableStylesPreviews(), 'default');
    });
};

EditorUIController.updateChartStyles = store => {
    registerOnce('chart-styles', 'asc_onUpdateChartStyles', type => {
        const api = Common.EditorApi.get();
        store.updateChartStyles(api.asc_getChartPreviews(type));
    });
};

EditorUIController.dispose = () => {
    const api = Common.EditorApi?.get();
    const registrations = api && apiRegistrations.get(api);
    if (!registrations) {
        return;
    }
    registrations.forEach(({eventName, handler}) => {
        api.asc_unregisterCallback(eventName, handler);
    });
    registrations.clear();
    apiRegistrations.delete(api);
};

EditorUIController.ContextMenu = {
    mapMenuItems(controller) {
        const {t} = controller.props;
        const labels = t('ContextMenu', {returnObjects: true});
        const api = Common.EditorApi.get();
        const stack = api.getSelectedElements();
        const {
            canComments,
            canCoAuthoring,
            canFillForms,
            canEditComments,
            canViewComments,
            isDisconnected,
            isForm,
            isProtected,
            isViewer,
            typeProtection
        } = controller.props;
        let locked = false;
        let hasText = false;
        let hasImage = false;
        let hasTable = false;
        let hasShape = false;
        let hasChart = false;
        let hasLink = false;

        stack.forEach(item => {
            const objectType = item.get_ObjectType();
            const value = item.get_ObjectValue();
            locked = locked || (typeof value?.get_Locked === 'function' && value.get_Locked());
            hasText = hasText || objectType === Asc.c_oAscTypeSelectElement.Paragraph;
            if (objectType === Asc.c_oAscTypeSelectElement.Image) {
                const graphicContexts = getWordGraphicContexts(value);
                hasImage = hasImage || graphicContexts.includes('image');
                hasShape = hasShape || graphicContexts.includes('shape');
                hasChart = hasChart || graphicContexts.includes('chart');
            }
            hasTable = hasTable || objectType === Asc.c_oAscTypeSelectElement.Table;
            hasLink = hasLink || objectType === Asc.c_oAscTypeSelectElement.Hyperlink;
        });

        const hasObject = hasImage || hasTable || hasShape || hasChart;

        const canEdit = !isProtected || typeProtection === Asc.c_oAscEDocProtect.TrackedChanges;
        const canComment = typeProtection === Asc.c_oAscEDocProtect.Comments;

        const items = [];
        const canCopySelection = api.can_CopyCut();
        if (canCopySelection && isCommandAvailable(WORD_COMMAND_IDS.COPY)) {
            items.push({event: 'copy', icon: 'icon-copy'});
        }
        if (!isDisconnected && canFillForms && canCopySelection && !locked &&
            (!isViewer || isForm) && canEdit) {
            if (isCommandAvailable(WORD_COMMAND_IDS.CUT)) {
                items.push({event: 'cut', icon: 'icon-cut'});
            }
            if (isCommandAvailable(WORD_COMMAND_IDS.PASTE)) {
                items.push({event: 'paste', icon: 'icon-paste'});
            }
        }
        if (!isDisconnected && !isViewer && !locked && canEdit && (hasText || hasObject) &&
            isCommandAvailable(WORD_COMMAND_IDS.DELETE)) {
            items.push({caption: labels.menuDelete, event: 'delete'});
            items.push({caption: labels.menuEdit, event: 'edit'});
            if (hasText) {
                items.push({caption: labels.menuParagraph, event: 'paragraph'});
                if (!hasLink) {
                    items.push({caption: labels.menuAddLink, event: 'addlink'});
                }
            }
            if (hasImage && isCommandAvailable(WORD_COMMAND_IDS.IMAGE_REPLACE)) {
                items.push({caption: labels.menuImage, event: 'image'});
                items.push({caption: labels.menuReplaceImage, event: 'replaceimage'});
            }
            if (hasChart && isCommandAvailable(WORD_COMMAND_IDS.CHART_EDIT_DATA)) {
                items.push({caption: labels.menuChart, event: 'chart'});
                if (typeof api.asc_editChartInFrameEditor === 'function') {
                    items.push({caption: labels.menuEditData, event: 'editdata'});
                }
            }
        }
        if (canViewComments && controller.isComments) {
            items.push({caption: labels.menuViewComment, event: 'viewcomment'});
        }
        if (!isDisconnected && api.can_AddQuotedComment() !== false && canCoAuthoring && canComments &&
            !locked && !hasObject && (hasText || !hasObject) && (!isViewer || canEditComments) &&
            (canEdit || canComment) && isCommandAvailable(WORD_COMMAND_IDS.COMMENT_ADD)) {
            items.push({caption: labels.menuAddComment, event: 'addcomment'});
        }
        if (hasLink) {
            items.push({caption: labels.menuOpenLink, event: 'openlink'});
        }
        return items;
    },

    handleMenuItemClick(controller, action) {
        if (action !== 'addcomment') {
            return false;
        }
        Common.Notifications.trigger('addcomment');
        return true;
    }
};

export default EditorUIController;
