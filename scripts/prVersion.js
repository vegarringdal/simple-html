const fs = require('node:fs');
const path = require('node:path');

/**
 * The version of a pull request to master (pr.yml): it changes only in a release pull request, so it is not
 * bumped by accident. A pull request that changes the version in package.json must
 *
 * - come from a branch of this repository, not a fork
 * - be the branch `release/<version>`
 * - have the title `chore: <version>`
 * - set a final version (`6.0.1`) higher than master's
 * - have package-lock.json at the same version (`npm version 6.0.1 --no-git-tag-version` sets both)
 *
 * And a branch `release/...` must change it: a release pull request that forgot the bump fails too. See
 * the README, "Releases".
 *
 * Usage: node scripts/prVersion.js - reads package.json and package-lock.json of the checkout (the pull
 * request merged), and BASE_VERSION (master's), BRANCH, TITLE, HEAD_REPO and REPO from the environment.
 * Exits 1 with an ::error:: per problem.
 */

/**
 * A final version as numbers, null for anything else (`6.0.1-next.1`)
 * @param {string} version
 */
function parseVersion(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
    return match ? match.slice(1).map(Number) : null;
}

/**
 * What is wrong with a pull request's version: [] when nothing is
 * @param {{ baseVersion: string, version: string, lockVersion: string, branch: string, title: string,
 *   headRepo: string, repo: string }} pr
 * @returns {string[]}
 */
function versionProblems({ baseVersion, version, lockVersion, branch, title, headRepo, repo }) {
    const release = String(branch).startsWith('release/');
    if (version === baseVersion) {
        return release
            ? [
                  `the branch ${branch} is a release, but the version is still ${version} - run npm version <version> --no-git-tag-version`
              ]
            : [];
    }
    const problems = [];
    const changed = `the version is changed from ${baseVersion} to ${version}`;
    const own = parseVersion(version);
    const base = parseVersion(baseVersion);
    if (!own) {
        problems.push(`${changed}: it must be a final version like 6.0.1`);
    } else if (base && (own[0] - base[0] || own[1] - base[1] || own[2] - base[2]) < 0) {
        problems.push(`${changed}: it must be higher than master's`);
    }
    if (!headRepo || headRepo !== repo) {
        problems.push(`${changed}: a release comes from a branch of ${repo}, not from ${headRepo || 'a fork'}`);
    }
    if (branch !== `release/${version}`) {
        problems.push(`${changed}: only the branch release/${version} may change it, not ${branch}`);
    }
    if (String(title).trim() !== `chore: ${version}`) {
        problems.push(`${changed}: the title must be 'chore: ${version}', not '${title}'`);
    }
    if (lockVersion !== version) {
        problems.push(`${changed}, but package-lock.json has ${lockVersion} - run npm version ${version} --no-git-tag-version`);
    }
    return problems;
}

function run() {
    const root = path.resolve(__dirname, '..');
    const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    const lock = read('package-lock.json');
    const problems = versionProblems({
        baseVersion: process.env.BASE_VERSION ?? '',
        version: read('package.json').version,
        // the root package of the lock, else its top
        lockVersion: lock.packages?.['']?.version ?? lock.version,
        branch: process.env.BRANCH ?? '',
        title: process.env.TITLE ?? '',
        headRepo: process.env.HEAD_REPO ?? '',
        repo: process.env.REPO ?? ''
    });
    for (const problem of problems) {
        console.log(`::error::${problem}`);
    }
    if (problems.length) {
        process.exit(1);
    }
    console.log('the version is as it should be');
}

if (require.main === module) {
    run();
}

module.exports = { versionProblems };
