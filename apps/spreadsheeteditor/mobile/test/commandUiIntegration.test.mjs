import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
    activateSpreadsheetCommandDestination,
    createSpreadsheetHostCommandHandler,
    createSpreadsheetNavigationHandler,
    SPREADSHEET_COMMAND_NAVIGATION_EVENT,
} from '../src/lib/mobileCommandAdapters.mjs';
import {
    getSpreadsheetCommandDestination,
    isSpreadsheetCommandDestinationReachable,
    searchSpreadsheetCommands,
    spreadsheetAdvancedPanelIds,
    spreadsheetCommandDestinationPanels,
} from '../src/lib/commandSearchModel.mjs';
import {createSpreadsheetImportWorkflow} from '../src/lib/importWorkflow.mjs';
import {createSpreadsheetAdvancedWorkflow} from '../src/lib/advancedCommandWorkflow.mjs';
import {createSpreadsheetCommandProvider} from '../src/lib/commandProvider.mjs';
import {
    disposeSpreadsheetEditorRuntime,
    initializeSpreadsheetEditorRuntime,
    updateSpreadsheetEditorPermissions,
} from '../src/lib/spreadsheetEditorRuntime.mjs';

const inventoryUrl = new URL('../src/commands/desktop-command-inventory.json', import.meta.url);
const inventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
const englishLocaleUrl = new URL('../locale/en.json', import.meta.url);
const chineseLocaleUrl = new URL('../locale/zh.json', import.meta.url);

test('spreadsheet Runtime dispatches navigation and host commands to injected handlers', () => {
    const callbacks = new Map();
    const dispatched = [];
    const api = {
        asc_getCellInfo: () => ({type: 'cell'}),
        asc_registerCallback: (name, callback) => callbacks.set(name, callback),
        asc_unregisterCallback: name => callbacks.delete(name),
    };
    const runtime = initializeSpreadsheetEditorRuntime({
        inventory,
        getApi: () => api,
        navigateCommand: (intent, payload) => dispatched.push(['navigation', intent, payload]),
        executeHostCommand: (intent, payload) => dispatched.push(['host', intent, payload]),
    });

    updateSpreadsheetEditorPermissions({edit: true});
    callbacks.get('asc_onDocumentOpenStateChanged')({phase: 'ready'});
    callbacks.get('asc_onTransportStateChanged')({state: 'connected'});
    runtime.execute('spreadsheet.desktop.sparklinetab', {source: 'command-search'});
    runtime.execute('spreadsheet.desktop.edit', {source: 'command-search'});

    assert.deepEqual(dispatched, [
        ['navigation', {
            type: 'navigate',
            commandId: 'spreadsheet.desktop.sparklinetab',
            target: 'advanced.sparkline',
        }, {source: 'command-search'}],
        ['host', {
            type: 'host-command',
            commandId: 'spreadsheet.desktop.edit',
            action: 'request-edit-rights',
        }, {source: 'command-search'}],
    ]);
    disposeSpreadsheetEditorRuntime();
});

