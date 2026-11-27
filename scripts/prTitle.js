/**
 * The title of a pull request to master (pr.yml): a conventional commit, so the history of master says
 * what each change is. The version is not made from it: package.json has it, set by hand, and the
 * tag and publish workflows read it from there.
 *
 *   fix: ...   feat: ...                   a fix, a feature
 *   fix!: ...  feat!: ...                  something breaks
 *   chore: ... docs: ... test: ... refactor: ... ci: ... build: ... perf: ... style: ...
 *
 * A scope is allowed: `feat(grid): a find bar`. `!` only on fix and feat.
 *
 * Usage: TITLE='feat: a find bar' node scripts/prTitle.js - exits 1 with an ::error:: when it is not one
 */

const TYPES = ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'ci', 'build', 'perf', 'style'];

const ALLOWED =
    'fix: / feat: (fix!: / feat!: when something breaks) or chore: / docs: / test: / refactor: / ci: / build: / perf: / style:';

/**
 * What a pull request's title says
 * @param {string} title `feat(grid)!: a find bar`
 * @returns {{ type: string, scope: string, breaking: boolean, text: string } | { error: string }}
 */
function parseTitle(title) {
    const match = /^(\w+)(?:\(([\w./-]+)\))?(!?):\s*(\S.*)$/.exec(String(title).trim());
    if (!match || !TYPES.includes(match[1])) {
        return { error: `the title '${title}' must start with ${ALLOWED}` };
    }
    const [, type, scope = '', bang, text] = match;
    if (bang && type !== 'fix' && type !== 'feat') {
        return { error: `the title '${title}' is ${type}!: - only fix!: and feat!: can break something` };
    }
    return { type, scope, breaking: bang === '!', text };
}

if (require.main === module) {
    const parsed = parseTitle(process.env.TITLE ?? '');
    if ('error' in parsed) {
        console.log(`::error::${parsed.error}`);
        process.exit(1);
    }
    console.log(`${parsed.type}${parsed.breaking ? ' (breaking)' : ''}: ${parsed.text}`);
}

module.exports = { parseTitle };
