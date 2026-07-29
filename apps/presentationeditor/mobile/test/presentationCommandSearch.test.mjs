import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {createPresentationCommandInventory} from '../src/lib/presentationCommandCatalog.mjs';
import {
    resolvePresentationCommandTarget,
    searchAvailablePresentationCommands,
} from '../src/lib/presentationCommandSearch.mjs';

const commands = [
    {
        id: 'presentation.text.bold',
        implementation: 'implemented',
        contexts: ['text'],
        formats: ['pptx', 'odp'],
        mobilePath: 'edit.text.bold',
    },
    {
        id: 'presentation.desktop.insert-table',
        implementation: 'implemented',
        contexts: ['presentation'],
        formats: ['pptx'],
        mobilePath: 'add.insert-table',
    },
    {
        id: 'presentation.desktop.about',
        implementation: 'planned',
        contexts: ['presentation'],
        formats: ['pptx', 'odp'],
        mobilePath: 'more.command-search',
    },
];

const labels = {
    'presentation.text.bold': 'Bold',
    'presentation.desktop.insert-table': 'Insert table',
    'presentation.desktop.about': 'About',
};

const inventoryUrl = new URL('../src/commands/desktop-command-inventory.json', import.meta.url);
const auditedInventory = JSON.parse(await readFile(inventoryUrl, 'utf8'));
const inventory = createPresentationCommandInventory(auditedInventory);

test('Presentation command search filters by permission, selection context, format, and query', () => {
    const runtime = {
        resolve(id) {
            return id === 'presentation.desktop.insert-table'
                ? {available: false, reason: 'permission-denied'}
                : {available: true};
        },
    };

    assert.deepEqual(searchAvailablePresentationCommands({
        runtime,
        commands,
        contexts: ['presentation', 'text'],
        format: 'PPTX',
        query: 'bold',
        labelFor: command => labels[command.id],
    }), [{
        id: 'presentation.text.bold',
        label: 'Bold',
        mobilePath: 'edit.text.bold',
        target: {kind: 'panel', panel: 'edit', route: '/editing-page/'},
    }]);

    assert.deepEqual(searchAvailablePresentationCommands({
        runtime: {resolve: () => ({available: true})},
        commands,
        contexts: ['presentation'],
        format: 'ODP',
        labelFor: command => labels[command.id],
    }), []);
});

test('Presentation command targets resolve only to real editor panels and routes', () => {
    assert.deepEqual(resolvePresentationCommandTarget('edit.chart.design'), {
        kind: 'panel', panel: 'edit', route: '/editing-page/',
    });
    assert.deepEqual(resolvePresentationCommandTarget('add.insert-table'), {
        kind: 'panel', panel: 'add', route: '/adding-page/',
    });
    assert.deepEqual(resolvePresentationCommandTarget('settings.layout'), {
        kind: 'route', panel: 'settings', route: '/presentation-settings/',
    });
    assert.deepEqual(resolvePresentationCommandTarget('more.command-search'), {
        kind: 'route', panel: 'settings', route: '/command-search/',
    });
    assert.deepEqual(resolvePresentationCommandTarget('toolbar.undo'), {
        kind: 'editor', panel: null, route: null,
    });
});

test('implemented Presentation commands never use command search as their own destination', () => {
    assert.deepEqual(
        inventory.commands
            .filter(command => command.implementation === 'implemented')
            .filter(command => command.mobilePath === 'more.command-search')
            .map(command => command.id),
        [],
    );
});
