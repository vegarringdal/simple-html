const fs = require('node:fs');
const path = require('node:path');

/**
 * Gets package.json ready for GitHub Packages (npm.pkg.github.com), for the workflows release.yml
 * and beta.yml - it is changed in the checkout of the workflow only, never committed:
 *
 * - **the name**: GitHub Packages takes a package only in the scope of the repository's owner, so
 *   `@simple-html/grid` is published as `@<owner>/simple-html-grid` (the owner in lower case, as npm
 *   wants it). Install it under its own name with an npm alias, so the imports stay
 *   `@simple-html/grid`: `npm install @simple-html/grid@npm:@<owner>/simple-html-grid`
 * - **the repository**: the one the workflow runs in - GitHub Packages links the package to it, and
 *   the workflow's token may only publish to that one
 * - **the version**: `release` publishes the version of package.json as it is, a final version
 *   (`6.0.0`) only. `beta` publishes `<version>-beta.<branch>.<run>` (`6.0.0-beta.v6-maybe.42`): the
 *   branch made safe for a version (letters, digits, `-`), the run number of the workflow, so every
 *   run is a new version. Its npm tag is `beta-<branch>`: `npm install ...@beta-v6-maybe` gets the
 *   latest beta of that branch, `latest` stays the last release
 *
 * Usage: node scripts/githubPackage.js release|beta
 * Reads GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY, GITHUB_REF_NAME and GITHUB_RUN_NUMBER (set by GitHub
 * Actions). Writes `version` and `tag` to GITHUB_OUTPUT when it is set, and prints them.
 */

/** a branch name as a part of a version and an npm tag: `feature/Find_bar` is `feature-find-bar` */
function branchSlug(branch) {
    const slug = String(branch)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    if (!slug) {
        throw new Error(`githubPackage: no version can be made of the branch name '${branch}'`);
    }
    return slug;
}

/**
 * The package.json fields and the npm tag to publish with
 * @param {'release' | 'beta'} kind
 * @param {{ version: string }} pkg the package.json as it is
 * @param {{ owner: string, repository: string, branch: string, run: string }} env
 * @returns {{ name: string, version: string, tag: string, repositoryUrl: string }}
 */
function packageFor(kind, pkg, env) {
    if (!env.owner || !env.repository) {
        throw new Error('githubPackage: GITHUB_REPOSITORY_OWNER and GITHUB_REPOSITORY must be set (GitHub Actions sets them)');
    }
    const base = String(pkg.version);
    if (!/^\d+\.\d+\.\d+$/.test(base)) {
        throw new Error(`githubPackage: the version in package.json must be a final version like 6.0.0, not '${base}'`);
    }
    const name = `@${env.owner.toLowerCase()}/simple-html-grid`;
    const repositoryUrl = `git+https://github.com/${env.repository}.git`;
    if (kind === 'release') {
        return { name, version: base, tag: 'latest', repositoryUrl };
    }
    if (kind === 'beta') {
        if (!/^\d+$/.test(String(env.run))) {
            throw new Error('githubPackage: GITHUB_RUN_NUMBER must be set for a beta (GitHub Actions sets it)');
        }
        const slug = branchSlug(env.branch);
        return { name, version: `${base}-beta.${slug}.${env.run}`, tag: `beta-${slug}`, repositoryUrl };
    }
    throw new Error(`githubPackage: 'release' or 'beta', not '${kind}'`);
}

function run() {
    const kind = process.argv[2];
    const file = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const result = packageFor(kind, pkg, {
        owner: process.env.GITHUB_REPOSITORY_OWNER,
        repository: process.env.GITHUB_REPOSITORY,
        branch: process.env.GITHUB_REF_NAME,
        run: process.env.GITHUB_RUN_NUMBER
    });
    pkg.name = result.name;
    pkg.version = result.version;
    pkg.repository = { type: 'git', url: result.repositoryUrl };
    pkg.publishConfig = { registry: 'https://npm.pkg.github.com' };
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 4)}\n`);

    const lines = [`name=${result.name}`, `version=${result.version}`, `tag=${result.tag}`];
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
    }
    console.log(lines.join('\n'));
}

if (require.main === module) {
    run();
}

module.exports = { branchSlug, packageFor };
