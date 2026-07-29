/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {
    Block,
    BlockTitle,
    Button,
    Link,
    List,
    ListInput,
    ListItem,
    Navbar,
    NavLeft,
    NavRight,
    Page,
    Popover,
    Popup,
    Segmented,
    Toggle,
    View,
    f7,
} from 'framework7-react';
import {useTranslation} from 'react-i18next';
import {Device} from '../../../../common/mobile/utils/device';
import {MainContext} from '../page/main';
import EditorUIController from '../lib/patch';
import {searchSpreadsheetCommands} from '../lib/commandSearchModel.mjs';
import {createSpreadsheetImportWorkflow} from '../lib/importWorkflow.mjs';
import {createSpreadsheetAdvancedWorkflow} from '../lib/advancedCommandWorkflow.mjs';
import {activateSpreadsheetCommandDestination} from '../lib/mobileCommandAdapters.mjs';
import {
    executeSpreadsheetCommand,
    getSpreadsheetEditorRuntime,
} from '../lib/spreadsheetEditorRuntime.mjs';

const titles = Object.freeze({
    search: 'commands',
    'advanced.fill-series': 'fillSeries',
    'advanced.import-data': 'importData',
    'advanced.named-ranges': 'namedRanges',
    'advanced.outline': 'outline',
    'advanced.pivot': 'pivotTable',
    'advanced.rename': 'rename',
    'advanced.sheet-view': 'sheetViews',
    'advanced.sparkline': 'sparkline',
});

const showError = error => f7.dialog.alert(error?.message || String(error));

const ActionButton = ({children, onClick, disabled}) => (
    <Button fill onClick={onClick} disabled={disabled}>{children}</Button>
);

const NamedRangesPanel = ({workflow, text}) => {
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(null);
    const [name, setName] = useState('');
    const [range, setRange] = useState('');
    const refresh = () => setItems(workflow.listNamedRanges());

    useEffect(refresh, []);
    const choose = item => {
        setSelected(item);
        setName(item.name);
        setRange(item.range);
    };
    const apply = edit => {
        try {
            if (edit) workflow.editNamedRange(selected?.raw, {name, range, scope: selected?.scope});
            else workflow.addNamedRange({name, range, scope: selected?.scope});
            refresh();
        } catch (error) {
            showError(error);
        }
    };
    const remove = () => {
        try {
            workflow.deleteNamedRange(selected?.raw);
            setSelected(null);
            setName('');
            setRange('');
            refresh();
        } catch (error) {
            showError(error);
        }
    };

    return <>
        <List strong inset>
            {items.map(item => <ListItem
                key={`${item.name}:${item.range}`}
                radio
                name="spreadsheet-named-range"
                title={item.name}
                after={item.range}
                checked={selected?.raw === item.raw}
                onClick={() => choose(item)}
            />)}
        </List>
        <List strong inset>
            <ListInput label={text('name')} type="text" value={name} onInput={event => setName(event.target.value)} />
            <ListInput label={text('reference')} type="text" value={range} onInput={event => setRange(event.target.value)} />
        </List>
        <Block strong inset className="command-center-actions">
            <Segmented raised>
                <Button onClick={() => apply(false)}>{text('add')}</Button>
                <Button disabled={!selected} onClick={() => apply(true)}>{text('update')}</Button>
                <Button disabled={!selected} onClick={remove}>{text('delete')}</Button>
            </Segmented>
        </Block>
    </>;
};

