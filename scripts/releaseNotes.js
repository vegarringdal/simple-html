const fs = require('node:fs');
const path = require('node:path');

/**
 * The notes of a GitHub Release, for publish.yml: how to install the tgz attached to the release, then the
 * version's section of CHANGELOG.md (`## 6.0.0 (2026-11-27)` up to the next `## `), its own heading left
 * out - the release has the version as its title. A version the changelog has no section for gets a line
 * that says so: the release is not stopped by it.
 *
 * The tgz has the package's own name, `@simple-html/grid` (it is packed before scripts/githubPackage.js
 * renames the package for GitHub Packages), so it installs from the release's address without a token
 * or an npm alias - on a public repository.
 *
 * Usage: node scripts/releaseNotes.js <version> <tgz file name> <out file>
 * Reads GITHUB_REPOSITORY (set by GitHub Actions), `owner/name`.
 */

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

/**
 * The notes: the install lines, then the changelog's section
 * @param {{ changelog: string, version: string, tgz: string, repository: string }} options
 */
function releaseNotes({ changelog, version, tgz, repository }) {
    if (!repository) {
        throw new Error('releaseNotes: GITHUB_REPOSITORY must be set (GitHub Actions sets it)');
    }
    const url = `https://github.com/${repository}/releases/download/v${version}/${tgz}`;
    const section = changelogSection(changelog, version);
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
        section || `CHANGELOG.md has no section for ${version}.`,
        ''
    ].join('\n');
}

function run() {
    const [, , version, tgz, out] = process.argv;
    if (!version || !tgz || !out) {
        throw new Error('Usage: node scripts/releaseNotes.js <version> <tgz file name> <out file>');
    }
    const changelog = fs.readFileSync(path.resolve(__dirname, '..', 'CHANGELOG.md'), 'utf8');
    fs.writeFileSync(out, releaseNotes({ changelog, version, tgz, repository: process.env.GITHUB_REPOSITORY }));
}

if (require.main === module) {
    run();
}

module.exports = { changelogSection, releaseNotes };
