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
import inventory from '../commands/desktop-command-inventory.json';
import {createSpreadsheetCommandProvider} from './commandProvider.mjs';
import {
    buildSpreadsheetContextMenuItems,
    createSpreadsheetFocusInterface,
    isSpreadsheetObjectSelection,
} from './spreadsheetUiModel.mjs';

const provider = createSpreadsheetCommandProvider({
    inventory,
    getApi: () => Common.EditorApi && Common.EditorApi.get(),
});

const apiRegistrations = new WeakMap();

function registerOnce(key, eventName, handler) {
    const api = Common.EditorApi.get();
    if (!api) return;
    let registrations = apiRegistrations.get(api);
    if (!registrations) {
        registrations = new Map();
        apiRegistrations.set(api, registrations);
    }
    if (registrations.has(key)) return;
    api.asc_registerCallback(eventName, handler);
    registrations.set(key, {eventName, handler});
}

const EditorUIController = () => null;

EditorUIController.isSupportEditFeature = () => true;
EditorUIController.getCommandProvider = () => provider;

EditorUIController.toolbarOptions = {
    getUndoRedo: ({disabledUndo, disabledRedo, onUndoClick, onRedoClick}) => [
        <Link iconOnly key='undo' className={disabledUndo ? 'disabled' : ''} href={false} onClick={onUndoClick}>
            <SvgIcon symbolId={(Device.ios ? IconUndoIos : IconUndoAndroid).id} className='icon icon-svg' />
        </Link>,
        <Link iconOnly key='redo' className={disabledRedo ? 'disabled' : ''} href={false} onClick={onRedoClick}>
            <SvgIcon symbolId={(Device.ios ? IconRedoIos : IconRedoAndroid).id} className='icon icon-svg' />
        </Link>,
    ],
    getEditOptions: ({disabledEdit, disabledAdd, onEditClick, onAddClick}) => [
        <Link iconOnly key='edit-options' className={disabledEdit ? 'disabled' : ''} href={false} onClick={onEditClick}>
            <SvgIcon symbolId={(Device.ios ? IconEditIos : IconEditAndroid).id} className='icon icon-svg' />
        </Link>,
        <Link iconOnly key='add-options' className={disabledAdd ? 'disabled' : ''} href={false} onClick={onAddClick}>
            <SvgIcon symbolId={(Device.ios ? IconPlusIos : IconPlusAndroid).id} className='icon icon-svg' />
        </Link>,
    ],
};

EditorUIController.initCellInfo = props => {
    const api = Common.EditorApi.get();
    const focusStore = props.storeFocusObjects;
    if (!focusStore.intf) {
        focusStore.intf = createSpreadsheetFocusInterface(focusStore, {
            selectionTypes: Asc.c_oAscSelectionType,
            selectElementTypes: Asc.c_oAscTypeSelectElement,
        });
    }

    const synchronizeSelection = cellInfo => {
        if (!cellInfo) return;
        focusStore.resetCellInfo(cellInfo);
        focusStore.resetFocusObjects(api.asc_getGraphicObjectProps?.() || []);
        focusStore.changeFocus(isSpreadsheetObjectSelection(cellInfo, Asc.c_oAscSelectionType));
        focusStore.setIsLocked(cellInfo);
        props.storeCellSettings.initCellSettings(cellInfo);
        props.storeTextSettings.initTextSettings(cellInfo);
    };

    registerOnce('selection', 'asc_onSelectionChanged', synchronizeSelection);
    synchronizeSelection(api.asc_getCellInfo?.());
};

EditorUIController.initEditorStyles = store => {
    registerOnce('editor-styles', 'asc_onInitEditorStyles', styles => store.initCellStyles(styles));
};

EditorUIController.initFonts = props => {
    registerOnce('editor-fonts', 'asc_onInitEditorFonts', (fonts, select) => {
        props.storeCellSettings.initEditorFonts(fonts, select);
        props.storeTextSettings.initEditorFonts(fonts, select);
    });
};

EditorUIController.initThemeColors = () => {
    registerOnce('theme-colors', 'asc_onSendThemeColors', (colors, standardColors) => {
        Common.Utils.ThemeColor.setColors(colors, standardColors);
    });
};

EditorUIController.ContextMenu = {
    mapMenuItems(controller) {
        const api = Common.EditorApi.get();
        const cellInfo = api.asc_getCellInfo();
        const labels = controller.props.t('ContextMenu', {returnObjects: true});
        const locked = cellInfo.asc_getLocked?.() === true || controller.props.wsLock === true;

        return buildSpreadsheetContextMenuItems({
            cellInfo,
            selectionTypes: Asc.c_oAscSelectionType,
            labels,
            canCopy: controller.props.canCopy !== false && api.can_CopyCut?.() !== false,
            canCutPaste: controller.props.canCopy !== false && api.can_CopyCut?.() !== false,
            canViewComments: controller.props.canViewComments === true,
            canAddComments: controller.props.canCoAuthoring === true && controller.props.canComments === true,
            isResolvedComments: controller.props.isResolvedComments === true,
            isDisconnected: controller.props.isDisconnected === true,
            isVersionHistoryMode: controller.props.isVersionHistoryMode === true,
            isLocked: locked,
            isCellEdited: api.isCellEdited === true,
            canFillHandle: api.asc_canFillHandle?.() === true,
        });
    },

    handleMenuItemClick(controller, action) {
        if (action === 'addcomment') {
            Common.Notifications.trigger('addcomment');
            return true;
        }
        return false;
    },
};

EditorUIController.dispose = () => {
    const api = Common.EditorApi?.get();
    const registrations = api && apiRegistrations.get(api);
    if (!registrations) return;
    registrations.forEach(({eventName, handler}) => api.asc_unregisterCallback(eventName, handler));
    registrations.clear();
    apiRegistrations.delete(api);
};

export default EditorUIController;
