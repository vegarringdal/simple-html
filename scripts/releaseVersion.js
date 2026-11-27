const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * The version of a release, from the titles of the pull requests merged to master (conventional
 * commits). For the workflows pr.yml and release.yml:
 *
 * - **a pull request's title** says what it is: `fix: ...` a patch, `feat: ...` a minor version,
 *   `fix!: ...` or `feat!: ...` a major one (something breaks). `chore:`, `docs:`, `test:`,
 *   `refactor:`, `ci:`, `build:`, `perf:` and `style:` are merged without a release. A scope is
 *   allowed: `feat(grid): ...`. Anything else is refused - the check of pr.yml fails until it is renamed
 * - **a pull request does not change the version** in package.json or package-lock.json: the release
 *   does, so two pull requests never both claim one version
 * - **the release** (a push to master) reads the commits since the tag of the version in package.json
 *   (`v6.0.0`), the first parents only: one commit per pull request. A squash merge's subject is the
 *   title (`feat: a find bar (#64)`), a merge commit's (`Merge pull request #64 from ...`) is looked up
 *   on github. The biggest bump of them makes the new version, written to package.json and
 *   package-lock.json; no `fix`/`feat` among them, no release. Without the tag (the first release of
 *   this workflow) only the last commit counts
 *
 * Usage:
 *   node scripts/releaseVersion.js check-pr   TITLE, BASE (a git ref: origin/master) in the environment
 *   node scripts/releaseVersion.js next       GITHUB_REPOSITORY, GITHUB_TOKEN to look up merge commits
 * Writes to GITHUB_OUTPUT and GITHUB_STEP_SUMMARY when they are set; `next` the notes of the release
 * to RELEASE_NOTES (a file outside the repo, the temp folder's release-notes.md when it is not set).
 */

const ROOT = path.resolve(__dirname, '..');

/** the bump of each type a title may start with; null: merged without a release */
const TYPES = {
    feat: 'minor',
    fix: 'patch',
    chore: null,
    docs: null,
    test: null,
    refactor: null,
    ci: null,
    build: null,
    perf: null,
    style: null
};

const ORDER = [null, 'patch', 'minor', 'major'];

const ALLOWED =
    'fix: / feat: (a release), fix!: / feat!: (a breaking release), or chore: / docs: / test: / refactor: / ci: / build: / perf: / style: (no release)';

/**
 * What a pull request's title says
 * @param {string} title `feat(grid)!: a find bar (#64)`
 * @returns {{ type: string, breaking: boolean, bump: 'major' | 'minor' | 'patch' | null, text: string } | { error: string }}
 *   text: the title without the type, for the release notes
 */
function parseTitle(title) {
    const match = /^(\w+)(?:\(([\w./-]+)\))?(!?):\s*(\S.*)$/.exec(String(title).trim());
    if (!match || !(match[1] in TYPES)) {
        return { error: `the title '${title}' must start with ${ALLOWED}` };
    }
    const [, type, , bang, text] = match;
    const breaking = bang === '!';
    if (breaking && TYPES[type] === null) {
        return { error: `the title '${title}' is ${type}!: - only fix!: and feat!: can break something, and are a release` };
    }
    return { type, breaking, bump: breaking ? 'major' : TYPES[type], text };
}

/**
 * @param {string} version `6.0.0`, a final version
 * @param {'major' | 'minor' | 'patch'} bump
 */
function bumpVersion(version, bump) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
    if (!match) {
        throw new Error(`releaseVersion: the version in package.json must be a final version like 6.0.0, not '${version}'`);
    }
    const [major, minor, patch] = match.slice(1).map(Number);
    if (bump === 'major') {
        return `${major + 1}.0.0`;
    }
    if (bump === 'minor') {
        return `${major}.${minor + 1}.0`;
    }
    if (bump === 'patch') {
        return `${major}.${minor}.${patch + 1}`;
    }
    throw new Error(`releaseVersion: major, minor or patch, not '${bump}'`);
}

/**
 * The release of the titles merged since the last one: the biggest bump and the notes. A title that
 * is not a conventional one (a commit pushed to master by hand) is left out
 * @param {string} version the version in package.json, the last release
 * @param {string[]} titles
 * @returns {{ bump: 'major' | 'minor' | 'patch' | null, version: string | null, notes: string }}
 */
function releaseOf(version, titles) {
    const parsed = titles.map(parseTitle).filter((each) => !('error' in each) && each.bump);
    const bump = parsed.reduce(
        (biggest, each) => (ORDER.indexOf(each.bump) > ORDER.indexOf(biggest) ? each.bump : biggest),
        null
    );
    if (!bump) {
        return { bump: null, version: null, notes: '' };
    }
    const section = (heading, list) => (list.length ? [`### ${heading}`, '', ...list.map((each) => `- ${each.text}`), ''] : []);
    const notes = [
        ...section(
            'Breaking',
            parsed.filter((each) => each.breaking)
        ),
        ...section(
            'Features',
            parsed.filter((each) => !each.breaking && each.type === 'feat')
        ),
        ...section(
            'Fixes',
            parsed.filter((each) => !each.breaking && each.type === 'fix')
        )
    ].join('\n');
    return { bump, version: bumpVersion(version, bump), notes };
}

