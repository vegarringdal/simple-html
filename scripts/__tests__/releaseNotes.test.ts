import { describe, expect, it } from 'vitest';

// plain node, as the workflows run it
const { changelogSection, releaseNotes } = require('../releaseNotes.js');

/**
 * scripts/releaseNotes.js: the notes of the GitHub Release publish.yml makes - the install lines of the
 * tgz attached to it, and the version's section of the changelog
 */

const changelog = [
    '# Changelog',
    '',
    '## 6.1.0 (2026-12-01)',
    '',
    '### New',
    '',
    '- a thing',
    '',
    '## 6.0.0 (2026-11-27)',
    '',
    'v6 is a rewrite.',
    ''
].join('\n');

describe('releaseNotes', () => {
    it("expect a version's section without its heading, up to the next version", () => {
        expect(changelogSection(changelog, '6.1.0')).toEqual('### New\n\n- a thing');
        expect(changelogSection(changelog, '6.0.0')).toEqual('v6 is a rewrite.');
    });

    it('expect no section for a version the changelog does not have, nor for a prefix of one', () => {
        expect(changelogSection(changelog, '6.2.0')).toEqual('');
        expect(changelogSection(changelog, '6.1')).toEqual('');
    });

    it("expect the install lines with the release's address, then the section", () => {
        const notes = releaseNotes({
            changelog,
            version: '6.1.0',
            tgz: 'simple-html-grid-6.1.0.tgz',
            repository: 'AirEmote/simple-html'
        });
        expect(notes).toContain(
            'npm install https://github.com/AirEmote/simple-html/releases/download/v6.1.0/simple-html-grid-6.1.0.tgz'
        );
        expect(notes).toContain('npm install ./simple-html-grid-6.1.0.tgz');
        expect(notes.endsWith('### New\n\n- a thing\n')).toBe(true);
        expect(notes).not.toContain('v6 is a rewrite');
    });

    it('expect a line that says so when the changelog has no section, and an error without the repository', () => {
        const notes = releaseNotes({ changelog, version: '7.0.0', tgz: 'x.tgz', repository: 'a/b' });
        expect(notes).toContain('CHANGELOG.md has no section for 7.0.0.');
        expect(() => releaseNotes({ changelog, version: '7.0.0', tgz: 'x.tgz', repository: '' })).toThrow(
            'GITHUB_REPOSITORY must be set'
        );
    });
});