test('spreadsheet mobile adapters publish navigation and perform real Gateway or browser actions', () => {
    const events = [];
    const calls = [];
    const notifications = {
        trigger: (...args) => events.push(args),
    };
    const gateway = {
        requestEditRights: () => calls.push(['request-edit-rights']),
        requestCreateNew: () => calls.push(['create-new']),
        requestOpen: payload => calls.push(['open', payload]),
        requestRename: title => calls.push(['rename', title]),
    };
    const navigate = createSpreadsheetNavigationHandler({inventory, notifications});
    const host = createSpreadsheetHostCommandHandler({
        gateway,
        notifications,
        openUrl: (url, target) => calls.push(['open-url', url, target]),
        suggestUrl: 'https://example.test/suggest',
    });

    const intent = {type: 'navigate', commandId: 'spreadsheet.desktop.about', target: 'settings.about'};
    const destination = {option: 'settings', panel: 'about', commandId: 'spreadsheet.desktop.about'};
    const advancedIntent = {type: 'navigate', commandId: 'spreadsheet.desktop.sparklinetab', target: 'advanced.sparkline'};
    const advancedDestination = {option: 'command-search', panel: 'advanced.sparkline', commandId: 'spreadsheet.desktop.sparklinetab'};
    assert.deepEqual(navigate(intent, {origin: 'search'}), destination);
    assert.deepEqual(navigate(advancedIntent, {origin: 'toolbar'}), advancedDestination);
    assert.throws(
        () => navigate({type: 'navigate', commandId: 'spreadsheet.missing'}),
        error => error.code === 'MOBILE_NAVIGATION_DESTINATION_UNAVAILABLE',
    );
    host({action: 'close-editor'}, {origin: 'search'});
    host({action: 'go-back'});
    host({action: 'request-edit-rights'});
    host({action: 'create-new'});
    host({action: 'file-open'}, {location: 'picker'});
    host({action: 'open-recent'});
    host({action: 'rename'}, {title: 'Quarterly report'});
    host({action: 'suggest'});

    assert.deepEqual(events, [
        [SPREADSHEET_COMMAND_NAVIGATION_EVENT, destination, {origin: 'search'}],
        [SPREADSHEET_COMMAND_NAVIGATION_EVENT, advancedDestination, {origin: 'toolbar'}],
        ['close'],
        ['goback'],
    ]);
    assert.deepEqual(calls, [
        ['request-edit-rights'],
        ['create-new'],
        ['open', {location: 'picker'}],
        ['open', {recent: true}],
        ['rename', 'Quarterly report'],
        ['open-url', 'https://example.test/suggest', '_blank'],
    ]);
});

test('spreadsheet command activation enters the concrete Mobile page or execution handler', () => {
    const calls = [];
    const handlers = {
        enableSearch: commandId => calls.push(['enable-search', commandId]),
        executeCommand: commandId => calls.push(['execute', commandId]),
        openCommandPanel: (panel, commandId) => calls.push(['open-panel', panel, commandId]),
        openOptions: (option, payload) => calls.push(['open-options', option, payload]),
    };
    const commandsById = new Map(inventory.commands.map(command => [command.id, command]));
    const activate = commandId => activateSpreadsheetCommandDestination(
        getSpreadsheetCommandDestination(commandsById.get(commandId)),
        handlers,
    );

    activate('spreadsheet.desktop.about');
    activate('spreadsheet.desktop.autosum');
    activate('spreadsheet.desktop.sparklinetab');
    activate('spreadsheet.desktop.advancedsearch');
    activate('spreadsheet.desktop.history');
    activate('spreadsheet.desktop.save');

    assert.deepEqual(calls, [
        ['open-options', 'settings', {panels: ['about'], commandId: 'spreadsheet.desktop.about'}],
        ['open-options', 'add', {panels: 'function'}],
        ['open-panel', 'advanced.sparkline', 'spreadsheet.desktop.sparklinetab'],
        ['enable-search', 'spreadsheet.desktop.advancedsearch'],
        ['open-options', 'history', {panels: ['version-history'], commandId: 'spreadsheet.desktop.history'}],
        ['execute', 'spreadsheet.desktop.save'],
    ]);
    assert.throws(
        () => activateSpreadsheetCommandDestination(null, handlers),
        error => error.code === 'MOBILE_NAVIGATION_DESTINATION_UNAVAILABLE',
    );
});

test('command search filters by query, context, and Runtime resolution before routing to a panel', () => {
    const resolutions = new Map([
        ['spreadsheet.desktop.sparklinetab', {available: true}],
        ['spreadsheet.sparkline.type', {available: false, reason: 'session-frozen'}],
    ]);
    const results = searchSpreadsheetCommands({
        inventory,
        query: 'sparkline',
        contexts: ['cell', 'workbook'],
        resolveCommand: id => resolutions.get(id) || {available: false, reason: 'permission-denied'},
    });

    assert.deepEqual(results.map(result => ({
        id: result.id,
        disabled: result.disabled,
        destination: result.destination,
    })), [
        {
            id: 'spreadsheet.desktop.sparklinetab',
            disabled: false,
            destination: {option: 'command-search', panel: 'advanced.sparkline', commandId: 'spreadsheet.desktop.sparklinetab'},
        },
    ]);
});