const SheetViewsPanel = ({workflow, text}) => {
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(null);
    const refresh = () => setItems(workflow.listSheetViews());
    useEffect(refresh, []);

    const run = action => {
        try {
            action();
            refresh();
        } catch (error) {
            showError(error);
        }
    };

    return <>
        <List strong inset>
            <ListItem radio name="spreadsheet-sheet-view" title={text('defaultView')} onClick={() => run(() => workflow.activateSheetView(null))} />
            {items.map(item => <ListItem
                key={item.name}
                radio
                name="spreadsheet-sheet-view"
                title={item.name}
                checked={item.active}
                onClick={() => {
                    setSelected(item);
                    run(() => workflow.activateSheetView(item.raw));
                }}
            />)}
        </List>
        <Block strong inset>
            <Segmented raised>
                <Button onClick={() => run(workflow.createSheetView)}>{text('newView')}</Button>
                <Button disabled={!selected} onClick={() => run(() => workflow.deleteSheetView(selected.raw))}>{text('delete')}</Button>
            </Segmented>
        </Block>
    </>;
};

const PivotPanel = ({workflow, text}) => {
    const run = action => {
        try { action(); } catch (error) { showError(error); }
    };
    return <>
        <BlockTitle>{text('layout')}</BlockTitle>
        <List strong inset>
            {['compact', 'outline', 'tabular'].map(layout => <ListItem
                key={layout}
                radio
                name="spreadsheet-pivot-layout"
                title={text(layout)}
                onClick={() => run(() => workflow.setPivotLayout(layout))}
            />)}
        </List>
        <BlockTitle>{text('subtotals')}</BlockTitle>
        <List strong inset>
            {['none', 'top', 'bottom'].map(position => <ListItem
                key={position}
                radio
                name="spreadsheet-pivot-subtotals"
                title={text(position)}
                onClick={() => run(() => workflow.setPivotSubtotals(position))}
            />)}
            <ListItem title={text('blankRows')}>
                <Toggle onToggleChange={checked => run(() => workflow.setPivotBlankRows(checked))} />
            </ListItem>
        </List>
        <Block strong inset>
            <Segmented raised>
                <Button onClick={() => run(() => workflow.setPivotGrandTotals({rows: true, columns: true}))}>{text('grandTotals')}</Button>
                <Button onClick={() => run(() => workflow.setPivotGrandTotals({rows: false, columns: false}))}>{text('noTotals')}</Button>
            </Segmented>
        </Block>
        <Block strong inset>
            <Segmented raised>
                <Button onClick={() => run(() => workflow.refreshPivot('current'))}>{text('refresh')}</Button>
                <Button onClick={() => run(() => workflow.refreshPivot('all'))}>{text('refreshAll')}</Button>
            </Segmented>
        </Block>
    </>;
};

const SparklinePanel = ({workflow, text}) => {
    const run = type => {
        try { workflow.setSparklineType(type); } catch (error) { showError(error); }
    };
    return <Block strong inset>
        <Segmented raised>
            <Button onClick={() => run(0)}>{text('line')}</Button>
            <Button onClick={() => run(1)}>{text('column')}</Button>
            <Button onClick={() => run(2)}>{text('winLoss')}</Button>
        </Segmented>
    </Block>;
};

const OutlinePanel = ({workflow, text}) => {
    const run = (group, rows) => {
        try { workflow.changeOutline({group, rows}); } catch (error) { showError(error); }
    };
    return <>
        <BlockTitle>{text('group')}</BlockTitle>
        <Block strong inset><Segmented raised>
            <Button onClick={() => run(true, true)}>{text('rows')}</Button>
            <Button onClick={() => run(true, false)}>{text('columns')}</Button>
        </Segmented></Block>
        <BlockTitle>{text('ungroup')}</BlockTitle>
        <Block strong inset><Segmented raised>
            <Button onClick={() => run(false, true)}>{text('rows')}</Button>
            <Button onClick={() => run(false, false)}>{text('columns')}</Button>
        </Segmented></Block>
    </>;
};

const FillSeriesPanel = ({workflow, text}) => {
    const directions = [
        ['fillDown', Asc.c_oAscFillType.fillDown],
        ['fillRight', Asc.c_oAscFillType.fillRight],
        ['fillUp', Asc.c_oAscFillType.fillUp],
        ['fillLeft', Asc.c_oAscFillType.fillLeft],
    ];
    return <List strong inset>{directions.map(([label, value]) => <ListItem
        key={label}
        link="#"
        title={text(label)}
        onClick={() => {
            try { workflow.fillCells(value); } catch (error) { showError(error); }
        }}
    />)}</List>;
};

