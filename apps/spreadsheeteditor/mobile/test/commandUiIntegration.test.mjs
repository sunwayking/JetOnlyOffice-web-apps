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
    const textOptions = {
        asc_getCodePage: () => 65001,
    };
    const workflow = createSpreadsheetImportWorkflow({
        createTextOptions: () => textOptions,
        executeCommand: (id, payload) => calls.push([id, payload]),
        getActiveWorksheetName: () => 'Current',
        getWorksheetNames: () => ['Sheet1', 'Sheet2'],
    });

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
    calls.at(-1)[1].args[0]('<root/>');
    workflow.applyXml({destination: 'A1'});

    assert.deepEqual(calls.map(([id, payload]) => [id, payload.operation, payload.args.filter(value => typeof value !== 'function')]), [
        ['spreadsheet.desktop.import-data', undefined, [textOptions]],
        ['spreadsheet.desktop.import-data', 'text-to-columns', [textOptions, [['A', 'B']], undefined]],
        ['spreadsheet.desktop.import-data', undefined, [textOptions, 'https://example.test/data.csv']],
        ['spreadsheet.desktop.import-data', 'preview-text', [65001, false]],
        ['spreadsheet.desktop.import-data', 'text-to-columns', [textOptions]],
        ['spreadsheet.desktop.import-data', 'xml-start', []],
        ['spreadsheet.desktop.import-data', 'xml-end', ['<root/>', 'A1', 'Current']],
    ]);
});

test('import workflow preserves a preview delivered synchronously by the SDK', () => {
    let workflow;
    workflow = createSpreadsheetImportWorkflow({
        executeCommand: (id, payload) => payload.args[0]('<root/>'),
    });

    workflow.startXml();
    assert.equal(workflow.getState().phase, 'xml-preview');
    assert.equal(workflow.getState().fileContent, '<root/>');
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
    const namedRange = {asc_getName: () => 'Revenue', asc_getRef: () => 'Sheet1!$A$1:$A$9'};
    const sheetView = {asc_getName: () => 'Review', asc_getIsActive: () => true};
    const pivot = {asc_set: () => {}};
    const sparkline = {asc_getId: () => 'spark-7'};
    const api = {
        asc_getCellInfo: () => ({
            asc_getPivotTableInfo: () => pivot,
            asc_getSparklineInfo: () => sparkline,
        }),
        asc_getDefinedNames: () => [namedRange],
        asc_getNamedSheetViews: () => [sheetView],
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
    });

    assert.deepEqual(workflow.listNamedRanges().map(item => item.name), ['Revenue']);
    workflow.addNamedRange({name: 'Costs', range: 'Sheet1!$B$1:$B$9', scope: 'Workbook'});
    workflow.editNamedRange(namedRange, {name: 'Net', range: 'Sheet1!$C$1:$C$9', scope: 'Workbook'});
    workflow.deleteNamedRange(namedRange);

    assert.deepEqual(workflow.listSheetViews().map(item => ({name: item.name, active: item.active})), [{name: 'Review', active: true}]);
    workflow.activateSheetView(sheetView);
    workflow.createSheetView();
    workflow.deleteSheetView(sheetView);

    workflow.changeOutline({group: true, rows: true});
    workflow.changeOutline({group: false, rows: false});
    workflow.fillCells(4);

    workflow.setPivotBlankRows(true);
    workflow.setPivotGrandTotals({rows: true, columns: false});
    workflow.setPivotLayout('tabular');
    workflow.setPivotSubtotals('top');
    workflow.refreshPivot('all');
    workflow.setSparklineType(2);

    assert.deepEqual(calls, [
        ['spreadsheet.desktop.named-ranges', {args: [{kind: 'defined-name', name: 'Costs', range: 'Sheet1!$B$1:$B$9', scope: 'Workbook'}]}],
        ['spreadsheet.desktop.named-ranges', {operation: 'edit', args: [namedRange, {kind: 'defined-name', name: 'Net', range: 'Sheet1!$C$1:$C$9', scope: 'Workbook'}]}],
        ['spreadsheet.desktop.named-ranges', {operation: 'delete', args: [namedRange]}],
        ['spreadsheet.desktop.sheet-view', {value: 'Review'}],
        ['spreadsheet.desktop.sheet-view', {operation: 'create', args: [null, true]}],
        ['spreadsheet.desktop.sheet-view', {operation: 'delete', args: [[sheetView]]}],
        ['spreadsheet.desktop.cell-group', {value: true}],
        ['spreadsheet.desktop.cell-ungroup', {value: false}],
        ['spreadsheet.desktop.number-fill', {value: 4}],
        ['spreadsheet.desktop.pivot-blank-rows', {target: {kind: 'pivot-properties'}, commitTarget: pivot, value: true}],
        ['spreadsheet.desktop.pivot-grand-totals', {target: {kind: 'pivot-properties', rows: true, columns: false}, commitTarget: pivot, value: true}],
        ['spreadsheet.desktop.pivot-layout', {target: {kind: 'pivot-properties', outline: false, compact: false}, commitTarget: pivot, value: false}],
        ['spreadsheet.desktop.pivot-subtotals', {target: {kind: 'pivot-properties', subtotals: true, subtotalsTop: true}, commitTarget: pivot, value: true}],
        ['spreadsheet.desktop.pivot-refresh', {target: pivot, operation: 'all'}],
        ['spreadsheet.sparkline.type', {args: ['spark-7', {kind: 'sparkline-properties', type: 2}]}],
    ]);
});
