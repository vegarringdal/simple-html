import { describe, expect, it } from 'vitest';

// plain node, as the workflows run it
const { changelogEntries, changelogSection, previousRelease, releaseNotes } = require('../releaseNotes.js');

/**
 * scripts/releaseNotes.js: the notes of the GitHub Release publish.yml makes - the install lines of the
 * tgz attached to it, and what changed: the dated entries since the release before (CLAUDE.MD), and a
 * section of the version as 6.0.0 has
 */

const changelog = [
    '# Changelog',
    '',
    '- **2026.12.10** (>6.1.0):',
    '  After 6.1.0 was bumped to: in 6.2.0.',
    '',
    '- **2026.12.05** (>6.0.1):',
    '  A fix after the bump to 6.0.1.',
    '  Another change that day.',
    '',
    '- **2026.12.01** (>6.0.0):',
    '  The first change after 6.0.0.',
    '',
    '## 6.0.0 (2026-11-27)',
    '',
    'v6 is a rewrite.',
    ''
].join('\n');

describe('releaseNotes', () => {
    it('expect the release before: the highest tag v<x.y.z> below the version', () => {
        expect(previousRelease('6.1.0', ['v6.0.0', 'v5.0.1', 'v6.1.0', 'v7.0.0', 'v6.0.0-next.3', 'other'])).toBe('6.0.0');
        expect(previousRelease('6.0.0', ['v6.0.0'])).toBeNull();
        expect(previousRelease('6.0.0', [])).toBeNull();
    });

    it('expect the entries from the release before up to the release, newest first, as they are', () => {
        expect(changelogEntries(changelog, '6.0.0', '6.1.0')).toEqual(
            [
                '- **2026.12.05** (>6.0.1):',
                '  A fix after the bump to 6.0.1.',
                '  Another change that day.',
                '',
                '- **2026.12.01** (>6.0.0):',
                '  The first change after 6.0.0.'
            ].join('\n')
        );
        expect(changelogEntries(changelog, '6.1.0', '6.2.0')).toEqual(
            ['- **2026.12.10** (>6.1.0):', '  After 6.1.0 was bumped to: in 6.2.0.'].join('\n')
        );
        // no release before: every entry below the version
        expect(changelogEntries(changelog, null, '6.1.0')).toContain('2026.12.01');
        expect(changelogEntries(changelog, null, '6.0.0')).toEqual('');
    });

    it("expect a version's section without its heading, and none for a version without one or a prefix", () => {
        expect(changelogSection(changelog, '6.0.0')).toEqual('v6 is a rewrite.');
        expect(changelogSection(changelog, '6.1.0')).toEqual('');
        expect(changelogSection(changelog, '6.0')).toEqual('');
    });

    it("expect the install lines with the release's address, then the changes", () => {
        const notes = releaseNotes({
            changelog,
            version: '6.1.0',
            tgz: 'simple-html-grid-6.1.0.tgz',
            repository: 'AirEmote/simple-html',
            tags: ['v6.0.0']
        });
        expect(notes).toContain(
            'npm install https://github.com/AirEmote/simple-html/releases/download/v6.1.0/simple-html-grid-6.1.0.tgz'
        );
        expect(notes).toContain('npm install ./simple-html-grid-6.1.0.tgz');
        expect(notes).toContain('## Changes\n\n- **2026.12.05** (>6.0.1):');
        expect(notes.endsWith('  The first change after 6.0.0.\n')).toBe(true);
        expect(notes).not.toContain('v6 is a rewrite');
        expect(notes).not.toContain('2026.12.10');
    });

    it('expect the section of 6.0.0, the first release', () => {
        const notes = releaseNotes({ changelog, version: '6.0.0', tgz: 'x.tgz', repository: 'a/b', tags: [] });
        expect(notes).toContain('## Changes\n\nv6 is a rewrite.\n');
    });

    it('expect a line that says so when the changelog has nothing, and an error without the repository', () => {
        const notes = releaseNotes({ changelog, version: '7.0.0', tgz: 'x.tgz', repository: 'a/b', tags: ['v6.2.0'] });
        expect(notes).toContain('CHANGELOG.md has nothing for 7.0.0.');
        expect(() => releaseNotes({ changelog, version: '7.0.0', tgz: 'x.tgz', repository: '' })).toThrow(
            'GITHUB_REPOSITORY must be set'
        );
    });
});
