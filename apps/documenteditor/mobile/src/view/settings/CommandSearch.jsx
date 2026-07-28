/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, {useContext, useMemo, useState} from 'react';
import {List, ListInput, ListItem, Navbar, Page} from 'framework7-react';
import {useTranslation} from 'react-i18next';

import {SettingsContext} from '../../controller/settings/Settings';
import {getWordEditorRuntime} from '../../lib/wordEditorRuntime.mjs';
import {
    getWordSelectionContexts,
    searchAvailableWordCommands
} from '../../lib/wordCommandSearch.mjs';
import {MainContext} from '../../page/main';

const CommandSearch = () => {
    const {i18n, t} = useTranslation();
    const {openOptions} = useContext(MainContext);
    const settingsContext = useContext(SettingsContext);
    const [query, setQuery] = useState('');
    const commands = useMemo(() => {
        const runtime = getWordEditorRuntime();
        const contexts = getWordSelectionContexts(runtime?.getSelection() ?? []);
        return searchAvailableWordCommands({runtime, locale: i18n.language, query, contexts});
    }, [i18n.language, query]);

    const openCommandPanel = command => {
        if (command.target === 'settings') {
            return;
        }
        settingsContext.closeModal();
        if (command.target !== 'editor') {
            openOptions(command.target);
        }
    };

    return (
        <Page>
            <Navbar title={t('Settings.textCommandSearch')} backLink={t('Settings.textBack')} />
            <List noHairlinesBetween>
                <ListInput
                    type="search"
                    value={query}
                    placeholder={t('Settings.textCommandSearchPlaceholder')}
                    clearButton
                    onInput={event => setQuery(event.target.value)}
                />
            </List>
            <List noHairlinesBetween>
                {commands.map(command => (
                    <ListItem
                        key={command.id}
                        title={command.label}
                        link={command.target === 'settings' ? '/settings/' : '#'}
                        onClick={() => openCommandPanel(command)}
                    />
                ))}
                {!commands.length && <ListItem title={t('Settings.textNoCommands')} />}
            </List>
        </Page>
    );
};

export default CommandSearch;
