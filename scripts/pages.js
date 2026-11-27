const fs = require('node:fs');
const path = require('node:path');
const { branchSlug } = require('./githubPackage');

/**
 * Where a build of the docs site goes on the gh-pages branch (pages.yml):
 * - the default branch (master) at the root, https://<owner>.github.io/<repo>/ - the released docs
 * - any other branch under `dev/<branch>/` (`feature/Find_bar` is `dev/feature-find-bar/`), so a
 *   branch can be tried while master's stay. `dev/index.html` lists them, from the `build.json` each
 *   build has (scripts/buildDemo.js)
 * The other folders are left as they are. The workflow makes one commit of the result and force
 * pushes it: gh-pages holds the sites, not their history.
 *
 * Usage:
 *   node scripts/pages.js place <gh-pages checkout> <build folder> <branch> <default branch>
 *   node scripts/pages.js remove <gh-pages checkout> <branch>     a branch's dev docs taken down
 * Writes `target` (the folder, '' for the root) and `changed` (false: no dev docs of that branch to
 * remove) to GITHUB_OUTPUT when it is set.
 */

/** '' (the root) for the default branch, `dev/<branch>` for any other */
function targetFor(branch, defaultBranch) {
    return branch === defaultBranch ? '' : `dev/${branchSlug(branch)}`;
}

/** what is in a folder, without git's */
function entries(folder) {
    return fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name !== '.git') : [];
}

/**
 * Puts a build in its place: at the root everything but `dev` is replaced, under dev only its folder
 * @param {string} site the checkout of gh-pages
 * @param {string} build the built site (dist_demo)
 * @param {string} target from targetFor
 */
function place(site, build, target) {
    const into = path.join(site, target);
    if (target) {
        fs.rmSync(into, { recursive: true, force: true });
    } else {
        for (const name of entries(site).filter((each) => each !== 'dev')) {
            fs.rmSync(path.join(site, name), { recursive: true, force: true });
        }
    }
    fs.mkdirSync(into, { recursive: true });
    fs.cpSync(build, into, { recursive: true });
    finish(site);
}

/** takes a branch's dev docs down; false when there were none */
function remove(site, branch) {
    const folder = path.join(site, 'dev', branchSlug(branch));
    if (!fs.existsSync(folder)) {
        return false;
    }
    fs.rmSync(folder, { recursive: true, force: true });
    finish(site);
    return true;
}

/** .nojekyll at the root (github pages serves the files as they are), and the list of dev/ */
function finish(site) {
    fs.writeFileSync(path.join(site, '.nojekyll'), '');
    const dev = path.join(site, 'dev');
    const builds = entries(dev)
        .filter((name) => fs.statSync(path.join(dev, name)).isDirectory())
        .map((name) => ({ name, build: readBuild(path.join(dev, name, 'build.json')) }));
    if (builds.length) {
        fs.writeFileSync(path.join(dev, 'index.html'), devIndex(builds));
    } else {
        fs.rmSync(dev, { recursive: true, force: true });
    }
}

function readBuild(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/**
 * The page of dev/: a link to each branch's docs, with the commit and when it was built, newest first
 * @param {{ name: string, build: { branch?: string, commit?: string, url?: string, version?: string, built?: string } | null }[]} builds
 */
function devIndex(builds) {
    const sorted = [...builds].sort((a, b) => String(b.build?.built ?? '').localeCompare(String(a.build?.built ?? '')));
    const rows = sorted.map(({ name, build }) => {
        const commit = build?.commit
            ? build.url
                ? `<a href="${escapeHtml(build.url)}"><code>${escapeHtml(build.commit)}</code></a>`
                : `<code>${escapeHtml(build.commit)}</code>`
            : '';
        return `            <tr><td><a href="./${escapeHtml(name)}/">${escapeHtml(build?.branch ?? name)}</a></td><td>${commit}</td><td>${escapeHtml(build?.version ?? '')}</td><td>${escapeHtml((build?.built ?? '').replace('T', ' ').slice(0, 16))}</td></tr>`;
    });
    return `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>@simple-html/grid - dev docs</title>
        <style>
            :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
            body { max-width: 760px; margin: 32px auto; padding: 0 16px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { text-align: left; padding: 6px 10px 6px 0; border-bottom: 1px solid #8884; }
            code { font-size: 13px; }
        </style>
    </head>
    <body>
        <h1>Dev docs</h1>
        <p>The docs of branches, deployed by hand (the <code>pages</code> workflow). The released docs are at <a href="../">the root</a>.</p>
        <table>
            <tr><th>Branch</th><th>Commit</th><th>Version</th><th>Built (UTC)</th></tr>
${rows.join('\n')}
        </table>
    </body>
</html>
`;
}

if (require.main === module) {
    const [command, site, ...rest] = process.argv.slice(2);
    /** for the workflow: changed=false, nothing to push */
    const output = (lines) => {
        console.log(lines.join('\n'));
        if (process.env.GITHUB_OUTPUT) {
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
        }
    };
    if (command === 'place') {
        const [build, branch, defaultBranch] = rest;
        const target = targetFor(branch, defaultBranch);
        place(site, build, target);
        output([`target=${target}`, 'changed=true']);
    } else if (command === 'remove') {
        output([`target=dev/${branchSlug(rest[0])}`, `changed=${remove(site, rest[0])}`]);
    } else {
        console.error("pages: 'place' or 'remove'");
        process.exit(1);
    }
}

module.exports = { targetFor, place, remove, devIndex };