test('command search uses localized command labels for display and matching', () => {
    const commandLabels = {
        'spreadsheet.desktop.sparklinetab': '迷你图工具',
    };
    const results = searchSpreadsheetCommands({
        inventory,
        query: '迷你图',
        commandLabels,
        resolveCommand: id => id === 'spreadsheet.desktop.sparklinetab'
            ? {available: true}
            : {available: false, reason: 'permission-denied'},
    });

    assert.deepEqual(results.map(command => [command.id, command.label]), [
        ['spreadsheet.desktop.sparklinetab', '迷你图工具'],
    ]);
});

test('command search exposes the audited Desktop surface, not payload-dependent internal commands', () => {
    const results = searchSpreadsheetCommands({
        inventory,
        resolveCommand: () => ({available: true}),
    });

    assert.ok(results.length > 0);
    assert.equal(results.every(command => command.id.startsWith('spreadsheet.desktop.')), true);
    assert.equal(results.some(command => command.id === 'spreadsheet.cell.insert'), false);
    assert.equal(results.some(command => command.id === 'spreadsheet.cell.merge'), false);
});

test('every implemented Desktop spreadsheet command resolves to a reachable Mobile destination', () => {
    const desktopCommands = inventory.commands
        .filter(command => command.implementation === 'implemented')
        .filter(command => command.id.startsWith('spreadsheet.desktop.'));
    const missing = desktopCommands
        .filter(command => !getSpreadsheetCommandDestination(command));

    assert.deepEqual(missing, []);
    for (const command of desktopCommands) {
        const destination = getSpreadsheetCommandDestination(command);
        assert.equal(isSpreadsheetCommandDestinationReachable(destination), true, command.id);
        if (destination.option === 'command-search') {
            assert.ok(spreadsheetAdvancedPanelIds.includes(destination.panel), command.id);
        }
    }
    assert.deepEqual(
        getSpreadsheetCommandDestination(inventory.commands.find(command => command.id === 'spreadsheet.desktop.import-data')),
        {option: 'command-search', panel: 'advanced.import-data', commandId: 'spreadsheet.desktop.import-data'},
    );
    assert.deepEqual(
        getSpreadsheetCommandDestination(inventory.commands.find(command => command.id === 'spreadsheet.desktop.named-ranges')),
        {option: 'command-search', panel: 'advanced.named-ranges', commandId: 'spreadsheet.desktop.named-ranges'},
    );
    assert.deepEqual(
        getSpreadsheetCommandDestination(inventory.commands.find(command => command.id === 'spreadsheet.desktop.sheet-view')),
        {option: 'command-search', panel: 'advanced.sheet-view', commandId: 'spreadsheet.desktop.sheet-view'},
    );
    assert.deepEqual(
        getSpreadsheetCommandDestination(inventory.commands.find(command => command.id === 'spreadsheet.desktop.pivot-layout')),
        {option: 'command-search', panel: 'advanced.pivot', commandId: 'spreadsheet.desktop.pivot-layout'},
    );
    assert.deepEqual(
        getSpreadsheetCommandDestination(inventory.commands.find(command => command.id === 'spreadsheet.desktop.history')),
        {option: 'history', panel: 'version-history', commandId: 'spreadsheet.desktop.history'},
    );
    assert.equal(
        getSpreadsheetCommandDestination(inventory.commands.find(command => command.id === 'spreadsheet.history.undo')),
        null,
    );
});

