/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const hiddenPresentation = Object.freeze({kind: 'none'});

export function presentWordSession(session) {
    const openPhase = session?.open?.phase ?? 'idle';
    const transportState = session?.transport?.state ?? 'idle';
    const saveState = session?.save?.state ?? 'idle';

    if (['fatal-error', 'failed'].includes(openPhase)) {
        return Object.freeze({kind: 'recovery', code: 'fatal', messageKey: 'Session.textFatal'});
    }
    if (['conflict', 'version-conflict'].includes(saveState)) {
        return Object.freeze({kind: 'recovery', code: 'conflict', messageKey: 'Session.textConflict'});
    }
    if (saveState === 'blocking-failed') {
        return Object.freeze({kind: 'recovery', code: 'blocking-save', messageKey: 'Session.textBlockingSave'});
    }
    if (['reconnecting', 'reconciling', 'closed'].includes(transportState)) {
        return Object.freeze({kind: 'status', code: 'connection', messageKey: 'Session.textReconnecting'});
    }
    if (saveState === 'retryable-failed') {
        return Object.freeze({kind: 'status', code: 'retryable-save', messageKey: 'Session.textRetryableSave'});
    }
    if (['pending', 'saving', 'retrying'].includes(saveState)) {
        return Object.freeze({kind: 'status', code: 'saving', messageKey: 'Session.textSaving'});
    }
    if (!['idle', 'ready'].includes(openPhase)) {
        return Object.freeze({kind: 'status', code: 'opening', messageKey: 'Session.textOpening'});
    }
    return hiddenPresentation;
}
