/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
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

const sourceControls = source => [...new Set(
    [...source.matchAll(/(?:this|me)\.((?:btn|mnu)[A-Za-z0-9_]+)\s*=\s*new\s+Common\.UI\.[A-Za-z0-9_]+/g)]
        .map(match => match[1]),
)].sort();

test('PDF Desktop gap audit partitions every locked built-in control without drift', async () => {
    assert.equal(audit.releaseGateStatus, 'incomplete');
    assert.ok(audit.blockers.length > 0);

    const catalogIds = new Set(catalog.commands.map(command => command.id));
    for (const file of audit.source.files) {
        const source = (await readFile(new URL(file.path, repositoryRoot), 'utf8')).replace(/\r\n/g, '\n');
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

test('PDF Desktop secondary surfaces and controller paths stay pinned', async () => {
    for (const [file, surface] of Object.entries(audit.secondarySurfaces || {})) {
        const source = (await readFile(new URL(file, repositoryRoot), 'utf8')).replace(/\r\n/g, '\n');
        assert.equal(createHash('sha256').update(source).digest('hex'), surface.sha256, file);
        assert.deepEqual([...surface.planned].sort(), sourceControls(source), `${file}: secondary control drift`);
    }

    for (const sourceEntry of audit.controllerSources || []) {
        const source = (await readFile(new URL(sourceEntry.path, repositoryRoot), 'utf8')).replace(/\r\n/g, '\n');
        assert.equal(createHash('sha256').update(source).digest('hex'), sourceEntry.sha256, sourceEntry.path);
    }
});
