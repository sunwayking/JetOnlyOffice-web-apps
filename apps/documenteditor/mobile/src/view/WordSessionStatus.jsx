/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, {useEffect, useState} from 'react';
import {Button} from 'framework7-react';
import {useTranslation} from 'react-i18next';

import {WORD_COMMAND_IDS} from '../lib/wordCommandCatalog.mjs';
import {
    executeWordCommand,
    getWordEditorRuntime,
    subscribeWordEditorRuntime
} from '../lib/wordEditorRuntime.mjs';
import {presentWordSession} from '../lib/wordSessionPresentation.mjs';
import {requestWordSessionReopen} from '../lib/wordSessionRecovery.mjs';

const WordSessionStatus = ({openOptions}) => {
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

    const presentation = presentWordSession(session);
    if (presentation.kind === 'none') {
        return null;
    }

    if (presentation.kind === 'status') {
        return (
            <div className={`word-session-status word-session-status--${presentation.code}`} role="status" aria-live="polite">
                <span>{t(presentation.messageKey)}</span>
                {presentation.code === 'retryable-save' &&
                    <Button small onClick={() => executeWordCommand(WORD_COMMAND_IDS.SAVE)}>
                        {t('Session.textRetry')}
                    </Button>
                }
            </div>
        );
    }

    const reopenSession = () => requestWordSessionReopen({
        getApi: () => Common.EditorApi.get(),
        confirmDiscard: () => typeof window.confirm === 'function' && window.confirm(t('Session.textDiscardConfirm')),
        reload: () => window.location.reload()
    });

    return (
        <div className="word-session-recovery" role="alertdialog" aria-modal="true" aria-labelledby="word-session-recovery-title">
            <div className="word-session-recovery__content">
                <h2 id="word-session-recovery-title">{t('Session.textRecoveryTitle')}</h2>
                <p>{t(presentation.messageKey)}</p>
                <div className="word-session-recovery__actions">
                    <Button fill onClick={() => openOptions('settings')}>{t('Session.textOpenSettings')}</Button>
                    {presentation.code === 'fatal' &&
                        <Button outline onClick={reopenSession}>{t('Session.textReopen')}</Button>
                    }
                    <Button outline onClick={() => Common.Notifications.trigger('goback')}>
                        {t('Session.textReturn')}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default WordSessionStatus;
