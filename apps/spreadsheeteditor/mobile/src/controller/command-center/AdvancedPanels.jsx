/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, {useEffect, useState} from 'react';
import {
    Block,
    BlockTitle,
    Button,
    List,
    ListInput,
    ListItem,
    Segmented,
    Toggle,
    f7,
} from 'framework7-react';

const showError = error => f7.dialog.alert(error?.message || String(error));

const ActionButton = ({children, onClick, disabled}) => (
    <Button fill onClick={onClick} disabled={disabled}>{children}</Button>
);

const getNamedRangeTypeLabel = (item, text) => {
    if (item?.kind === 'table') return text('tableType');
    if (item?.kind === 'slicer') return text('slicerType');
    return text('rangeType');
};

export const NamedRangesPanel = ({workflow, text}) => {
    const [items, setItems] = useState([]);
    const [scopes, setScopes] = useState([]);
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState({name: '', range: '', scope: null, type: undefined});

    const refresh = () => {
        setItems(workflow.listNamedRanges());
        setScopes(workflow.listNamedRangeScopes());
    };
    const startNew = () => {
        setSelected(null);
        setForm(workflow.createNamedRangeDraft());
    };

    useEffect(() => {
        refresh();
        startNew();
    }, [workflow]);

    const choose = item => {
        setSelected(item);
        setForm({name: item.name, range: item.range, scope: item.scope, type: item.type});
    };
    const submit = () => {
        try {
            if (selected) workflow.editNamedRange(selected.raw, form);
            else workflow.addNamedRange(form);
            refresh();
            startNew();
        } catch (error) {
            showError(error);
        }
    };
    const remove = () => {
        try {
            workflow.deleteNamedRange(selected?.raw);
            refresh();
            startNew();
        } catch (error) {
            showError(error);
        }
    };

    return <>
        <List strong inset>
            {items.map(item => <ListItem
                key={`${item.scope}:${item.name}:${item.type}`}
                radio
                name="spreadsheet-named-range"
                title={item.name}
                after={item.locked ? text('locked') : getNamedRangeTypeLabel(item, text)}
                footer={item.range}
                checked={selected?.raw === item.raw}
                onClick={() => choose(item)}
            />)}
        </List>
        <Block strong inset>
            <Button onClick={startNew}>{text('newNamedRange')}</Button>
        </Block>
        <List strong inset>
            <ListInput
                label={text('name')}
                type="text"
                value={form.name}
                disabled={selected?.locked}
                onInput={event => setForm(current => ({...current, name: event.target.value}))}
            />
            <ListInput
                label={text('reference')}
                type="text"
                value={form.range}
                disabled={selected && !selected.referenceEditable}
                onInput={event => setForm(current => ({...current, range: event.target.value}))}
            />
            <ListItem title={text('namedRangeType')} after={getNamedRangeTypeLabel(selected, text)} />
            {selected?.locked && <ListItem title={text('status')} after={text('locked')} />}
        </List>
        <BlockTitle>{text('namedRangeScope')}</BlockTitle>
        <List strong inset>
            {scopes.map(item => <ListItem
                key={item.scope === null ? 'workbook' : `sheet-${item.scope}`}
                radio
                name="spreadsheet-named-range-scope"
                title={item.scope === null ? text('workbook') : item.name}
                checked={form.scope === item.scope}
                disabled={Boolean(selected)}
                onClick={() => setForm(current => ({...current, scope: item.scope}))}
            />)}
        </List>
        <Block strong inset className="command-center-actions">
            <Segmented raised>
                <Button disabled={selected?.locked} onClick={submit}>{selected ? text('update') : text('add')}</Button>
                <Button disabled={!selected?.deletable} onClick={remove}>{text('delete')}</Button>
            </Segmented>
        </Block>
    </>;
};

