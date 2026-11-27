const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { renderMarkdown } = require('./markdown');

const ROOT = path.resolve(__dirname, '../..');

/**
 * The "Known limits" page of the docs site and the build line in its sidebar: what the site was
 * built from, and what is known not to work yet - made from the repo when the site is built, so it is
 * never behind (esbuildPlugin.js gives it as `docs:status`):
 * - the branch, the commit and its date (git; in a github action its own variables: the action checks
 *   out the commit alone, git sees no branch there), and whether there were local changes
 * - the "Known limits and next" section of DESIGN.md: the known issues and what could come next
 */

/** the heading of DESIGN.md the page shows */
const KNOWN_LIMITS = 'Known limits and next';

/**
 * runs git in the repo, '' when it fails (no git, no repo: a copy of the files)
 * @param {string[]} args
 */
function git(args) {
    try {
        return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim();
    } catch {
        return '';
    }
}

/**
 * The https address of a git remote, for a link to a commit: `git@github.com:a/b.git` and
 * `https://user:token@github.com/a/b.git` are `https://github.com/a/b`. A user name or a token in it
 * is left out - the page is public. '' for anything else
 * @param {string} remote
 */
function httpsUrl(remote) {
    const ssh = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(remote);
    if (ssh) {
        return `https://${ssh[1]}/${ssh[2]}`;
    }
    const https = /^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(remote);
    return https ? `https://${https[1]}/${https[2]}` : '';
}

/**
 * What the site is built from
 * @param {NodeJS.ProcessEnv} [env] the environment: in a github action GITHUB_REF_NAME, GITHUB_SHA,
 *   GITHUB_SERVER_URL and GITHUB_REPOSITORY say it - for a pull request GITHUB_HEAD_REF, its branch (the
 *   ref name is `64/merge` there). DOCS_DEV=1: the docs of a branch, deployed under
 *   dev/ (pages.yml)
 * @param {(args: string[]) => string} [runGit] for the tests
 * @param {string} [version] the version in package.json
 * @returns {{ branch: string, commit: string, sha: string, date: string, localChanges: boolean, url: string,
 *   version: string, dev: boolean, built: string }}
 *   commit: the short hash; date: the commit's (ISO); url: the commit on github, '' when unknown;
 *   built: when the site was built (ISO, UTC)
 */
function buildInfo(env = process.env, runGit = git, version = packageVersion()) {
    const sha = env.GITHUB_SHA || runGit(['rev-parse', 'HEAD']);
    const repo =
        env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY
            ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}`
            : httpsUrl(runGit(['remote', 'get-url', 'origin']));
    return {
        branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || runGit(['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown',
        commit: sha ? sha.slice(0, 7) : 'unknown',
        sha,
        date: runGit(['log', '-1', '--format=%cI']),
        // an action builds a clean checkout; locally the site can be built from files not committed yet
        localChanges: !env.GITHUB_ACTIONS && runGit(['status', '--porcelain']) !== '',
        url: repo && sha ? `${repo}/commit/${sha}` : '',
        version,
        dev: env.DOCS_DEV === '1',
        built: new Date().toISOString()
    };
}

/** the version in package.json, '' when it can not be read */
function packageVersion() {
    try {
        return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version ?? '';
    } catch {
        return '';
    }
}

/**
 * A section of a markdown file, by its `## ` heading: the lines after the heading up to the next one
 * (or the end). '' when it has no such heading
 * @param {string} markdown
 * @param {string} title the heading's text
 */
function markdownSection(markdown, title) {
    const lines = markdown.split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim() === `## ${title}`);
    if (start === -1) {
        return '';
    }
    const end = lines.findIndex((line, i) => i > start && /^## /.test(line));
    return lines
        .slice(start + 1, end === -1 ? undefined : end)
        .join('\n')
        .trim();
}

/**
 * The links of a markdown file at the root of the repo as the guides write them (renderMarkdown takes
 * links from guides/): `guides/05-editing.md` is `05-editing.md`, a page of the site, `MIGRATION2V6.md`
 * is `../MIGRATION2V6.md`, the file on github
 * @param {string} markdown
 */
function rootLinks(markdown) {
    return markdown.replace(/\]\((?!https?:|#|\/|\.\.\/)([^)]+)\)/g, (_link, target) =>
        target.startsWith('guides/') ? `](${target.slice('guides/'.length)})` : `](../${target})`
    );
}

/**
 * The status of the site: the build line and the known limits page, as `docs:status` gives them
 * @param {{ env?: NodeJS.ProcessEnv, root?: string }} [options] the environment and the folder of
 *   DESIGN.md, for the tests
 * @returns {{ build: ReturnType<typeof buildInfo>, html: string }}
 */
function readStatus({ env = process.env, root = ROOT } = {}) {
    const file = path.join(root, 'DESIGN.md');
    const limits = markdownSection(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '', KNOWN_LIMITS);
    return { build: buildInfo(env), html: renderMarkdown(rootLinks(limits || 'None known.')) };
}

module.exports = { buildInfo, httpsUrl, markdownSection, readStatus, rootLinks };
