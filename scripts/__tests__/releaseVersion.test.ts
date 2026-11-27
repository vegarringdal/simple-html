import { describe, expect, it } from 'vitest';

// plain node, as the workflows run it
const { parseTitle, bumpVersion, releaseOf, checkPullRequest } = require('../releaseVersion.js');

/**
 * scripts/releaseVersion.js: the title of a pull request says what it releases (pr.yml checks it), the
 * release on master bumps the version by the biggest of the titles merged since the last one (release.yml)
 */

describe('releaseVersion - the title of a pull request', () => {
    it('expect fix a patch, feat a minor, ! a major, a scope allowed', () => {
        expect(parseTitle('fix: the filter of a date')).toEqual({
            type: 'fix',
            breaking: false,
            bump: 'patch',
            text: 'the filter of a date'
        });
        expect(parseTitle('feat(grid): a find bar').bump).toBe('minor');
        expect(parseTitle('feat!: Formatter spelled right')).toMatchObject({ breaking: true, bump: 'major' });
        expect(parseTitle('fix(datasource)!: no undo of a reset').bump).toBe('major');
        // a squash merge's subject: the number of the pull request after the title
        expect(parseTitle('fix: a typo (#64)').text).toBe('a typo (#64)');
    });

    it('expect chore, docs, test, refactor, ci, build, perf and style merged without a release', () => {
        for (const type of ['chore', 'docs', 'test', 'refactor', 'ci', 'build', 'perf', 'style']) {
            expect(parseTitle(`${type}: something`)).toMatchObject({ type, bump: null });
        }
    });

    it('expect anything else refused, saying what is allowed', () => {
        for (const title of ['A find bar', 'feature: a find bar', 'fix:', 'Fix: upper case', '!fix: in front', 'fix - a dash']) {
            expect(parseTitle(title).error).toContain('must start with fix: / feat: (a release)');
        }
        expect(parseTitle('chore!: tidy').error).toBe(
            "the title 'chore!: tidy' is chore!: - only fix!: and feat!: can break something, and are a release"
        );
    });
});

describe('releaseVersion - the version', () => {
    it('expect a bump to reset what is below it', () => {
        expect(['major', 'minor', 'patch'].map((bump) => bumpVersion('5.2.7', bump))).toEqual(['6.0.0', '5.3.0', '5.2.8']);
        expect(() => bumpVersion('6.0.0-next.3', 'patch')).toThrow('must be a final version like 6.0.0');
    });

    it('expect the biggest bump of the titles, notes by kind, the rest left out', () => {
        expect(
            releaseOf('5.0.1', ['fix: one (#3)', 'chore(release): 5.0.1', 'feat: two (#4)', 'Fix the build', 'fix: three'])
        ).toEqual({
            bump: 'minor',
            version: '5.1.0',
            notes: '### Features\n\n- two (#4)\n\n### Fixes\n\n- one (#3)\n- three\n'
        });
        expect(releaseOf('5.0.1', ['feat!: version 6', 'fix: a bug'])).toMatchObject({
            bump: 'major',
            version: '6.0.0',
            notes: '### Breaking\n\n- version 6\n\n### Fixes\n\n- a bug\n'
        });
    });

    it('expect no fix or feat: no release', () => {
        expect(releaseOf('5.0.1', ['chore: tidy', 'docs: a guide', 'pushed by hand'])).toEqual({
            bump: null,
            version: null,
            notes: ''
        });
        expect(releaseOf('5.0.1', [])).toMatchObject({ version: null });
    });
});

describe('releaseVersion - the check of a pull request', () => {
    const same = { version: '5.0.1', lockVersion: '5.0.1' };

    it('expect a good title and the version left alone to pass, saying what merging it releases', () => {
        expect(checkPullRequest('feat: a find bar', same, same)).toEqual({
            errors: [],
            release: 'Merging it releases 5.1.0 (minor)'
        });
        expect(checkPullRequest('fix!: no undo', same, same).release).toBe('Merging it releases 6.0.0 (major, breaking)');
        expect(checkPullRequest('docs: a guide', same, same).release).toBe('Merging it releases nothing (docs)');
    });

    it('expect a bad title or a version changed in either file to fail', () => {
        expect(checkPullRequest('A find bar', same, same).errors).toHaveLength(1);
        expect(checkPullRequest('fix: x', { version: '5.0.2', lockVersion: '5.0.2' }, same).errors).toEqual([
            'the version is 5.0.1 on the base branch and must stay so - the release sets it when this is merged (package.json 5.0.2, package-lock.json 5.0.2)'
        ]);
        expect(checkPullRequest('fix: x', { version: '5.0.1', lockVersion: '6.0.0' }, same).errors).toHaveLength(1);
        expect(checkPullRequest('nope', { version: '6.0.0', lockVersion: '6.0.0' }, same)).toMatchObject({
            release: ''
        });
    });
});
