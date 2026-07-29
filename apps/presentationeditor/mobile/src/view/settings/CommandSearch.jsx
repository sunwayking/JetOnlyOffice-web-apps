/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, {useContext, useEffect, useMemo, useState} from 'react';
import {List, ListInput, ListItem, Navbar, Page} from 'framework7-react';
import {inject, observer} from 'mobx-react';
import {useTranslation} from 'react-i18next';

import auditedInventory from '../../commands/desktop-command-inventory.json';
import {SettingsContext} from '../../controller/settings/Settings';
import {createPresentationCommandInventory} from '../../lib/presentationCommandCatalog.mjs';
import {searchAvailablePresentationCommands} from '../../lib/presentationCommandSearch.mjs';
import {
    getPresentationEditorRuntime,
    subscribePresentationEditorRuntime,
} from '../../lib/presentationEditorRuntime.mjs';
import {describePresentationSelection} from '../../lib/presentationUiModel.mjs';
import {MainContext} from '../../page/main';

const inventory = createPresentationCommandInventory(auditedInventory);

const selectionTypes = () => ({
    slide: Asc.c_oAscTypeSelectElement.Slide,
    paragraph: Asc.c_oAscTypeSelectElement.Paragraph,
    image: Asc.c_oAscTypeSelectElement.Image,
    table: Asc.c_oAscTypeSelectElement.Table,
    shape: Asc.c_oAscTypeSelectElement.Shape,
    chart: Asc.c_oAscTypeSelectElement.Chart,
    hyperlink: Asc.c_oAscTypeSelectElement.Hyperlink,
});

const CommandSearch = inject('storeAppOptions')(observer(props => {
    const {i18n, t} = useTranslation();
    const mainContext = useContext(MainContext);
    const settingsContext = useContext(SettingsContext);
    const [query, setQuery] = useState('');
    const [runtime, setRuntime] = useState(() => getPresentationEditorRuntime());
    const [runtimeRevision, setRuntimeRevision] = useState(0);

    useEffect(() => {
        let detachSession;
        const detachRuntime = subscribePresentationEditorRuntime(nextRuntime => {
            detachSession?.();
            setRuntime(nextRuntime);
            setRuntimeRevision(revision => revision + 1);
            detachSession = nextRuntime?.subscribe(() => {
                setRuntimeRevision(revision => revision + 1);
            });
        });
        return () => {
            detachSession?.();
            detachRuntime();
        };
    }, []);

    const commands = useMemo(() => {
        let contexts = ['presentation'];
        try {
            const selection = runtime?.getSelection() ?? [];
            contexts = ['presentation', ...describePresentationSelection(selection, selectionTypes()).contexts];
        } catch {
            contexts = ['presentation'];
        }
        return searchAvailablePresentationCommands({
            runtime,
            commands: inventory.commands,
            contexts,
            format: props.storeAppOptions.fileType,
            locale: i18n.language,
            query,
        });
    }, [i18n.language, props.storeAppOptions.fileType, query, runtime, runtimeRevision]);

    const openTarget = target => {
        if (target.panel === 'settings') {
            if (target.route) props.f7router.navigate(target.route);
            return;
        }
        settingsContext.closeModal();
        if (target.kind === 'panel') mainContext.openOptions(target.panel);
    };

    return (
        <Page>
            <Navbar title={t('View.Settings.textCommandSearch')} backLink={t('View.Settings.textBack')} />
            <List noHairlinesBetween>
                <ListInput
                    type='search'
                    value={query}
                    placeholder={t('View.Settings.textCommandSearchPlaceholder')}
                    clearButton
                    onInput={event => setQuery(event.target.value)}
                />
            </List>
            <List noHairlinesBetween>
                {commands.map(command => (
                    <ListItem
                        key={command.id}
                        title={command.label}
                        link='#'
                        onClick={() => openTarget(command.target)}
                    />
                ))}
                {!commands.length && <ListItem title={t('View.Settings.textNoCommands')} />}
            </List>
        </Page>
    );
}));

export default CommandSearch;
