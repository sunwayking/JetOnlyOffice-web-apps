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
import auditedInventory from '../commands/desktop-command-inventory.json';
import {createPresentationCommandProvider} from './commandProvider.mjs';
import {createPresentationCommandInventory} from './presentationCommandCatalog.mjs';
import {
    buildPresentationContextMenu,
    createPresentationFocusInterface,
    describePresentationSelection,
    resolvePresentationContextAction,
} from './presentationUiModel.mjs';

const inventory = createPresentationCommandInventory(auditedInventory);
const provider = createPresentationCommandProvider({
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

function selectionTypes() {
    return {
        slide: Asc.c_oAscTypeSelectElement.Slide,
        paragraph: Asc.c_oAscTypeSelectElement.Paragraph,
        image: Asc.c_oAscTypeSelectElement.Image,
        table: Asc.c_oAscTypeSelectElement.Table,
        shape: Asc.c_oAscTypeSelectElement.Shape,
        chart: Asc.c_oAscTypeSelectElement.Chart,
        hyperlink: Asc.c_oAscTypeSelectElement.Hyperlink,
    };
}

function mapThemes(themes) {
    const [editorThemes = [], documentThemes = []] = themes || [];
    return [
        ...editorThemes.map((theme, index) => ({
            themeId: theme.get_Index(),
            offsety: index * 40,
        })),
        ...documentThemes.map(theme => ({
            themeId: theme.get_Index(),
            imageUrl: theme.get_Image(),
            offsety: 0,
        })),
    ];
}

const EditorUIController = () => null;

EditorUIController.isSupportEditFeature = () => true;
EditorUIController.getCommandProvider = () => provider;

EditorUIController.getToolbarOptions = ({disabledEdit, disabledAdd, onEditClick, onAddClick}) => [
    <Link iconOnly key='edit-options' className={disabledEdit ? 'disabled' : ''} href={false} onClick={onEditClick}>
        <SvgIcon symbolId={(Device.ios ? IconEditIos : IconEditAndroid).id} className='icon icon-svg' />
    </Link>,
    <Link iconOnly key='add-options' className={disabledAdd ? 'disabled' : ''} href={false} onClick={onAddClick}>
        <SvgIcon symbolId={(Device.ios ? IconPlusIos : IconPlusAndroid).id} className='icon icon-svg' />
    </Link>,
];

EditorUIController.getUndoRedo = ({disabledUndo, disabledRedo, onUndoClick, onRedoClick}) => [
    <Link iconOnly key='undo' className={disabledUndo ? 'disabled' : ''} href={false} onClick={onUndoClick}>
        <SvgIcon symbolId={(Device.ios ? IconUndoIos : IconUndoAndroid).id} className='icon icon-svg' />
    </Link>,
    <Link iconOnly key='redo' className={disabledRedo ? 'disabled' : ''} href={false} onClick={onRedoClick}>
        <SvgIcon symbolId={(Device.ios ? IconRedoIos : IconRedoAndroid).id} className='icon icon-svg' />
    </Link>,
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
    registerOnce('editor-styles', 'asc_onInitEditorStyles', themes => {
        store.addArrayThemes(mapThemes(themes));
    });
    registerOnce('slide-layouts', 'asc_onUpdateLayout', layouts => {
        store.addArrayLayouts(layouts || []);
    });
    registerOnce('theme-index', 'asc_onUpdateThemeIndex', index => {
        store.changeSlideThemeIndex(index);
    });
};

EditorUIController.initFocusObjects = store => {
    if (!store.intf) {
        store.intf = createPresentationFocusInterface(store, selectionTypes());
    }
    registerOnce('focus-objects', 'asc_onFocusObject', objects => {
        store.resetFocusObjects(objects || []);
    });
};

EditorUIController.initTableTemplates = store => {
    registerOnce('table-templates', 'asc_onInitTableTemplates', () => {
        const api = Common.EditorApi.get();
        store.initTableTemplates();
        store.setStyles(api.asc_getTableStylesPreviews(true), 'default');
    });
};

EditorUIController.updateChartStyles = (store, focusObjects) => {
    registerOnce('chart-styles', 'asc_onUpdateChartStyles', () => {
        const api = Common.EditorApi.get();
        const type = focusObjects.chartObject?.getType?.();
        if (type === undefined || type === null) return;
        store.updateChartStyles(api.asc_getChartPreviews(type));
    });
};

EditorUIController.getEditCommentControllers = () => null;

EditorUIController.dispose = () => {
    const api = Common.EditorApi?.get();
    const registrations = api && apiRegistrations.get(api);
    if (!registrations) return;

    registrations.forEach(({eventName, handler}) => {
        api.asc_unregisterCallback(eventName, handler);
    });
    registrations.clear();
    apiRegistrations.delete(api);
};

EditorUIController.ContextMenu = {
    mapMenuItems(controller) {
        const api = Common.EditorApi.get();
        const labels = controller.props.t('ContextMenu', {returnObjects: true});
        const selection = describePresentationSelection(api.getSelectedElements(), selectionTypes());
        return buildPresentationContextMenu({
            api,
            labels,
            permissions: controller.props,
            selection,
            hasComments: controller.isComments,
        });
    },

    handleMenuItemClick(controller, action) {
        const resolved = resolvePresentationContextAction(action);
        if (!resolved) return false;

        if (resolved.kind === 'sdkjs') {
            const api = Common.EditorApi.get();
            if (typeof api[resolved.method] !== 'function') return false;
            api[resolved.method]();
        } else if (resolved.kind === 'panel') {
            controller.props.openOptions(resolved.target);
        } else if (resolved.kind === 'notification') {
            Common.Notifications.trigger(resolved.event);
        }
        return true;
    },
};

export default EditorUIController;