const RenamePanel = ({text}) => {
    const [title, setTitle] = useState('');
    return <>
        <List strong inset>
            <ListInput label={text('fileName')} type="text" value={title} onInput={event => setTitle(event.target.value)} />
        </List>
        <Block inset><ActionButton onClick={() => {
            try { executeSpreadsheetCommand('spreadsheet.desktop.rename', {title}); } catch (error) { showError(error); }
        }}>{text('rename')}</ActionButton></Block>
    </>;
};

const ImportPanel = ({workflow, text}) => {
    const [state, setState] = useState(workflow.getState());
    const [url, setUrl] = useState('');
    const [destination, setDestination] = useState('A1');
    useEffect(() => workflow.subscribe(setState), [workflow]);
    const run = action => {
        try { action(); } catch (error) { showError(error); }
    };

    return <>
        <List strong inset>
            <ListItem link="#" title={text('file')} onClick={() => run(workflow.startFile)} />
            <ListInput label={text('url')} type="url" value={url} onInput={event => setUrl(event.target.value)} />
            <ListItem link="#" title={text('openUrl')} onClick={() => run(() => workflow.startUrl(url))} />
            <ListItem link="#" title={text('textToColumns')} onClick={() => run(workflow.startTextToColumns)} />
            <ListItem link="#" title={text('xml')} onClick={() => run(workflow.startXml)} />
        </List>
        {state.phase === 'text-preview' && <>
            <BlockTitle>{text('preview')}</BlockTitle>
            <Block strong inset>{Array.isArray(state.data)
                ? state.data.slice(0, 5).map(row => row.join(' | ')).join('\n')
                : String(state.data || '').slice(0, 1000)}</Block>
            <Block inset><ActionButton onClick={() => run(workflow.applyTextPreview)}>{text('import')}</ActionButton></Block>
        </>}
        {state.phase === 'xml-preview' && <>
            <List strong inset>
                <ListInput label={text('destination')} type="text" value={destination} onInput={event => setDestination(event.target.value)} />
            </List>
            <Block inset><ActionButton onClick={() => run(() => workflow.applyXml({destination}))}>{text('importXml')}</ActionButton></Block>
        </>}
    </>;
};

const SearchPanel = ({commandLabels, onOpenPanel, onOpenOptions, text}) => {
    const runtime = getSpreadsheetEditorRuntime();
    const inventory = EditorUIController.getCommandProvider().inventory;
    const [query, setQuery] = useState('');
    const [, setSession] = useState(runtime?.getSession());
    useEffect(() => runtime?.subscribe(session => setSession(session)), [runtime]);
    const results = searchSpreadsheetCommands({
        inventory,
        query,
        commandLabels,
        resolveCommand: id => runtime?.resolve(id) || {available: false, reason: 'session-frozen'},
    });

    const activate = command => {
        try {
            activateSpreadsheetCommandDestination(command.destination, {
                enableSearch: () => onOpenOptions('search'),
                executeCommand: executeSpreadsheetCommand,
                openCommandPanel: panel => onOpenPanel(panel, command),
                openOptions: onOpenOptions,
            });
        } catch (error) {
            showError(error);
        }
    };

    return <>
        <List strong inset>
            <ListInput
                type="search"
                placeholder={text('searchCommands')}
                value={query}
                clearButton
                onInput={event => setQuery(event.target.value)}
            />
        </List>
        <List strong inset>
            {results.map(command => <ListItem
                key={command.id}
                link="#"
                title={command.label}
                after={command.disabled ? command.resolution?.freezeReason || command.resolution?.reason : ''}
                disabled={command.disabled}
                onClick={() => activate(command)}
            />)}
        </List>
    </>;
};

