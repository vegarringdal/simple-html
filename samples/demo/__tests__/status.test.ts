// the status of the docs site (scripts/site/status.js) runs in node when the site is built
/// <reference types="node" />

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// a commonjs script of the build, as the build loads it
const status = require('../../../scripts/site/status.js');

/**
 * The known limits page and the build line of the docs site: made from DESIGN.md and git when the site
 * is built. site.test.ts shows them in the site.
 */

describe('docs site status - the known limits and the links', () => {
    it('expect a section by its heading, up to the next one', () => {
        const markdown = '# Design\n## Datasource\nold\n## Known limits and next\n\n* one\n* two\n## Later\nx';
        expect(status.markdownSection(markdown, 'Known limits and next')).toBe('* one\n* two');
        expect(status.markdownSection(markdown, 'Missing')).toBe('');
    });

    it('expect the page to be the "Known limits and next" section of DESIGN.md, its links as the guides links', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'status-'));
        try {
            fs.writeFileSync(
                path.join(root, 'DESIGN.md'),
                '# Design\n## Grid\nnot this\n## Known limits and next\n### Bugs\n* see [editing](guides/05-editing.md)\n'
            );
            const { html } = status.readStatus({ env: {}, root });
            expect(html).toContain('Bugs</h3>');
            expect(html).toContain('href="#guide/editing"');
            expect(html).not.toContain('not this');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('expect "None known." without DESIGN.md', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'status-'));
        try {
            expect(status.readStatus({ env: {}, root }).html).toContain('None known.');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('expect the links of a file at the root to go where the guides links go', () => {
        expect(status.rootLinks('see [editing](guides/05-editing.md#undo) and [the migration](MIGRATION2V6.md)')).toBe(
            'see [editing](05-editing.md#undo) and [the migration](../MIGRATION2V6.md)'
        );
        expect(status.rootLinks('[a site](https://x.no) [a place](#here)')).toBe('[a site](https://x.no) [a place](#here)');
    });
});

describe('docs site status - what it is built from', () => {
    it('expect the https address of a remote, without a user or a token: the page is public', () => {
        expect(status.httpsUrl('git@github.com:airemote/simple-html.git')).toBe('https://github.com/airemote/simple-html');
        expect(status.httpsUrl('https://user:secret@github.com/airemote/simple-html.git')).toBe(
            'https://github.com/airemote/simple-html'
        );
        expect(status.httpsUrl('/some/folder')).toBe('');
    });

    it('expect git locally: the branch, the commit, its date, local changes', () => {
        const answers: Record<string, string> = {
            'rev-parse HEAD': 'abcdef1234567890abcdef1234567890abcdef12',
            'remote get-url origin': 'git@github.com:a/b.git',
            'rev-parse --abbrev-ref HEAD': 'v6_maybe',
            'log -1 --format=%cI': '2026-11-21T17:50:52+01:00',
            'status --porcelain': ' M file.ts'
        };
        expect(status.buildInfo({}, (args: string[]) => answers[args.join(' ')] ?? '', '6.0.0')).toEqual({
            branch: 'v6_maybe',
            commit: 'abcdef1',
            sha: 'abcdef1234567890abcdef1234567890abcdef12',
            date: '2026-11-21T17:50:52+01:00',
            localChanges: true,
            url: 'https://github.com/a/b/commit/abcdef1234567890abcdef1234567890abcdef12',
            version: '6.0.0',
            dev: false,
            built: expect.stringMatching(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/)
        });
    });

    it("expect a github action's variables: it checks out the commit alone, git sees no branch", () => {
        const env = {
            GITHUB_ACTIONS: 'true',
            GITHUB_REF_NAME: 'v6_maybe',
            GITHUB_SHA: '1234567890abcdef1234567890abcdef12345678',
            GITHUB_SERVER_URL: 'https://github.com',
            GITHUB_REPOSITORY: 'airemote/simple-html'
        };
        const build = status.buildInfo(env, (args: string[]) =>
            args[0] === 'status' ? ' M dirty' : args[0] === 'rev-parse' ? 'HEAD' : ''
        );
        expect([build.branch, build.commit, build.localChanges, build.url]).toEqual([
            'v6_maybe',
            '1234567',
            false,
            'https://github.com/airemote/simple-html/commit/1234567890abcdef1234567890abcdef12345678'
        ]);
    });

    it("expect a pull request's branch, not its ref name 64/merge", () => {
        const env = { GITHUB_ACTIONS: 'true', GITHUB_REF_NAME: '64/merge', GITHUB_HEAD_REF: 'v6_maybe' };
        expect(status.buildInfo(env, () => 'HEAD').branch).toBe('v6_maybe');
    });

    it('expect DOCS_DEV=1 to be a dev build, the version of package.json when none is given', () => {
        const env = {
            GITHUB_ACTIONS: 'true',
            GITHUB_REF_NAME: 'master',
            GITHUB_SHA: '2222222222222222222222222222222222222222',
            DOCS_DEV: '1'
        };
        const build = status.buildInfo(env, () => '');
        expect([build.commit, build.dev]).toEqual(['2222222', true]);
        expect(build.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('expect no git at all to give unknown, and no link', () => {
        const build = status.buildInfo({}, () => '');
        expect([build.branch, build.commit, build.url, build.localChanges]).toEqual(['unknown', 'unknown', '', false]);
    });
});
