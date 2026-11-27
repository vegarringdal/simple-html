import { describe, expect, it } from 'vitest';

// plain node, as the workflows run it
const { branchSlug, packageFor } = require('../githubPackage.js');

/**
 * scripts/githubPackage.js: what publish.yml, beta.yml and next.yml publish to GitHub Packages - the name in the
 * scope of the repository's owner, the version, the npm tag
 */

const env = { owner: 'AirEmote', repository: 'AirEmote/simple-html', branch: 'v6_maybe', run: '42' };

describe('githubPackage', () => {
    it('expect a release: the version of package.json, latest, the owner as the scope in lower case', () => {
        expect(packageFor('release', { version: '6.0.0' }, env)).toEqual({
            name: '@airemote/simple-html-grid',
            version: '6.0.0',
            tag: 'latest',
            repositoryUrl: 'git+https://github.com/AirEmote/simple-html.git'
        });
    });

    it('expect a beta: the branch and the run in the version, a tag per branch', () => {
        expect(packageFor('beta', { version: '6.0.0' }, env)).toMatchObject({
            version: '6.0.0-beta.v6-maybe.42',
            tag: 'beta-v6-maybe'
        });
    });

    it('expect a next: <version>-next.<run>, the tag next, whatever the branch', () => {
        expect(packageFor('next', { version: '6.0.0' }, env)).toEqual({
            name: '@airemote/simple-html-grid',
            version: '6.0.0-next.42',
            tag: 'next',
            repositoryUrl: 'git+https://github.com/AirEmote/simple-html.git'
        });
        expect(packageFor('next', { version: '6.0.0' }, { ...env, branch: 'feature/x', run: '7' }).version).toEqual(
            '6.0.0-next.7'
        );
    });

    it('expect a branch name made safe for a version and a tag', () => {
        expect(branchSlug('feature/Find_bar')).toEqual('feature-find-bar');
        expect(branchSlug('--fix..01--')).toEqual('fix-01');
        expect(() => branchSlug('///')).toThrow(/no version can be made/);
    });

    it('expect errors: a version that is not final, a kind it does not know, no owner, no run', () => {
        expect(() => packageFor('release', { version: '6.0.0-rc.1' }, env)).toThrow(/a final version/);
        expect(() => packageFor('nightly', { version: '6.0.0' }, env)).toThrow(/'release', 'beta' or 'next'/);
        expect(() => packageFor('release', { version: '6.0.0' }, { ...env, owner: '' })).toThrow(/GITHUB_REPOSITORY_OWNER/);
        expect(() => packageFor('beta', { version: '6.0.0' }, { ...env, run: undefined })).toThrow(/GITHUB_RUN_NUMBER/);
        expect(() => packageFor('next', { version: '6.0.0' }, { ...env, run: '' })).toThrow(
            /GITHUB_RUN_NUMBER must be set for a next/
        );
        // the version of package.json is the base: a pre-release there would be 6.0.0-rc.1-next.42
        expect(() => packageFor('next', { version: '6.0.0-rc.1' }, env)).toThrow(/a final version/);
    });
});