const CommandCenterPage = ({initialTarget, close}) => {
    const {t} = useTranslation();
    const text = key => t(`CommandCenter.${key}`);
    const commandLabels = t('CommandCenter.commandLabels', {returnObjects: true});
    const mainContext = useContext(MainContext);
    const [panel, setPanel] = useState(initialTarget && initialTarget !== 'more.command-search' ? initialTarget : 'search');
    const api = () => Common.EditorApi.get();
    const advancedWorkflow = useMemo(() => createSpreadsheetAdvancedWorkflow({
        executeCommand: executeSpreadsheetCommand,
        getApi: api,
    }), []);
    const importWorkflow = useMemo(() => createSpreadsheetImportWorkflow({
        executeCommand: executeSpreadsheetCommand,
        getActiveWorksheetName: () => {
            const editorApi = api();
            return editorApi.asc_getWorksheetName?.(editorApi.asc_getActiveWorksheetIndex?.());
        },
        getWorksheetNames: () => {
            const editorApi = api();
            const count = editorApi.asc_getWorksheetsCount?.() || 0;
            return Array.from({length: count}, (_, index) => editorApi.asc_getWorksheetName?.(index)).filter(Boolean);
        },
    }), []);
    const openOptions = (option, payload) => {
        close(() => {
            if (option === 'search') f7.searchbar.enable('.searchbar');
            else mainContext.openOptions(option, payload);
        });
    };
    const openPanel = nextPanel => {
        setPanel(nextPanel);
    };
    const advancedPanels = {
        'advanced.fill-series': <FillSeriesPanel workflow={advancedWorkflow} text={text} />,
        'advanced.import-data': <ImportPanel workflow={importWorkflow} text={text} />,
        'advanced.named-ranges': <NamedRangesPanel workflow={advancedWorkflow} text={text} />,
        'advanced.outline': <OutlinePanel workflow={advancedWorkflow} text={text} />,
        'advanced.pivot': <PivotPanel workflow={advancedWorkflow} text={text} />,
        'advanced.rename': <RenamePanel text={text} />,
        'advanced.sheet-view': <SheetViewsPanel workflow={advancedWorkflow} text={text} />,
        'advanced.sparkline': <SparklinePanel workflow={advancedWorkflow} text={text} />,
    };
    const body = panel === 'search'
        ? <SearchPanel commandLabels={commandLabels} onOpenPanel={openPanel} onOpenOptions={openOptions} text={text} />
        : advancedPanels[panel] || null;

    return <Page>
        <Navbar title={text(titles[panel] || 'commands')}>
            {panel !== 'search' && <NavLeft><Link onClick={() => setPanel('search')}>{text('back')}</Link></NavLeft>}
            <NavRight><Link onClick={close}>{text('done')}</Link></NavRight>
        </Navbar>
        {body}
    </Page>;
};

export default function CommandCenter({initialTarget}) {
    const mainContext = useContext(MainContext);
    const afterClosedRef = useRef(null);
    const close = afterClosed => {
        afterClosedRef.current = typeof afterClosed === 'function' ? afterClosed : null;
        if (Device.phone) f7.popup.close('.command-center-popup');
        else f7.popover.close('.command-center-popover');
    };
    useEffect(() => {
        if (Device.phone) f7.popup.open('.command-center-popup');
        else f7.popover.open('.command-center-popover', '#btn-settings');
    }, []);
    const onClosed = () => {
        const afterClosed = afterClosedRef.current;
        afterClosedRef.current = null;
        mainContext.closeOptions('command-search', afterClosed);
    };
    const content = <View style={Device.phone ? undefined : {height: '430px'}}>
        <CommandCenterPage initialTarget={initialTarget} close={close} />
    </View>;

    return Device.phone
        ? <Popup className="command-center-popup" closeByBackdropClick={false} onPopupClosed={onClosed}>{content}</Popup>
        : <Popover className="command-center-popover popover__titled" closeByOutsideClick={false} onPopoverClosed={onClosed}>{content}</Popover>;
}
