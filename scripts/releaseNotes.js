const fs = require('node:fs');
const path = require('node:path');

/**
 * The notes of a GitHub Release, for publish.yml: how to install the tgz attached to the release, then what
 * changed - from CHANGELOG.md:
 *
 * - **the dated entries since the release before**: each change gets an entry at the top of the changelog,
 *   `- **2026.12.01** (>6.0.0):` and its lines under it (see CLAUDE.MD) - `>6.0.0` is the version
 *   package.json had, the entry comes after that release. A release takes the entries from the version
 *   of the release before it up to its own: `(>6.0.0)` and `(>6.0.1)` are in 6.1.0 when 6.0.0 was the
 *   last release, whatever the version was bumped to between. The release before is the highest tag
 *   `v<x.y.z>` below the version (the releases make the tags); with none, every entry below the version
 * - **a section of the version**, `## 6.0.0 (2026-11-27)` up to the next `## ` - as 6.0.0 has one -
 *   without its heading: the release has the version as its title
 *
 * Neither: a line that says so, the release is not stopped by it.
 *
 * The tgz has the package's own name, `@simple-html/grid` (it is packed before scripts/githubPackage.js
 * renames the package for GitHub Packages), so it installs from the release's address without a token
 * or an npm alias - on a public repository.
 *
 * Usage: node scripts/releaseNotes.js <version> <tgz file name> <out file> [tag ...]
 * The tags are the repository's (`v6.0.0`, others are skipped). Reads GITHUB_REPOSITORY (set by GitHub
 * Actions), `owner/name`.
 */

/**
 * A final version as numbers, null for anything else (`6.0.0-next.1`, `v6.0.0`)
 * @param {string} version
 * @returns {number[] | null}
 */
function parseVersion(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
    return match ? match.slice(1).map(Number) : null;
}

/** <0, 0 or >0 as a is lower, the same or higher than b: two parsed versions */
function compareVersions(a, b) {
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * The release before a version: the highest tag `v<x.y.z>` below it, as `x.y.z`. null when there is none
 * @param {string} version `6.1.0`
 * @param {readonly string[]} tags `['v6.0.0', 'v6.1.0', 'something']`
 */
function previousRelease(version, tags) {
    const own = parseVersion(version);
    if (!own) {
        return null;
    }
    let best = null;
    for (const tag of tags) {
        const parsed = /^v/.test(tag) ? parseVersion(tag.slice(1)) : null;
        if (parsed && compareVersions(parsed, own) < 0 && (!best || compareVersions(parsed, best) > 0)) {
            best = parsed;
        }
    }
    return best ? best.join('.') : null;
}

/**
 * The section of a version in the changelog, without its heading, trimmed. '' when it has none
 * @param {string} changelog the text of CHANGELOG.md
 * @param {string} version `6.0.0`
 */
function changelogSection(changelog, version) {
    const lines = changelog.split(/\r?\n/);
    // `## 6.0.0` or `## 6.0.0 (2026-11-27)`, not `## 6.0.0-next.1`
    const start = lines.findIndex((line) => line === `## ${version}` || line.startsWith(`## ${version} `));
    if (start === -1) {
        return '';
    }
    const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
    return lines
        .slice(start + 1, end === -1 ? undefined : end)
        .join('\n')
        .trim();
}

/** the heading of a dated entry: `- **2026.12.01** (>6.0.0):`, the version is the second group */
const ENTRY = /^- \*\*(\d{4}\.\d{2}\.\d{2})\*\* \(>([^)]+)\):\s*$/;

/**
 * The dated entries of a release, as they are in the changelog, newest first: the ones whose version is
 * from the release before (`from`, included; null: from the first) up to the release (`to`, left out)
 * @param {string} changelog the text of CHANGELOG.md
 * @param {string | null} from the release before, `6.0.0`
 * @param {string} to the release, `6.1.0`
 */
function changelogEntries(changelog, from, to) {
    const lower = from ? parseVersion(from) : null;
    const upper = parseVersion(to);
    const entries = [];
    let current = null;
    for (const line of changelog.split(/\r?\n/)) {
        const heading = ENTRY.exec(line);
        if (heading) {
            const version = parseVersion(heading[2]);
            const keep =
                version !== null &&
                upper !== null &&
                compareVersions(version, upper) < 0 &&
                (!lower || compareVersions(version, lower) >= 0);
            current = keep ? [line] : null;
            if (current) {
                entries.push(current);
            }
        } else if (/^\s+\S/.test(line) || line.trim() === '') {
            // a line of the entry, or a blank line in it
            current?.push(line);
        } else {
            // the next section: `## 6.0.0`, or anything that is no entry
            current = null;
        }
    }
    // an entry ends with the blank line before the next: trimmed, they are a blank line apart again
    return entries.map((entry) => entry.join('\n').trimEnd()).join('\n\n');
}

/**
 * The notes: the install lines, then what changed - the dated entries since the release before, and the
 * version's own section
 * @param {{ changelog: string, version: string, tgz: string, repository: string, tags?: readonly string[] }} options
 */
function releaseNotes({ changelog, version, tgz, repository, tags = [] }) {
    if (!repository) {
        throw new Error('releaseNotes: GITHUB_REPOSITORY must be set (GitHub Actions sets it)');
    }
    const url = `https://github.com/${repository}/releases/download/v${version}/${tgz}`;
    const changes = [changelogEntries(changelog, previousRelease(version, tags), version), changelogSection(changelog, version)]
        .filter((part) => part)
        .join('\n\n');
    return [
        '## Install',
        '',
        `The package is attached to this release as \`${tgz}\`: install it from its address, no token needed -`,
        'or download it and install the file.',
        '',
        '```sh',
        `npm install ${url}`,
        `npm install ./${tgz}`,
        '```',
        '',
        'The imports are `@simple-html/grid`. See the README for GitHub Packages.',
        '',
        '## Changes',
        '',
        changes || `CHANGELOG.md has nothing for ${version}.`,
        ''
    ].join('\n');
}

function run() {
    const [, , version, tgz, out, ...tags] = process.argv;
    if (!version || !tgz || !out) {
        throw new Error('Usage: node scripts/releaseNotes.js <version> <tgz file name> <out file> [tag ...]');
    }
    const changelog = fs.readFileSync(path.resolve(__dirname, '..', 'CHANGELOG.md'), 'utf8');
    fs.writeFileSync(out, releaseNotes({ changelog, version, tgz, repository: process.env.GITHUB_REPOSITORY, tags }));
}

if (require.main === module) {
    run();
}

module.exports = { changelogEntries, changelogSection, previousRelease, releaseNotes };
