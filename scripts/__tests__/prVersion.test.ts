import { describe, expect, it } from 'vitest';

// plain node, as the workflow runs it
const { versionProblems } = require('../prVersion.js');

/**
 * scripts/prVersion.js: the version of a pull request to master changes only in a release pull request -
 * from this repository, the branch release/<version>, the title chore: <version> (pr.yml)
 */

const release = {
    baseVersion: '6.0.0',
    version: '6.0.1',
    lockVersion: '6.0.1',
    branch: 'release/6.0.1',
    title: 'chore: 6.0.1',
    headRepo: 'vegarringdal/simple-html',
    repo: 'vegarringdal/simple-html'
};

describe('prVersion', () => {
    it('expect a release pull request to pass', () => {
        expect(versionProblems(release)).toEqual([]);
    });

    it('expect a pull request that leaves the version to pass, whatever its branch, title or repository', () => {
        expect(
            versionProblems({
                ...release,
                version: '6.0.0',
                lockVersion: '6.0.0',
                branch: 'fix/x',
                title: 'fix: x',
                headRepo: 'a/fork'
            })
        ).toEqual([]);
    });

    it('expect a bump by accident to fail: another branch, title, a fork', () => {
        const problems = versionProblems({ ...release, branch: 'fix/x', title: 'fix: x', headRepo: 'airemote/simple-html' });
        expect(problems).toHaveLength(3);
        expect(problems[0]).toContain('not from airemote/simple-html');
        expect(problems[1]).toContain('only the branch release/6.0.1 may change it, not fix/x');
        expect(problems[2]).toContain("the title must be 'chore: 6.0.1', not 'fix: x'");
    });

    it('expect a fork whose repository is gone to fail', () => {
        expect(versionProblems({ ...release, headRepo: '' })).toEqual([
            'the version is changed from 6.0.0 to 6.0.1: a release comes from a branch of vegarringdal/simple-html, not from a fork'
        ]);
    });

    it('expect a version that is not final, or lower than master, to fail', () => {
        expect(
            versionProblems({
                ...release,
                version: '6.0.1-beta.1',
                lockVersion: '6.0.1-beta.1',
                branch: 'release/6.0.1-beta.1',
                title: 'chore: 6.0.1-beta.1'
            })
        ).toEqual(['the version is changed from 6.0.0 to 6.0.1-beta.1: it must be a final version like 6.0.1']);
        expect(
            versionProblems({
                ...release,
                version: '5.9.0',
                lockVersion: '5.9.0',
                branch: 'release/5.9.0',
                title: 'chore: 5.9.0'
            })
        ).toEqual(["the version is changed from 6.0.0 to 5.9.0: it must be higher than master's"]);
    });

    it('expect package-lock.json at another version to fail', () => {
        expect(versionProblems({ ...release, lockVersion: '6.0.0' })).toEqual([
            'the version is changed from 6.0.0 to 6.0.1, but package-lock.json has 6.0.0 - run npm version 6.0.1 --no-git-tag-version'
        ]);
    });

    it('expect a release branch that did not bump the version to fail', () => {
        expect(versionProblems({ ...release, version: '6.0.0', lockVersion: '6.0.0' })).toEqual([
            'the branch release/6.0.1 is a release, but the version is still 6.0.0 - run npm version <version> --no-git-tag-version'
        ]);
    });
});
