const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { renderMarkdown } = require('./markdown');

const ROOT = path.resolve(__dirname, '../..');

/**
 * The "Work in progress" page of the docs site and the build line in its sidebar: what the site was
 * built from, and what is still open - made from the repo when the site is built, so it is never
 * behind (esbuildPlugin.js gives it as `docs:status`):
 * - the branch, the commit and its date (git; in a github action its own variables: the action checks
 *   out the commit alone, git sees no branch there), and whether there were local changes
 * - the open items of V6_PLAN.md (`[ ]`) under their headings, and its "Now:" line
 * - the "Candidates / not started" section of IMPORVEMENT.md: the known issues and what is left
 */

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
 *   GITHUB_SERVER_URL and GITHUB_REPOSITORY say it. DOCS_DEV=1: the docs of a branch, deployed under
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
        branch: env.GITHUB_REF_NAME || runGit(['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown',
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
 * The open items of a plan: the `[ ]` items (`12. [ ] ...` or `- [ ] ...`, with the lines that go on
 * under them) under the `##` heading they are in, and the text after `**Now:**`. An item marked
 * "(moved to item N)" is left out: it is done there
 * @param {string} plan the markdown of V6_PLAN.md
 * @returns {{ now: string, sections: { heading: string, items: string[] }[] }} items: the markdown of each
 */
function openPlanItems(plan) {
    const lines = plan.split(/\r?\n/);
    const sections = [];
    let heading = '';
    let now = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headingMatch = /^## (.+)$/.exec(line);
        if (headingMatch) {
            heading = headingMatch[1].trim();
            continue;
        }
        const nowMatch = /^\*\*Now:\*\*\s*(.+)$/.exec(line);
        if (nowMatch) {
            now = nowMatch[1].trim();
            continue;
        }
        const item = /^(\s*)(?:\d+\.|-) \[ \] (.*)$/.exec(line);
        if (!item) {
            continue;
        }
        // the lines under it: indented more than the item, up to an empty line or the next item
        const indent = item[1].length;
        const text = [item[2]];
        while (i + 1 < lines.length && lines[i + 1].trim() && /^\s*/.exec(lines[i + 1])[0].length > indent) {
            if (/^\s*(?:\d+\.|-) \[[ x]\] /.test(lines[i + 1])) {
                break;
            }
            text.push(lines[++i].trim());
        }
        // an item the plan moved elsewhere is not open: it is done where it went
        if (/\(moved to item \d+\)/i.test(text[0])) {
            continue;
        }
        const number = /^\s*(\d+)\./.exec(line);
        const markdown = `${number ? `**${number[1]}.** ` : ''}${text.join(' ')}`;
        const section = sections.find((s) => s.heading === heading);
        if (section) {
            section.items.push(markdown);
        } else {
            sections.push({ heading, items: [markdown] });
        }
    }
    return { now, sections };
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
 * links from guides/): `guides/05-editing.md` is `05-editing.md`, a page of the site, `MIGRATION.md`
 * is `../MIGRATION.md`, the file on github
 * @param {string} markdown
 */
function rootLinks(markdown) {
    return markdown.replace(/\]\((?!https?:|#|\/|\.\.\/)([^)]+)\)/g, (_link, target) =>
        target.startsWith('guides/') ? `](${target.slice('guides/'.length)})` : `](../${target})`
    );
}

/**
 * The status of the site: the build line and the work in progress page, as `docs:status` gives them
 * @param {{ env?: NodeJS.ProcessEnv, root?: string }} [options] the environment and the folder of
 *   V6_PLAN.md and IMPORVEMENT.md, for the tests
 * @returns {{ build: ReturnType<typeof buildInfo>, now: string, html: string }}
 */
function readStatus({ env = process.env, root = ROOT } = {}) {
    const read = (file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '');
    const plan = openPlanItems(read('V6_PLAN.md'));
    const candidates = markdownSection(read('IMPORVEMENT.md'), 'Candidates / not started');

    const parts = ['## Open in the plan', '', 'The items of `V6_PLAN.md` that are not done yet.', ''];
    if (!plan.sections.length) {
        parts.push('Nothing: every item of the plan is done.', '');
    }
    for (const section of plan.sections) {
        parts.push(`### ${section.heading}`, '', ...section.items.map((item) => `- ${item}`), '');
    }
    parts.push(
        '## Known issues and candidates',
        '',
        'From the "Candidates / not started" section of `IMPORVEMENT.md`: what was found and is not fixed yet,',
        'and what could be done next.',
        '',
        candidates || 'None.'
    );
    return { build: buildInfo(env), now: plan.now, html: renderMarkdown(rootLinks(parts.join('\n'))) };
}

module.exports = { buildInfo, httpsUrl, markdownSection, openPlanItems, readStatus, rootLinks };