export const PivotPanel = ({workflow, text}) => {
    const [snapshot, setSnapshot] = useState(null);
    useEffect(() => {
        try { setSnapshot(workflow.getPivotSnapshot()); } catch { setSnapshot(null); }
    }, [workflow]);
    const run = (action, patch) => {
        try {
            action();
            if (patch) setSnapshot(current => ({...current, ...patch}));
        } catch (error) {
            showError(error);
        }
    };
    const grandTotals = [
        ['grandTotals', true, true],
        ['rowTotalsOnly', true, false],
        ['columnTotalsOnly', false, true],
        ['noTotals', false, false],
    ];

    return <>
        <BlockTitle>{text('layout')}</BlockTitle>
        <List strong inset>
            {['compact', 'outline', 'tabular'].map(layout => <ListItem
                key={layout}
                radio
                name="spreadsheet-pivot-layout"
                title={text(layout)}
                checked={snapshot?.layout === layout}
                onClick={() => run(() => workflow.setPivotLayout(layout), {layout})}
            />)}
            <ListItem title={text('fillDownLabels')}>
                <Toggle
                    checked={snapshot?.fillDownLabels === true}
                    onToggleChange={checked => run(
                        () => workflow.setPivotFillDownLabels(checked),
                        {fillDownLabels: checked},
                    )}
                />
            </ListItem>
        </List>
        <BlockTitle>{text('subtotals')}</BlockTitle>
        <List strong inset>
            {['none', 'top', 'bottom'].map(position => <ListItem
                key={position}
                radio
                name="spreadsheet-pivot-subtotals"
                title={text(position)}
                checked={snapshot?.subtotals === position}
                onClick={() => run(() => workflow.setPivotSubtotals(position), {subtotals: position})}
            />)}
            <ListItem title={text('blankRows')}>
                <Toggle
                    checked={snapshot?.blankRows === true}
                    onToggleChange={checked => run(() => workflow.setPivotBlankRows(checked), {blankRows: checked})}
                />
            </ListItem>
        </List>
        <BlockTitle>{text('grandTotals')}</BlockTitle>
        <List strong inset>
            {grandTotals.map(([label, rows, columns]) => <ListItem
                key={label}
                radio
                name="spreadsheet-pivot-grand-totals"
                title={text(label)}
                checked={snapshot?.rowGrandTotals === rows && snapshot?.columnGrandTotals === columns}
                onClick={() => run(
                    () => workflow.setPivotGrandTotals({rows, columns}),
                    {rowGrandTotals: rows, columnGrandTotals: columns},
                )}
            />)}
        </List>
        <Block strong inset>
            <Segmented raised>
                <Button onClick={() => run(() => workflow.refreshPivot('current'))}>{text('refresh')}</Button>
                <Button onClick={() => run(() => workflow.refreshPivot('all'))}>{text('refreshAll')}</Button>
            </Segmented>
        </Block>
    </>;
};

export const ImportPanel = ({workflow, text}) => {
    const [state, setState] = useState(workflow.getState());
    const [url, setUrl] = useState('');
    const [destinationMode, setDestinationMode] = useState('existing');
    const [destination, setDestination] = useState('');

    useEffect(() => workflow.subscribe(next => {
        setState(next);
        if (next.phase === 'xml-preview') {
            setDestinationMode('existing');
            setDestination(workflow.getDefaultXmlDestination());
        }
    }), [workflow]);
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
            <BlockTitle>{text('destination')}</BlockTitle>
            <Block strong inset>
                <Segmented raised>
                    <Button
                        active={destinationMode === 'existing'}
                        onClick={() => setDestinationMode('existing')}
                    >{text('existingWorksheet')}</Button>
                    <Button
                        active={destinationMode === 'new'}
                        onClick={() => setDestinationMode('new')}
                    >{text('newWorksheet')}</Button>
                </Segmented>
            </Block>
            {destinationMode === 'existing' && <List strong inset>
                <ListInput label={text('destination')} type="text" value={destination} onInput={event => setDestination(event.target.value)} />
            </List>}
            <Block inset><ActionButton onClick={() => run(() => workflow.applyXml({
                mode: destinationMode,
                destination: destinationMode === 'existing' ? destination : undefined,
            }))}>{text('importXml')}</ActionButton></Block>
        </>}
    </>;
};
