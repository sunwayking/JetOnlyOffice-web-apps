/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, {useEffect, useState} from 'react';
import {Icon} from 'framework7-react';
import {inject, observer} from 'mobx-react';
import {useTranslation} from 'react-i18next';
import {Device} from '../../../../common/mobile/utils/device';
import SvgIcon from '@common/lib/component/SvgIcon';
import IconBold from '@common-icons/icon-bold.svg';
import IconItalic from '@common-icons/icon-italic.svg';
import IconUnderline from '@common-icons/icon-underline.svg';
import IconTextColor from '@common-icons/icon-text-color.svg';
import IconAlign from '@common-icons/icon-text-align-left.svg';
import IconBullets from '@common-icons/icon-bullets.svg';
import {
    executeWordCommand,
    getWordEditorRuntime,
    subscribeWordEditorRuntime
} from '../lib/wordEditorRuntime.mjs';
import {WORD_COMMAND_IDS} from '../lib/wordCommandCatalog.mjs';

const QuickButton = ({active, label, onClick, children}) => (
    <button
        type="button"
        className={`word-quick-toolbar__button${active ? ' active' : ''}`}
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        title={label}
        onClick={onClick}
    >
        {children}
    </button>
);

const QuickToolbar = inject('storeAppOptions', 'storeTextSettings', 'users')(observer(({isOpenModal, openOptions, storeAppOptions, storeTextSettings, users}) => {
    const {t} = useTranslation();
    const [session, setSession] = useState(() => getWordEditorRuntime()?.getSession() ?? null);

    useEffect(() => {
        let detachSession;
        const detachRuntime = subscribeWordEditorRuntime(runtime => {
            detachSession?.();
            detachSession = runtime?.subscribe(nextSession => setSession(nextSession));
            if (!runtime) {
                setSession(null);
            }
        });
        return () => {
            detachSession?.();
            detachRuntime();
        };
    }, []);

    const canMutate = session?.open?.phase === 'ready' &&
        session?.transport?.state === 'connected' && session?.save?.state !== 'blocking-failed';
    if (!Device.phone || isOpenModal || !storeAppOptions.isDocReady || storeAppOptions.isViewer ||
        !storeAppOptions.isEdit || users.isDisconnected || !canMutate) {
        return null;
    }

    const editText = t('Edit', {returnObjects: true});
    const collaborationText = t('Common.Collaboration', {returnObjects: true});
    const hideKeyboard = () => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        Common.EditorApi.get().asc_enableKeyEvents(false, true);
    };

    return (
        <div className="word-quick-toolbar" role="toolbar" aria-label={collaborationText.textEdit}>
            <QuickButton active={storeTextSettings.isBold} label={collaborationText.textBold}
                         onClick={() => executeWordCommand(WORD_COMMAND_IDS.BOLD, {value: !storeTextSettings.isBold})}>
                <SvgIcon symbolId={IconBold.id} className="icon icon-svg" />
            </QuickButton>
            <QuickButton active={storeTextSettings.isItalic} label={collaborationText.textItalic}
                         onClick={() => executeWordCommand(WORD_COMMAND_IDS.ITALIC, {value: !storeTextSettings.isItalic})}>
                <SvgIcon symbolId={IconItalic.id} className="icon icon-svg" />
            </QuickButton>
            <QuickButton active={storeTextSettings.isUnderline} label={collaborationText.textUnderline}
                         onClick={() => executeWordCommand(WORD_COMMAND_IDS.UNDERLINE, {value: !storeTextSettings.isUnderline})}>
                <SvgIcon symbolId={IconUnderline.id} className="icon icon-svg" />
            </QuickButton>
            <QuickButton label={editText.textFontColor} onClick={() => openOptions('edit')}>
                <SvgIcon symbolId={IconTextColor.id} className="icon icon-svg" />
            </QuickButton>
            <QuickButton label={editText.textAlign} onClick={() => openOptions('edit')}>
                <SvgIcon symbolId={IconAlign.id} className="icon icon-svg" />
            </QuickButton>
            <QuickButton label={editText.textBulletsAndNumbers} onClick={() => openOptions('edit')}>
                <SvgIcon symbolId={IconBullets.id} className="icon icon-svg" />
            </QuickButton>
            <QuickButton label={t('Toolbar.textHideKeyboard')} onClick={hideKeyboard}>
                <Icon material="keyboard_hide" />
            </QuickButton>
        </div>
    );
}));

export default QuickToolbar;
