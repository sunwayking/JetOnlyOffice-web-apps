/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const audit = JSON.parse(await readFile(
    new URL('../src/commands/desktop-gap-audit.json', import.meta.url),
    'utf8',
));
const catalog = JSON.parse(await readFile(
    new URL('../src/commands/mobile-command-catalog.json', import.meta.url),
    'utf8',
));
const repositoryRoot = new URL('../../../../', import.meta.url);
const repositoryPath = fileURLToPath(repositoryRoot);

const sourceControls = source => [...new Set(
    [...source.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*\.((?:btn|mnu)[A-Za-z0-9_]+)\s*=\s*new\s+Common\.UI\.[A-Za-z0-9_]+/g)]
        .map(match => match[1]),
)].sort();

const lockedSource = file => execFileSync('git', ['show', `${audit.source.commit}:${file}`], {
    cwd: repositoryPath,
    encoding: 'utf8',
}).replace(/\r\n/g, '\n');

test('PDF Desktop gap audit pins its source commit and direct-assignment scope', async () => {
    assert.equal(audit.releaseGateStatus, 'incomplete');
    assert.ok(audit.blockers.length > 0);
    assert.equal(audit.controlDiscovery, 'simple-receiver-common-ui-direct-assignments');
    assert.equal(audit.controlUnit, 'control-identifier');
    assert.equal(audit.controllerDiscovery, 'source-hash-only');
    assert.ok(audit.blockers.includes('dynamic-and-controller-control-classification-incomplete'));
    assert.equal(
        execFileSync('git', ['rev-parse', '--verify', `${audit.source.commit}^{commit}`], {
            cwd: repositoryPath,
            encoding: 'utf8',
        }).trim(),
        audit.source.commit,
    );

    const catalogIds = new Set(catalog.commands.map(command => command.id));
    for (const file of audit.source.files) {
        const source = (await readFile(new URL(file.path, repositoryRoot), 'utf8')).replace(/\r\n/g, '\n');
        assert.equal(
            createHash('sha256').update(lockedSource(file.path)).digest('hex'),
            file.sha256,
            `${file.path}: locked commit`,
        );
        assert.equal(createHash('sha256').update(source).digest('hex'), file.sha256, file.path);

        const mapped = Object.keys(audit.mapped[file.path] || {});
        const planned = audit.planned[file.path] || [];
        const excluded = Object.keys(audit.excluded[file.path] || {});
        const partition = [...mapped, ...planned, ...excluded];
        assert.equal(new Set(partition).size, partition.length, `${file.path}: duplicate classification`);
        assert.deepEqual(partition.sort(), sourceControls(source), `${file.path}: unclassified Desktop control`);

        for (const commandIds of Object.values(audit.mapped[file.path] || {})) {
            assert.ok(commandIds.length > 0, file.path);
            commandIds.forEach(commandId => assert.ok(catalogIds.has(commandId), commandId));
        }
        for (const adr of Object.values(audit.excluded[file.path] || {})) {
            assert.match(adr, /^ADR-\d{4}$/);
        }
    }
});

test('PDF Desktop direct secondary controls stay pinned while controller sources remain unclassified', async () => {
    const primaryPaths = new Set(audit.source.files.map(file => file.path));
    for (const [file, surface] of Object.entries(audit.secondarySurfaces || {})) {
        assert.equal(primaryPaths.has(file), false, `${file}: duplicate primary/secondary surface`);
        const source = (await readFile(new URL(file, repositoryRoot), 'utf8')).replace(/\r\n/g, '\n');
        assert.equal(createHash('sha256').update(source).digest('hex'), surface.sha256, file);
        assert.equal(createHash('sha256').update(lockedSource(file)).digest('hex'), surface.sha256, `${file}: locked commit`);
        assert.deepEqual([...surface.planned].sort(), sourceControls(source), `${file}: secondary control drift`);
    }

    for (const sourceEntry of audit.controllerSources || []) {
        assert.equal(sourceEntry.classification, 'unclassified');
        const source = (await readFile(new URL(sourceEntry.path, repositoryRoot), 'utf8')).replace(/\r\n/g, '\n');
        assert.equal(createHash('sha256').update(source).digest('hex'), sourceEntry.sha256, sourceEntry.path);
        assert.equal(
            createHash('sha256').update(lockedSource(sourceEntry.path)).digest('hex'),
            sourceEntry.sha256,
            `${sourceEntry.path}: locked commit`,
        );
    }
});