/**
 * What pr.yml checks: the title, and the version left as it is on the branch it goes to
 * @param {string} title
 * @param {{ version: string, lockVersion: string }} head package.json and package-lock.json of the pull request
 * @param {{ version: string, lockVersion: string }} base the same on the branch it is merged to
 * @returns {{ errors: string[], release: string }} release: what merging it releases, for the summary
 */
function checkPullRequest(title, head, base) {
    const errors = [];
    const parsed = parseTitle(title);
    if ('error' in parsed) {
        errors.push(parsed.error);
    }
    if (head.version !== base.version || head.lockVersion !== base.lockVersion) {
        errors.push(
            `the version is ${base.version} on the base branch and must stay so - the release sets it when this is merged ` +
                `(package.json ${head.version}, package-lock.json ${head.lockVersion})`
        );
    }
    let release = '';
    if (!('error' in parsed)) {
        release = parsed.bump
            ? `Merging it releases ${bumpVersion(base.version, parsed.bump)} (${parsed.bump}${parsed.breaking ? ', breaking' : ''})`
            : `Merging it releases nothing (${parsed.type})`;
    }
    return { errors, release };
}

/** runs git in the repo */
function git(args) {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
        .toString()
        .trim();
}

/** the version of package.json and of package-lock.json at a git ref ('' for the files on disk) */
function versionsAt(ref) {
    const read = (file) => JSON.parse(ref ? git(['show', `${ref}:${file}`]) : fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const lock = read('package-lock.json');
    return { version: read('package.json').version, lockVersion: lock.version };
}

/** appends lines to the file a github action variable names, when it is set */
function appendTo(variable, text) {
    if (process.env[variable]) {
        fs.appendFileSync(process.env[variable], `${text}\n`);
    }
}

function checkPr() {
    const { TITLE, BASE } = process.env;
    if (!BASE) {
        throw new Error('releaseVersion: BASE must be set, the git ref of the branch the pull request goes to');
    }
    const { errors, release } = checkPullRequest(TITLE ?? '', versionsAt(''), versionsAt(BASE));
    for (const error of errors) {
        console.log(`::error::${error}`);
    }
    if (release) {
        console.log(release);
        appendTo('GITHUB_STEP_SUMMARY', release);
    }
    process.exitCode = errors.length ? 1 : 0;
}

/** the title of a pull request on github, for a merge commit */
async function pullRequestTitle(number) {
    const { GITHUB_REPOSITORY, GITHUB_TOKEN } = process.env;
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${number}`, {
        headers: { accept: 'application/vnd.github+json', ...(GITHUB_TOKEN ? { authorization: `Bearer ${GITHUB_TOKEN}` } : {}) }
    });
    if (!response.ok) {
        throw new Error(`releaseVersion: pull request #${number} could not be read (${response.status})`);
    }
    return (await response.json()).title;
}

async function next() {
    const current = versionsAt('');
    const tag = `v${current.version}`;
    const tagged = git(['tag', '--list', tag]) === tag;
    // one commit per pull request: the first parents; without the tag the last commit only
    const subjects = git(['log', '--first-parent', '--format=%s', tagged ? `${tag}..HEAD` : '-1'])
        .split('\n')
        .filter(Boolean);
    const titles = [];
    for (const subject of subjects) {
        const merge = /^Merge pull request #(\d+) /.exec(subject);
        titles.push(merge ? await pullRequestTitle(merge[1]) : subject);
    }
    const release = releaseOf(current.version, titles);
    console.log(
        `since ${tagged ? tag : 'the last commit (no tag ' + tag + ')'}:\n${titles.map((t) => `  ${t}`).join('\n') || '  nothing'}`
    );
    if (!release.version) {
        console.log('no fix: or feat: - nothing to release');
        appendTo('GITHUB_OUTPUT', 'released=false');
        return;
    }
    for (const file of ['package.json', 'package-lock.json']) {
        const full = path.join(ROOT, file);
        const json = JSON.parse(fs.readFileSync(full, 'utf8'));
        json.version = release.version;
        if (json.packages?.['']) {
            json.packages[''].version = release.version;
        }
        fs.writeFileSync(full, `${JSON.stringify(json, null, 4)}\n`);
    }
    console.log(`release ${release.version} (${release.bump})\n${release.notes}`);
    // out of the repo: the checks and the package do not see it
    fs.writeFileSync(process.env.RELEASE_NOTES || path.join(require('node:os').tmpdir(), 'release-notes.md'), release.notes);
    appendTo('GITHUB_OUTPUT', `released=true\nversion=${release.version}\nbump=${release.bump}`);
}

if (require.main === module) {
    const command = process.argv[2];
    const run = command === 'check-pr' ? async () => checkPr() : command === 'next' ? next : null;
    if (!run) {
        console.error("releaseVersion: 'check-pr' or 'next'");
        process.exit(1);
    }
    run().catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}

module.exports = { parseTitle, bumpVersion, releaseOf, checkPullRequest };