test('command destinations are backed by real Mobile pages and deterministic close events', async () => {
    const mainSource = await readFile(new URL('../src/page/main.jsx', import.meta.url), 'utf8');
    const commandCenterSource = await readFile(new URL('../src/controller/CommandCenter.jsx', import.meta.url), 'utf8');
    const advancedPanelsSource = await readFile(new URL('../src/controller/command-center/AdvancedPanels.jsx', import.meta.url), 'utf8');
    const settingsSource = await readFile(new URL('../src/view/settings/Settings.jsx', import.meta.url), 'utf8');

    for (const option of ['edit', 'add', 'settings', 'coauth', 'history', 'command-search']) {
        assert.match(mainSource, new RegExp(`opts === ['\"]${option}['\"]`), option);
    }
    for (const panel of spreadsheetCommandDestinationPanels.settings.filter(panel => panel !== 'root')) {
        assert.match(settingsSource, new RegExp(`['\"]?${panel}['\"]?:`), panel);
    }
    assert.doesNotMatch(commandCenterSource, /setTimeout\s*\(/);
    assert.match(commandCenterSource, /onPopupClosed=\{onClosed\}/);
    assert.match(commandCenterSource, /onPopoverClosed=\{onClosed\}/);
    assert.match(commandCenterSource, /closeOptions\('command-search', afterClosed\)/);
    assert.match(mainSource, /typeof afterClosed === 'function'/);
    for (const control of [
        'newWorksheet',
        'existingWorksheet',
        'rowTotalsOnly',
        'columnTotalsOnly',
        'fillDownLabels',
        'namedRangeScope',
        'namedRangeType',
        'locked',
    ]) assert.match(advancedPanelsSource, new RegExp(`['"]${control}['"]`), control);
});

test('English UI text and Simplified Chinese command labels are complete', async () => {
    const english = JSON.parse(await readFile(englishLocaleUrl, 'utf8')).CommandCenter;
    const chinese = JSON.parse(await readFile(chineseLocaleUrl, 'utf8')).CommandCenter;
    const englishUiKeys = Object.keys(english).filter(key => key !== 'commandLabels').sort();
    const chineseUiKeys = Object.keys(chinese).filter(key => key !== 'commandLabels').sort();

    assert.deepEqual(chineseUiKeys, englishUiKeys);
    const implementedIds = inventory.commands
        .filter(command => command.implementation === 'implemented')
        .map(command => command.id)
        .sort();
    assert.deepEqual(Object.keys(chinese.commandLabels).sort(), implementedIds);
    for (const id of implementedIds) {
        assert.ok(chinese.commandLabels[id].trim(), id);
    }
});

test('import workflow exposes file, URL, text-to-columns, and XML SDK sequences', () => {
    const calls = [];
    const checkedDestinations = [];
    const xmlBytes = new Uint8Array([1, 2, 3]);
    const secondXmlBytes = new Uint8Array([4, 5, 6]);
    const textOptions = {
        asc_getCodePage: () => 65001,
    };
    const workflow = createSpreadsheetImportWorkflow({
        createTextOptions: () => textOptions,
        executeCommand: (id, payload) => calls.push([id, payload]),
        getActiveWorksheetName: () => 'Current',
        getDefaultXmlDestination: () => 'B2',
        getWorksheetNames: () => ['Sheet1', 'Sheet2'],
        validateXmlDestination: destination => {
            checkedDestinations.push(destination);
            return destination === 'B2';
        },
    });

    assert.equal(workflow.getDefaultXmlDestination(), 'B2');

    workflow.startFile();
    calls.at(-1)[1].args[1]({
        asc_getData: () => [['A', 'B']],
        asc_getRecommendedSettings: () => textOptions,
        asc_getCodePages: () => [{code: 65001, name: 'UTF-8'}],
    });
    workflow.applyTextPreview();

    workflow.startUrl(' https://example.test/data.csv ');
    assert.equal(calls.at(-1)[1].args[2], 'https://example.test/data.csv');

    workflow.startTextToColumns();
    calls.at(-1)[1].args[1]('A\tB');
    workflow.applyTextPreview();

    workflow.startXml();
    calls.at(-1)[1].args[0](xmlBytes);
    workflow.applyXml({mode: 'existing', destination: 'B2'});

    workflow.startXml();
    calls.at(-1)[1].args[0](secondXmlBytes);
    workflow.applyXml({mode: 'new'});

    assert.deepEqual(calls.map(([id, payload]) => [id, payload.operation, payload.args.filter(value => typeof value !== 'function')]), [
        ['spreadsheet.desktop.import-data', undefined, [textOptions]],
        ['spreadsheet.desktop.import-data', 'text-to-columns', [textOptions, [['A', 'B']], undefined]],
        ['spreadsheet.desktop.import-data', undefined, [textOptions, 'https://example.test/data.csv']],
        ['spreadsheet.desktop.import-data', 'preview-text', [65001, false]],
        ['spreadsheet.desktop.import-data', 'text-to-columns', [textOptions]],
        ['spreadsheet.desktop.import-data', 'xml-start', []],
        ['spreadsheet.desktop.import-data', 'xml-end', [xmlBytes, 'B2', 'Current']],
        ['spreadsheet.desktop.import-data', 'xml-start', []],
        ['spreadsheet.desktop.import-data', 'xml-end', [secondXmlBytes, null, 'Sheet3']],
    ]);
    assert.deepEqual(checkedDestinations, ['B2']);
});

test('XML import rejects blank and invalid existing-worksheet destinations', () => {
    let preview;
    const workflow = createSpreadsheetImportWorkflow({
        executeCommand: (id, payload) => {
            if (payload.operation === 'xml-start') preview = payload.args[0];
        },
        validateXmlDestination: () => false,
    });

    workflow.startXml();
    preview(new Uint8Array([1]));
    assert.throws(
        () => workflow.applyXml({mode: 'existing', destination: ''}),
        error => error.code === 'MOBILE_IMPORT_XML_DESTINATION_REQUIRED',
    );
    assert.throws(
        () => workflow.applyXml({mode: 'existing', destination: 'Not a range'}),
        error => error.code === 'MOBILE_IMPORT_XML_DESTINATION_INVALID',
    );
});

test('import workflow preserves a preview delivered synchronously by the SDK', () => {
    let workflow;
    workflow = createSpreadsheetImportWorkflow({
        executeCommand: (id, payload) => payload.args[0](new Uint8Array([1, 2, 3])),
    });

    workflow.startXml();
    assert.equal(workflow.getState().phase, 'xml-preview');
    assert.deepEqual(workflow.getState().fileContent, new Uint8Array([1, 2, 3]));
});

test('cancelled XML selection returns the import workflow to idle', () => {
    const workflow = createSpreadsheetImportWorkflow({
        executeCommand: (id, payload) => payload.args[0](null),
    });

    workflow.startXml();
    assert.equal(workflow.getState().phase, 'idle');
    assert.equal(workflow.getState().fileContent, null);
});

test('provider rejects invalid receivers and refuses intent-only execution', () => {
    assert.throws(
        () => createSpreadsheetCommandProvider({
            inventory: {
                editor: 'spreadsheet',
                commands: [{
                    id: 'spreadsheet.invalid',
                    contexts: ['cell'],
                    permissions: ['edit'],
                    implementation: 'implemented',
                    binding: {kind: 'sdk-object', method: 'apply', receiver: 'mystery'},
                    mobilePath: 'advanced.invalid',
                    testIds: ['invalid'],
                }],
            },
            getApi: () => ({}),
        }),
        error => error.code === 'MOBILE_COMMAND_BINDING_INVALID',
    );

    const provider = createSpreadsheetCommandProvider({inventory, getApi: () => ({})});
    assert.throws(
        () => provider.execute('spreadsheet.desktop.sparklinetab'),
        error => error.code === 'MOBILE_NAVIGATION_HANDLER_UNAVAILABLE',
    );
    assert.throws(
        () => provider.execute('spreadsheet.desktop.edit'),
        error => error.code === 'MOBILE_HOST_HANDLER_UNAVAILABLE',
    );
});

test('advanced workflow executes named ranges, sheet views, pivots, and sparklines through Runtime commands', () => {
    const calls = [];
    const checks = [];
    const namedRange = {
        asc_getName: () => 'Revenue',
        asc_getRef: () => 'Sheet1!$A$1:$A$9',
        asc_getScope: () => 0,
        asc_getType: () => 7,
        asc_getIsLock: () => null,
    };
    const sheetView = {asc_getName: () => 'Review', asc_getIsActive: () => true};
    const pivot = {
        asc_set: () => {},
        asc_getBlankRows: () => false,
        asc_getColGrandTotals: () => false,
        asc_getCompact: () => false,
        asc_getDefaultSubtotal: () => true,
        asc_getFillDownLabelsDefault: () => true,
        asc_getInsertBlankRow: () => false,
        asc_getOutline: () => true,
        asc_getRowGrandTotals: () => true,
        asc_getSubtotalTop: () => false,
    };
    const sparkline = {asc_getId: () => 'spark-7'};
    const api = {
        asc_getCellInfo: () => ({
            asc_getPivotTableInfo: () => pivot,
            asc_getSparklineInfo: () => sparkline,
        }),
        asc_getDefinedNames: () => [namedRange],
        asc_getDefaultDefinedName: () => ({
            asc_getName: () => 'DefaultName',
            asc_getRef: () => 'Sheet1!$D$1',
            asc_getType: () => 7,
        }),
        asc_getNamedSheetViews: () => [sheetView],
        asc_getWorksheetsCount: () => 2,
        asc_getWorksheetName: index => ['Sheet1', 'Sheet2'][index],
        asc_checkDefinedName: (name, scope) => {
            checks.push(['name', name, scope]);
            return {asc_getStatus: () => true};
        },
        asc_checkDataRange: (type, range, allowMultiple) => {
            checks.push(['range', type, range, allowMultiple]);
            return 0;
        },
    };
    const workflow = createSpreadsheetAdvancedWorkflow({
        executeCommand: (id, payload) => calls.push([id, payload]),
        getApi: () => api,
        createDefinedName: value => ({kind: 'defined-name', ...value}),
        createPivotProperties: () => {
            const value = {kind: 'pivot-properties'};
            for (const [method, property] of [
                ['asc_setColGrandTotals', 'columns'],
                ['asc_setCompact', 'compact'],
                ['asc_setDefaultSubtotal', 'subtotals'],
                ['asc_setFillDownLabelsDefault', 'fillDownLabels'],
                ['asc_setOutline', 'outline'],
                ['asc_setRowGrandTotals', 'rows'],
                ['asc_setSubtotalTop', 'subtotalsTop'],
            ]) Object.defineProperty(value, method, {value(input) { this[property] = input; }});
            return value;
        },
        createSparklineProperties: () => {
            const value = {kind: 'sparkline-properties'};
            Object.defineProperty(value, 'asc_setType', {value(type) { this.type = type; }});
            return value;
        },
        namedRangeSelectionType: 42,
        dataRangeError: 99,
        tableDefinedNameType: 8,
        slicerDefinedNameType: 9,
    });

    assert.deepEqual(workflow.listNamedRanges().map(item => ({
        name: item.name,
        scope: item.scope,
        type: item.type,
        locked: item.locked,
        referenceEditable: item.referenceEditable,
    })), [{name: 'Revenue', scope: 0, type: 7, locked: false, referenceEditable: true}]);
    assert.deepEqual(workflow.listNamedRangeScopes(), [
        {scope: null, name: null},
        {scope: 0, name: 'Sheet1'},
        {scope: 1, name: 'Sheet2'},
    ]);
    assert.deepEqual(workflow.createNamedRangeDraft(), {
        name: 'DefaultName',
        range: 'Sheet1!$D$1',
        scope: null,
        type: 7,
    });
    workflow.addNamedRange({name: 'Costs', range: 'Sheet1!$B$1:$B$9', scope: null, type: 7});
    workflow.editNamedRange(namedRange, {name: 'Net', range: 'Sheet1!$C$1:$C$9', scope: 0});
    workflow.deleteNamedRange(namedRange);

    assert.deepEqual(workflow.listSheetViews().map(item => ({name: item.name, active: item.active})), [{name: 'Review', active: true}]);
    workflow.activateSheetView(sheetView);
    workflow.createSheetView();
    workflow.deleteSheetView(sheetView);

    workflow.changeOutline({group: true, rows: true});
    workflow.changeOutline({group: false, rows: false});
    workflow.fillCells(4);

    assert.deepEqual(workflow.getPivotSnapshot(), {
        layout: 'outline',
        fillDownLabels: true,
        blankRows: false,
        subtotals: 'bottom',
        rowGrandTotals: true,
        columnGrandTotals: false,
    });
    workflow.setPivotBlankRows(true);
    workflow.setPivotGrandTotals({rows: true, columns: false});
    workflow.setPivotGrandTotals({rows: false, columns: true});
    workflow.setPivotLayout('tabular');
    workflow.setPivotFillDownLabels(true);
    workflow.setPivotSubtotals('top');
    workflow.refreshPivot('all');
    workflow.setSparklineType(2);

    assert.deepEqual(calls, [
        ['spreadsheet.desktop.named-ranges', {args: [{kind: 'defined-name', name: 'Costs', range: 'Sheet1!$B$1:$B$9', scope: null, type: 7}]}],
        ['spreadsheet.desktop.named-ranges', {operation: 'edit', args: [namedRange, {kind: 'defined-name', name: 'Net', range: 'Sheet1!$C$1:$C$9', scope: 0, type: 7}]}],
        ['spreadsheet.desktop.named-ranges', {operation: 'delete', args: [namedRange]}],
        ['spreadsheet.desktop.sheet-view', {value: 'Review'}],
        ['spreadsheet.desktop.sheet-view', {operation: 'create', args: [null, true]}],
        ['spreadsheet.desktop.sheet-view', {operation: 'delete', args: [[sheetView]]}],
        ['spreadsheet.desktop.cell-group', {value: true}],
        ['spreadsheet.desktop.cell-ungroup', {value: false}],
        ['spreadsheet.desktop.number-fill', {value: 4}],
        ['spreadsheet.desktop.pivot-blank-rows', {target: {kind: 'pivot-properties'}, commitTarget: pivot, value: true}],
        ['spreadsheet.desktop.pivot-grand-totals', {target: {kind: 'pivot-properties', rows: true, columns: false}, commitTarget: pivot, value: true}],
        ['spreadsheet.desktop.pivot-grand-totals', {target: {kind: 'pivot-properties', rows: false, columns: true}, commitTarget: pivot, value: false}],
        ['spreadsheet.desktop.pivot-layout', {target: {kind: 'pivot-properties', outline: false, compact: false}, commitTarget: pivot, value: false}],
        ['spreadsheet.desktop.pivot-layout', {operation: 'fill-down', target: {kind: 'pivot-properties'}, commitTarget: pivot, value: true}],
        ['spreadsheet.desktop.pivot-subtotals', {target: {kind: 'pivot-properties', subtotals: true, subtotalsTop: true}, commitTarget: pivot, value: true}],
        ['spreadsheet.desktop.pivot-refresh', {target: pivot, operation: 'all'}],
        ['spreadsheet.sparkline.type', {args: ['spark-7', {kind: 'sparkline-properties', type: 2}]}],
    ]);
    assert.deepEqual(checks, [
        ['name', 'Costs', null],
        ['range', 42, 'Sheet1!$B$1:$B$9', false],
        ['name', 'Net', 0],
        ['range', 42, 'Sheet1!$C$1:$C$9', false],
    ]);
});

test('named range workflow preserves type and rejects locked mutations', () => {
    const locked = {
        asc_getName: () => 'LockedName',
        asc_getRef: () => 'Sheet1!$A$1',
        asc_getScope: () => null,
        asc_getType: () => 8,
        asc_getIsLock: () => 'user-1',
    };
    const workflow = createSpreadsheetAdvancedWorkflow({
        executeCommand: () => assert.fail('locked named range must not execute'),
        getApi: () => ({asc_getDefinedNames: () => [locked]}),
        createDefinedName: value => value,
        tableDefinedNameType: 8,
        slicerDefinedNameType: 9,
    });

    assert.deepEqual(workflow.listNamedRanges().map(item => ({
        locked: item.locked,
        referenceEditable: item.referenceEditable,
        deletable: item.deletable,
    })), [{locked: true, referenceEditable: false, deletable: false}]);
    assert.throws(
        () => workflow.editNamedRange(locked, {name: 'Changed', range: 'Sheet1!$B$1'}),
        error => error.code === 'MOBILE_NAMED_RANGE_LOCKED',
    );
    assert.throws(
        () => workflow.deleteNamedRange(locked),
        error => error.code === 'MOBILE_NAMED_RANGE_LOCKED',
    );
});

test('missing SDK type constants do not classify ordinary named ranges as protected types', () => {
    const ordinary = {
        asc_getName: () => 'Ordinary',
        asc_getRef: () => 'Sheet1!$A$1',
        asc_getScope: () => null,
        asc_getType: () => undefined,
        asc_getIsLock: () => null,
    };
    const workflow = createSpreadsheetAdvancedWorkflow({
        executeCommand: () => {},
        getApi: () => ({asc_getDefinedNames: () => [ordinary]}),
        createDefinedName: value => value,
    });

    assert.deepEqual(workflow.listNamedRanges().map(item => ({
        kind: item.kind,
        referenceEditable: item.referenceEditable,
        deletable: item.deletable,
    })), [{kind: 'range', referenceEditable: true, deletable: true}]);
});

test('named range validation allows blank references and reserved names only when adding', () => {
    const calls = [];
    const original = {
        asc_getName: () => 'Existing',
        asc_getRef: () => '',
        asc_getScope: () => null,
        asc_getType: () => 7,
        asc_getIsLock: () => null,
    };
    const api = {
        asc_checkDefinedName: name => name === 'Reserved'
            ? {asc_getStatus: () => false, asc_getReason: () => 'reserved'}
            : {asc_getStatus: () => true},
        asc_checkDataRange: () => assert.fail('blank references must not be passed to asc_checkDataRange'),
    };
    const workflow = createSpreadsheetAdvancedWorkflow({
        executeCommand: (id, payload) => calls.push([id, payload]),
        getApi: () => api,
        createDefinedName: value => value,
        definedNameReasonReserved: 'reserved',
    });

    workflow.addNamedRange({name: 'Reserved', range: '', scope: null, type: 7});
    assert.deepEqual(calls, [[
        'spreadsheet.desktop.named-ranges',
        {args: [{name: 'Reserved', range: '', scope: null, type: 7}]},
    ]]);
    assert.throws(
        () => workflow.editNamedRange(original, {name: 'Reserved', range: '', scope: null, type: 7}),
        error => error.code === 'MOBILE_NAMED_RANGE_NAME_INVALID',
    );
});

test('named range workflow preserves slicer type and immutable empty reference', () => {
    const calls = [];
    const slicer = {
        asc_getName: () => 'Slicer_Name',
        asc_getRef: () => '',
        asc_getScope: () => null,
        asc_getType: () => 9,
        asc_getIsLock: () => null,
    };
    const workflow = createSpreadsheetAdvancedWorkflow({
        executeCommand: (id, payload) => calls.push([id, payload]),
        getApi: () => ({
            asc_checkDefinedName: () => ({asc_getStatus: () => true}),
        }),
        createDefinedName: value => value,
        tableDefinedNameType: 8,
        slicerDefinedNameType: 9,
    });

    workflow.editNamedRange(slicer, {name: 'Slicer_Renamed', range: '', scope: null});
    assert.deepEqual(calls, [[
        'spreadsheet.desktop.named-ranges',
        {operation: 'edit', args: [slicer, {name: 'Slicer_Renamed', range: '', scope: null, type: 9}]},
    ]]);
    assert.throws(
        () => workflow.deleteNamedRange(slicer),
        error => error.code === 'MOBILE_NAMED_RANGE_DELETE_UNAVAILABLE',
    );
});
